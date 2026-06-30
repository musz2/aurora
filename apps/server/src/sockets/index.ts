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
  const wss = new WebSocketServer({ server, path: "/ws" });

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
    console.info(`[ws] client connected — userId=${auth.userId}`);

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

      if (!hasDeepgram) {
        console.warn(`[ws] DEEPGRAM_API_KEY not set — live STT unavailable for meeting ${meetingId}`);
        send(ws, SOCKET_EVENTS.TRANSCRIPT_ERROR, {
          code: "stt_not_configured",
          message:
            "Live transcription is not configured. Set DEEPGRAM_API_KEY on the server to enable real speech-to-text.",
        });
        sendStatus({ status: "RECORDING", state: "error", engine: "none" });
        return;
      }

      console.info(`[WS SERVER] starting real session — meetingId=${meetingId}`);
      sendStatus({ status: "RECORDING", engine: "deepgram", state: "listening" });
      send(ws, SOCKET_EVENTS.RECORDING_WARNING, {
        message:
          "Recording active. Ensure all participants have consented per your workspace policy.",
      });

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
      // Binary frames = raw audio chunks from the browser → forward to Deepgram.
      if (isBinary) {
        // While paused, drop audio so nothing is transcribed or persisted.
        if (session.paused) return;
        session.receivedPackets += 1;
        const buf = raw as Buffer;
        // Log first chunk and every 100th chunk.
        if (session.receivedPackets === 1) {
          console.info(`[WS SERVER] first audio chunk received — ${buf.length}B from userId=${auth!.userId}`);
        } else if (session.receivedPackets % 100 === 0) {
          console.info(`[WS SERVER] audio chunks received — count=${session.receivedPackets} dgOpen=${session.dg?.isOpen() ?? false}`);
        }
        if (session.dg) {
          if (!session.dg.isOpen()) {
            if (session.receivedPackets === 1) {
              console.info(`[WS SERVER] first chunk buffered (Deepgram not open yet) — queueing until Open event`);
            }
          }
          session.dg.send(buf);
        } else {
          console.warn(`[WS SERVER] audio chunk #${session.receivedPackets} DROPPED (session.dg is null — MEETING_START may not have been processed yet)`);
        }
        // Send AUDIO_ACK on EVERY packet so the client's no-audio timer
        // clears as soon as the server receives the first chunk.
        send(ws, SOCKET_EVENTS.AUDIO_ACK, {
          received: session.receivedPackets,
        });
        return;
      }

      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case SOCKET_EVENTS.MEETING_START: {
          const meetingId = (msg.payload?.meetingId as string) ?? "";
          const mode = (msg.payload?.mode as SessionMode) ?? "real";
          session.mode = mode;
          session.assistantMode = normalizeAssistantMode(
            msg.payload?.assistantMode as string | undefined
          );
          session.stopped = false;
          session.paused = false;
          if (meetingId) {
            await prisma.meeting
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
  const vwss = new WebSocketServer({ server, path: "/ws-viewer" });

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
