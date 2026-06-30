import type { Server } from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { SOCKET_EVENTS, type SessionMode } from "@aurora/shared";
import { verifyAccessToken, type TokenPayload } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";
import { TranscriptSimulator } from "../services/transcript.simulator.js";
import { generateStructuredLiveSuggestion } from "../services/ai.service.js";
import {
  createLiveTranscription,
  type LiveSttConnection,
} from "../services/deepgram.service.js";
import { hasDeepgram } from "../config/env.js";
import { isShareActive } from "../services/shared-viewer.service.js";

/**
 * Map of meetingId → Set of viewer WebSocket connections.
 * Used to broadcast transcript events to all connected viewers in real time.
 * Viewers connect via /ws-viewer?shareId=<shareId> (no JWT required — the shareId
 * itself is the auth token, matching the existing HTTP shared-viewer security model).
 */
const viewerConnections = new Map<string, Set<WebSocket>>();
import {
  detectQuestions,
  normalizeAssistantMode,
  parseAssistantIntent,
  renderSuggestionText,
  type AssistantContext,
  type AssistantMode,
  type StructuredSuggestion,
} from "../services/private-assistant.service.js";
import {
  FinalSegmentWindow,
  isDuplicateFinalSegment,
} from "../services/transcript-segment.service.js";
import { toRecordingState } from "../services/recording-state.service.js";

interface ClientMessage {
  type: string;
  payload?: Record<string, unknown>;
}

interface Session {
  meetingId: string;
  mode: SessionMode;
  // demo
  simulator: TranscriptSimulator;
  wordTimer: NodeJS.Timeout | null;
  gapTimer: NodeJS.Timeout | null;
  // real
  dg: LiveSttConnection | null;
  dgEvents: number;
  receivedPackets: number;
  startTime: number;
  // interim accumulation for diarized real STT
  interimSpeaker: string;
  stopped: boolean;
  paused: boolean;
  audioReadySent: boolean;
  assistantMode: AssistantMode;
  // In-session dedup of finalized segments (reconnect-safe layer is DB-backed).
  finals: FinalSegmentWindow;
}

function send(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

export function attachSocketServer(server: Server) {
  // perMessageDeflate disabled: binary audio chunks in rapid succession can
  // trigger "Invalid frame header" errors when compression negotiation or
  // proxy frame handling introduces framing corruption. Disabling compression
  // eliminates this entire class of WebSocket protocol failures.
  // Use noServer + a path-scoped upgrade handler instead of the { server, path }
  // option. The viewer server (/ws-viewer) shares the same HTTP server; with the
  // `server` option BOTH WebSocketServers attach an 'upgrade' listener, and the
  // non-matching one calls abortHandshake() on a socket the other already upgraded
  // — corrupting the WebSocket stream ("RSV1 must be clear" on the first frame).
  // Routing each upgrade to exactly one server by path avoids that corruption.
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "", "http://localhost").pathname;
    if (pathname !== "/ws") return; // not ours — leave it for the viewer handler
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws, req) => {
    let auth: TokenPayload | null = null;
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const token = url.searchParams.get("token");
      if (token) auth = verifyAccessToken(token);
    } catch {
      auth = null;
    }
    if (!auth) {
      send(ws, SOCKET_EVENTS.AI_ERROR, { message: "Unauthorized socket" });
      ws.close();
      return;
    }
    console.info(`[WS SERVER] upgrade received path=${req.url}`);
    console.info(`[WS SERVER] client connected userId=${auth.userId}`);

    const session: Session = {
      meetingId: "",
      mode: "real",
      simulator: new TranscriptSimulator(),
      wordTimer: null,
      gapTimer: null,
      dg: null,
      dgEvents: 0,
      receivedPackets: 0,
      startTime: Date.now(),
      interimSpeaker: "Speaker 1",
      stopped: false,
      paused: false,
      audioReadySent: false,
      assistantMode: "Technical Meeting",
      finals: new FinalSegmentWindow(),
    };

    const sendLifecycle = (state: string, extra?: Record<string, unknown>) =>
      send(ws, SOCKET_EVENTS.MEETING_LIFECYCLE, {
        meetingId: session.meetingId,
        state,
        recordingState: toRecordingState({
          engineState: state,
          paused: session.paused,
          stopped: session.stopped,
        }),
        ...extra,
      });

    /**
     * Emit a meeting status with a canonical `recordingState` attached so the UI
     * always renders one of the stable states (idle/connecting/recording/paused/
     * reconnecting/stopped/failed) regardless of engine-specific `state` hints.
     */
    const sendStatus = (payload: {
      status: string;
      state?: string;
      engine?: string;
    }) =>
      send(ws, SOCKET_EVENTS.MEETING_STATUS, {
        meetingId: session.meetingId,
        ...payload,
        recordingState: toRecordingState({
          status: payload.status,
          engineState: payload.state,
          paused: session.paused,
          stopped: session.stopped,
        }),
      });

    const clearTimers = () => {
      if (session.wordTimer) clearTimeout(session.wordTimer);
      if (session.gapTimer) clearTimeout(session.gapTimer);
      session.wordTimer = null;
      session.gapTimer = null;
    };

    /**
     * Persist a finalized segment, deduplicating against (a) earlier finals in
     * this socket session and (b) finals already stored for this meeting by a
     * previous socket (reconnect replay). Returns the new segment id, or null
     * when the segment was a duplicate and should NOT be broadcast/persisted.
     */
    const persistFinal = async (
      speakerName: string,
      text: string,
      startTime: number
    ): Promise<string | null> => {
      const candidate = { speakerName, text, startTime };
      // Fast path: duplicate within the current connection.
      if (session.finals.isDuplicate(candidate)) return null;
      if (!session.meetingId) return `tmp-${Date.now()}`;
      try {
        // Reconnect-safe path: compare against the most recent persisted finals.
        const recent = await prisma.transcriptSegment.findMany({
          where: { meetingId: session.meetingId },
          orderBy: { startTime: "desc" },
          take: 15,
          select: { speakerName: true, text: true, startTime: true },
        });
        if (isDuplicateFinalSegment(candidate, recent)) return null;
        const saved = await prisma.transcriptSegment.create({
          data: {
            meetingId: session.meetingId,
            speakerName,
            text,
            startTime,
            endTime: startTime,
            confidence: null,
          },
        });
        return saved.id;
      } catch {
        /* meeting may be ad-hoc */
        return `tmp-${Date.now()}`;
      }
    };

    const recentContext = async () => {
      const recent = await prisma.transcriptSegment
        .findMany({
          where: { meetingId: session.meetingId },
          orderBy: { startTime: "desc" },
          take: 6,
        })
        .catch(() => []);
      return recent
        .reverse()
        .map((s) => `${s.speakerName}: ${s.text}`)
        .join("\n");
    };

    /**
     * Assemble the host-only assistant context: recent transcript + meeting title
     * + speaker names + workspace vocabulary + the host's own private notes. All
     * host-only; none of this is ever sent to the shared viewer.
     */
    const buildAssistantContext = async (): Promise<AssistantContext> => {
      const recentTranscript = await recentContext();
      if (!session.meetingId) return { recentTranscript };
      const meeting = await prisma.meeting
        .findUnique({
          where: { id: session.meetingId },
          select: { title: true, workspaceId: true },
        })
        .catch(() => null);
      if (!meeting) return { recentTranscript };
      const [speakers, vocab, notes] = await Promise.all([
        prisma.transcriptSegment
          .findMany({
            where: { meetingId: session.meetingId },
            distinct: ["speakerName"],
            select: { speakerName: true },
            take: 12,
          })
          .catch(() => [] as { speakerName: string }[]),
        prisma.customVocabulary
          .findMany({
            where: { workspaceId: meeting.workspaceId },
            select: { term: true },
            take: 50,
          })
          .catch(() => [] as { term: string }[]),
        prisma.privateAssistSuggestion
          .findMany({
            where: {
              meetingId: session.meetingId,
              userId: auth!.userId,
              question: "Private note",
            },
            select: { suggestion: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
          .catch(() => [] as { suggestion: string }[]),
      ]);
      return {
        recentTranscript,
        meetingTitle: meeting.title,
        speakerNames: speakers.map((s) => s.speakerName),
        vocabulary: vocab.map((v) => v.term),
        privateNotes: notes.map((n) => n.suggestion),
      };
    };

    const sendStructuredSuggestion = async (
      suggestion: StructuredSuggestion,
      configured: boolean
    ) => {
      const text = renderSuggestionText(suggestion);
      if (session.meetingId) {
        await prisma.privateAssistSuggestion
          .create({
            data: {
              meetingId: session.meetingId,
              userId: auth!.userId,
              question: suggestion.question,
              suggestion: text,
            },
          })
          .catch(() => null);
      }
      send(ws, SOCKET_EVENTS.AI_SUGGESTION, {
        question: suggestion.question,
        configured,
        mode: session.assistantMode,
        intent: suggestion.intent,
        confidence: suggestion.confidence,
        private: true,
        suggestion: text, // readable string (backward-compatible)
        structured: suggestion, // full structured payload for rich rendering
      });
    };

    /**
     * Produce one private suggestion for a host ask or detected question. `manual`
     * asks surface AI errors to the host; auto-detected ones fail silently so the
     * transcript keeps flowing.
     */
    const suggest = async (rawQuestion: string, manual: boolean) => {
      const intent = parseAssistantIntent(rawQuestion);
      const context = await buildAssistantContext();
      try {
        const { suggestion, configured } = await generateStructuredLiveSuggestion({
          question: rawQuestion,
          mode: session.assistantMode,
          intent,
          context,
          demoMode: session.mode === "demo",
        });
        await sendStructuredSuggestion(suggestion, configured);
      } catch (err) {
        if (manual) {
          send(ws, SOCKET_EVENTS.AI_ERROR, {
            message:
              err instanceof Error
                ? err.message
                : "AI generation failed. No mock output was saved.",
          });
        }
        /* auto-detected: keep transcription flowing even if assistant fails */
      }
    };

    const maybeSuggestFromTranscript = async (text: string) => {
      const questions = detectQuestions(text);
      for (const q of questions.slice(0, 2)) {
        await suggest(q.question, false);
      }
    };

    /* ---------------------- REAL: Deepgram live STT ---------------------- */

    const startRealSession = (meetingId: string) => {
      session.meetingId = meetingId;
      session.startTime = Date.now();
      session.dgEvents = 0;
      session.receivedPackets = 0;

      console.info(`[WS SERVER] meeting start accepted — meetingId=${meetingId}`);
      sendStatus({
        status: "RECORDING",
        engine: hasDeepgram ? "deepgram" : "none",
        state: "listening",
      });

      // ALWAYS confirm the audio session immediately. AUDIO_READY means "the
      // server accepted the audio session", NOT "Deepgram transcript ready". It
      // is never gated on the Deepgram connection, so the client can never hang
      // on "Server did not confirm audio readiness". If STT is unavailable we
      // still confirm readiness and report the problem via TRANSCRIPT_ERROR below.
      send(ws, SOCKET_EVENTS.AUDIO_READY, {});
      session.audioReadySent = true;
      console.info(`[WS SERVER] audio ready sent — meetingId=${meetingId}`);

      send(ws, SOCKET_EVENTS.RECORDING_WARNING, {
        message:
          "Recording active. Ensure all participants have consented per your workspace policy.",
      });

      if (!hasDeepgram) {
        // Session accepted (AUDIO_READY already sent); transcription won't run.
        console.warn(`[ws] DEEPGRAM_API_KEY not set — live STT unavailable for meeting ${meetingId}`);
        send(ws, SOCKET_EVENTS.TRANSCRIPT_ERROR, {
          code: "stt_not_configured",
          message:
            "Live transcription is not configured. Set DEEPGRAM_API_KEY on the server to enable real speech-to-text.",
        });
        sendStatus({ status: "RECORDING", state: "error", engine: "none" });
        return;
      }

      send(ws, SOCKET_EVENTS.DG_STATUS, {
        connected: false,
        connecting: true,
        events: 0,
        reason: "",
      });

      session.dg = createLiveTranscription({
        onOpen: () => {
          console.info(`[ws] Deepgram open — meetingId=${meetingId}`);
          send(ws, SOCKET_EVENTS.DG_STATUS, {
            connected: true,
            connecting: false,
            events: 0,
          });
        },
        onClose: (reason) => {
          console.warn(`[ws] Deepgram close — meetingId=${meetingId} reason="${reason}" stopped=${session.stopped}`);
          if (session.stopped) return;
          send(ws, SOCKET_EVENTS.DG_STATUS, {
            connected: false,
            connecting: false,
            events: session.dgEvents,
            reason,
          });
        },
        onError: (message) => {
          console.error(`[ws] Deepgram error — meetingId=${meetingId} message="${message}"`);
          send(ws, SOCKET_EVENTS.TRANSCRIPT_ERROR, {
            code: "stt_error",
            message,
          });
        },
        onTranscript: async (e) => {
          if (session.stopped || session.paused) return;
          session.dgEvents += 1;
          const speaker = e.speaker ?? session.interimSpeaker;
          session.interimSpeaker = speaker;
          const relStart = e.start;
          const dgReceiveTime = Date.now();

          if (e.isFinal) {
            // 1. BROADCAST to host immediately (no DB wait).
            const tmpId = `tmp-${dgReceiveTime}`;
            send(ws, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
              id: tmpId,
              meetingId,
              speakerName: speaker,
              text: e.text,
              startTime: relStart,
              endTime: relStart,
              isFinal: true,
            });

            // 2. BROADCAST to viewers immediately.
            broadcastToViewers(meetingId, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
              id: tmpId,
              meetingId,
              speakerName: speaker,
              text: e.text,
              startTime: relStart,
              endTime: relStart,
              isFinal: true,
            });

            // 3. Async persistence + AI suggestion (non-blocking).
            persistFinal(speaker, e.text, relStart).then((persistedId) => {
              // If the segment was a duplicate (already persisted), the viewer
              // already has the event — no correction needed.
              if (persistedId && persistedId !== tmpId) {
                // Optionally update the tmpId with real id, but the frontend
                // deduplicates by meetingId+startTime+speakerName anyway.
              }
            }).catch(() => null);
            maybeSuggestFromTranscript(e.text).catch(() => null);

            sendStatus({ status: "RECORDING", state: "live" });

            // Latency log (every 20 finals to reduce noise).
            if (session.dgEvents % 20 === 0) {
              console.info(`[latency] deepgramTranscriptAt=${dgReceiveTime} hostBroadcastAt=${Date.now()} dgEvents=${session.dgEvents}`);
            }
          } else {
            // Interim: broadcast to host + viewers immediately (no persistence).
            send(ws, SOCKET_EVENTS.TRANSCRIPT_PARTIAL, {
              meetingId,
              speakerName: speaker,
              text: e.text,
              isFinal: false,
            });
            broadcastToViewers(meetingId, SOCKET_EVENTS.TRANSCRIPT_PARTIAL, {
              meetingId,
              speakerName: speaker,
              text: e.text,
              isFinal: false,
            });
          }
          send(ws, SOCKET_EVENTS.DG_STATUS, {
            connected: session.dg?.isOpen() ?? false,
            events: session.dgEvents,
          });
        },
      });
    };

    /* -------------------------- DEMO: simulator -------------------------- */

    const speakUtterance = () => {
      if (session.stopped || session.paused) return;
      if (!session.simulator.hasMore()) {
        sendStatus({ status: "PROCESSING", state: "finalized" });
        return;
      }
      const utt = session.simulator.next();
      const words = utt.text.split(" ");
      let i = 0;
      sendStatus({ status: "RECORDING", state: "listening" });
      const revealWord = () => {
        if (session.stopped || session.paused) return;
        i += 1;
        send(ws, SOCKET_EVENTS.TRANSCRIPT_PARTIAL, {
          meetingId: session.meetingId,
          speakerName: utt.speakerName,
          text: words.slice(0, i).join(" "),
          isFinal: false,
        });
        if (i < words.length) {
          session.wordTimer = setTimeout(revealWord, 90 + Math.random() * 100);
        } else {
          sendStatus({ status: "RECORDING", state: "processing" });
          session.gapTimer = setTimeout(async () => {
            if (session.stopped) return;
            const id = await persistFinal(
              utt.speakerName,
              utt.text,
              utt.startTime
            );
            if (id !== null) {
              send(ws, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
                id,
                meetingId: session.meetingId,
                speakerName: utt.speakerName,
                text: utt.text,
                startTime: utt.startTime,
                endTime: utt.endTime,
                isFinal: true,
              });
              await maybeSuggestFromTranscript(utt.text);
            }
            session.gapTimer = setTimeout(
              speakUtterance,
              500 + Math.random() * 400
            );
          }, 380);
        }
      };
      revealWord();
    };

    const startDemoSession = async (meetingId: string) => {
      session.meetingId = meetingId;
      session.simulator = new TranscriptSimulator();
      session.finals.reset();
      sendStatus({ status: "RECORDING", engine: "simulated", state: "live" });
      clearTimers();
      speakUtterance();
    };

    const stopAll = () => {
      console.info(`[ws] stopAll — meetingId=${session.meetingId} packets=${session.receivedPackets} dgEvents=${session.dgEvents}`);
      session.stopped = true;
      clearTimers();
      session.dg?.finish();
      sendStatus({ status: "PROCESSING", state: "finalized" });
    };

    ws.on("message", async (raw: RawData, isBinary: boolean) => {
      // ----------------------------------------------------------------
      // BINARY: raw audio chunks from the browser → forward to Deepgram.
      // In the ws library, binary frames arrive as Buffer with isBinary=true.
      // Text frames arrive as string with isBinary=false.
      // ONLY isBinary is the reliable indicator — Buffer.isBuffer(raw) is
      // true for BOTH text and binary in some ws library versions, and
      // ArrayBuffer checks never match (ws uses Node Buffers internally).
      // ----------------------------------------------------------------
      if (isBinary) {
        // While paused, drop audio so nothing is transcribed or persisted.
        if (session.paused) return;
        session.receivedPackets += 1;

        // [WS SERVER] binary audio received size=
        let buf: Buffer;
        if (Buffer.isBuffer(raw)) {
          buf = raw;
        } else if (raw instanceof ArrayBuffer) {
          buf = Buffer.from(raw);
        } else if (raw instanceof Buffer) {
          buf = raw;
        } else {
          // Last resort: try to convert from string (shouldn't happen)
          console.warn(`[WS SERVER] unexpected binary type: ${typeof raw} — attempting conversion`);
          buf = Buffer.from(raw as unknown as string);
        }

        // Log first chunk and every 100th chunk.
        if (session.receivedPackets === 1) {
          console.info(`[WS SERVER] binary audio received size=${buf.length}B userId=${auth!.userId}`);
        } else if (session.receivedPackets % 100 === 0) {
          console.info(`[WS SERVER] binary audio received size=${buf.length}B count=${session.receivedPackets} dgOpen=${session.dg?.isOpen() ?? false}`);
        }

        if (session.dg) {
          session.dg.send(buf);
        } else {
          console.warn(`[WS SERVER] audio chunk #${session.receivedPackets} DROPPED (session.dg is null — MEETING_START may not have been processed yet)`);
        }

        // [WS SERVER] AUDIO_ACK sent received=
        // Send AUDIO_ACK on EVERY packet so the client's no-audio timer
        // clears as soon as the server receives the first chunk.
        send(ws, SOCKET_EVENTS.AUDIO_ACK, {
          received: session.receivedPackets,
        });
        console.info(`[WS SERVER] AUDIO_ACK sent received=${session.receivedPackets}`);
        return;
      }

      // ----------------------------------------------------------------
      // TEXT: only reach here for string/text messages.
      // ----------------------------------------------------------------
      let msg: ClientMessage;
      try {
        const text = raw.toString();
        msg = JSON.parse(text);
      } catch {
        console.warn(`[WS SERVER] text parse error — raw type=${typeof raw}`);
        return;
      }
      console.info(`[WS SERVER] text message type=${msg.type}`);

      switch (msg.type) {
        case SOCKET_EVENTS.MEETING_START: {
          console.info(`[WS SERVER] meeting start received`);
          const meetingId = (msg.payload?.meetingId as string) ?? "";
          const mode = (msg.payload?.mode as SessionMode) ?? "real";
          session.mode = mode;
          session.assistantMode = normalizeAssistantMode(
            msg.payload?.assistantMode as string | undefined
          );
          session.stopped = false;
          session.paused = false;
          if (meetingId) {
            // Fire-and-forget: NEVER gate the real-time AUDIO_READY handshake on
            // a DB write. A cold Prisma connection or pool latency between the API
            // and Postgres can exceed the client's 10s readiness timeout and cause
            // "Server did not confirm audio readiness" even though STT is fine.
            void prisma.meeting
              .update({
                where: { id: meetingId },
                data: {
                  status: "RECORDING",
                  startedAt: new Date(),
                  demoMode: mode === "demo",
                },
              })
              .catch(() => null);
          }
          if (mode === "demo") await startDemoSession(meetingId);
          else {
            try {
              startRealSession(meetingId);
            } catch (err) {
              console.error(`[WS SERVER] startRealSession threw:`, err);
              send(ws, SOCKET_EVENTS.TRANSCRIPT_ERROR, {
                code: "stt_init_error",
                message: "Failed to initialize speech-to-text engine. Check server logs.",
              });
              sendStatus({ status: "RECORDING", state: "error", engine: "none" });
            }
          }
          sendLifecycle("recording", { mode });
          break;
        }
        case SOCKET_EVENTS.MEETING_PAUSE: {
          if (!session.paused && !session.stopped) {
            session.paused = true;
            clearTimers();
            sendLifecycle("paused");
            sendStatus({ status: "RECORDING", state: "paused" });
          }
          break;
        }
        case SOCKET_EVENTS.MEETING_RESUME: {
          if (session.paused && !session.stopped) {
            session.paused = false;
            sendLifecycle("recording");
            sendStatus({
              status: "RECORDING",
              state: session.mode === "demo" ? "live" : "listening",
            });
            // Demo simulator restarts its scheduling loop; real STT just resumes
            // accepting audio frames again.
            if (session.mode === "demo") speakUtterance();
          }
          break;
        }
        case SOCKET_EVENTS.MEETING_STOP: {
          stopAll();
          sendLifecycle("stopped");
          break;
        }
        case SOCKET_EVENTS.TRANSCRIPT_AUDIO_CHUNK: {
          // Audio is sent as binary frames (handled above). This text event is
          // kept for protocol compatibility.
          break;
        }
        case SOCKET_EVENTS.AI_ASK_LIVE: {
          const question = (msg.payload?.question as string) ?? "";
          session.assistantMode = normalizeAssistantMode(
            msg.payload?.assistantMode as string | undefined
          );
          await suggest(question, true);
          break;
        }
        default:
          break;
      }
    });

    ws.on("close", () => {
      console.info(`[WS SERVER] client disconnected — userId=${auth!.userId} meetingId=${session.meetingId} packets=${session.receivedPackets} dgEvents=${session.dgEvents}`);
      if (session.stopped) return;
      session.stopped = true;
      clearTimers();
      session.dg?.finish();
    });
    ws.on("error", (err) => {
      console.error(`[WS SERVER] client error — userId=${auth!.userId}`, (err as Error).message);
      if (session.stopped) return;
      session.stopped = true;
      clearTimers();
      session.dg?.finish();
    });
  });

  return wss;
}

/* ---------------------- Viewer WebSocket server ---------------------- */

/**
 * Broadcast a transcript event to all connected viewers for a meeting.
 * Viewers receive the same event format as the host (TRANSCRIPT_PARTIAL for
 * interims, TRANSCRIPT_SEGMENT for finals) so they can render in real time.
 */
function broadcastToViewers(meetingId: string, type: string, payload: unknown) {
  const viewers = viewerConnections.get(meetingId);
  if (!viewers || viewers.size === 0) return;
  const msg = JSON.stringify({ type, payload });
  const now = Date.now();
  for (const v of viewers) {
    if (v.readyState === WebSocket.OPEN) {
      v.send(msg);
    }
  }
  if (type === SOCKET_EVENTS.TRANSCRIPT_SEGMENT || type === SOCKET_EVENTS.TRANSCRIPT_PARTIAL) {
    console.info(`[viewer] transcript event sent — meetingId=${meetingId} type=${type} viewers=${viewers.size} at=${now}`);
  }
}

/**
 * Attach a separate WebSocket server for shared viewers at /ws-viewer.
 * Viewers authenticate via shareId (the public share URL token) — the same
 * security model as the HTTP GET /api/sessions/:shareId endpoint.
 */
export function attachViewerSocketServer(server: Server) {
  // noServer + path-scoped upgrade routing (see attachSocketServer above) so this
  // viewer server never aborts a handshake the /ws server already completed.
  const vwss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "", "http://localhost").pathname;
    if (pathname !== "/ws-viewer") return; // not ours — leave it for the /ws handler
    vwss.handleUpgrade(req, socket, head, (ws) => vwss.emit("connection", ws, req));
  });

  vwss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const shareId = url.searchParams.get("shareId");
    if (!shareId) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Missing shareId" } }));
      ws.close();
      return;
    }

    // Validate the shareId by querying the meeting.
    let meetingId = "";
    try {
      const meeting = await prisma.meeting.findFirst({
        where: { shareId, shared: true },
        select: { id: true, shareExpiresAt: true },
      });
      if (!meeting || !isShareActive(meeting)) {
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid or expired share link" } }));
        ws.close();
        return;
      }
      meetingId = meeting.id;
    } catch {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Server error" } }));
      ws.close();
      return;
    }

    console.info(`[viewer] viewer connected — meetingId=${meetingId} shareId=${shareId}`);

    // Register in the broadcast map.
    if (!viewerConnections.has(meetingId)) {
      viewerConnections.set(meetingId, new Set());
    }
    viewerConnections.get(meetingId)!.add(ws);

    ws.on("close", () => {
      console.info(`[viewer] viewer disconnected — meetingId=${meetingId}`);
      const viewers = viewerConnections.get(meetingId);
      if (viewers) {
        viewers.delete(ws);
        if (viewers.size === 0) viewerConnections.delete(meetingId);
      }
    });

    ws.on("error", () => {
      const viewers = viewerConnections.get(meetingId);
      if (viewers) {
        viewers.delete(ws);
        if (viewers.size === 0) viewerConnections.delete(meetingId);
      }
    });
  });

  return vwss;
}
