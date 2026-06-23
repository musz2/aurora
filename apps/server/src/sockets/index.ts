import type { Server } from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { SOCKET_EVENTS, type SessionMode } from "@aurora/shared";
import { verifyAccessToken, type TokenPayload } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";
import { TranscriptSimulator } from "../services/transcript.simulator.js";
import { generateLiveSuggestion } from "../services/ai.service.js";
import {
  createLiveTranscription,
  type LiveSttConnection,
} from "../services/deepgram.service.js";
import { hasDeepgram, hasOpenAI } from "../config/env.js";

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
    };

    const clearTimers = () => {
      if (session.wordTimer) clearTimeout(session.wordTimer);
      if (session.gapTimer) clearTimeout(session.gapTimer);
      session.wordTimer = null;
      session.gapTimer = null;
    };

    const persistFinal = async (
      speakerName: string,
      text: string,
      startTime: number
    ): Promise<string> => {
      let id = `tmp-${Date.now()}`;
      if (!session.meetingId) return id;
      try {
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
        id = saved.id;
      } catch {
        /* meeting may be ad-hoc */
      }
      return id;
    };

    /* ---------------------- REAL: Deepgram live STT ---------------------- */

    const startRealSession = (meetingId: string) => {
      session.meetingId = meetingId;
      session.startTime = Date.now();
      session.dgEvents = 0;
      session.receivedPackets = 0;

      if (!hasDeepgram) {
        // Honest error — never fall back to demo transcript in a real session.
        send(ws, SOCKET_EVENTS.TRANSCRIPT_ERROR, {
          code: "stt_not_configured",
          message:
            "Live transcription is not configured. Set DEEPGRAM_API_KEY on the server to enable real speech-to-text.",
        });
        send(ws, SOCKET_EVENTS.MEETING_STATUS, {
          meetingId,
          status: "RECORDING",
          state: "error",
          engine: "none",
        });
        return;
      }

      send(ws, SOCKET_EVENTS.MEETING_STATUS, {
        meetingId,
        status: "RECORDING",
        engine: "deepgram",
        state: "listening",
      });
      send(ws, SOCKET_EVENTS.RECORDING_WARNING, {
        message:
          "Recording active. Ensure all participants have consented per your workspace policy.",
      });

      send(ws, SOCKET_EVENTS.DG_STATUS, {
        connected: false,
        connecting: true,
        events: 0,
      });

      session.dg = createLiveTranscription({
        onOpen: () =>
          send(ws, SOCKET_EVENTS.DG_STATUS, {
            connected: true,
            connecting: false,
            events: 0,
          }),
        onClose: (reason) =>
          send(ws, SOCKET_EVENTS.DG_STATUS, {
            connected: false,
            connecting: false,
            events: session.dgEvents,
            reason,
          }),
        onError: (message) =>
          send(ws, SOCKET_EVENTS.TRANSCRIPT_ERROR, {
            code: "stt_error",
            message,
          }),
        onTranscript: async (e) => {
          if (session.stopped) return;
          session.dgEvents += 1;
          const speaker = e.speaker ?? session.interimSpeaker;
          session.interimSpeaker = speaker;
          const relStart = e.start;
          if (e.isFinal) {
            const id = await persistFinal(speaker, e.text, relStart);
            send(ws, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
              id,
              meetingId,
              speakerName: speaker,
              text: e.text,
              startTime: relStart,
              endTime: relStart,
              isFinal: true,
            });
            send(ws, SOCKET_EVENTS.MEETING_STATUS, {
              meetingId,
              status: "RECORDING",
              state: "live",
            });
          } else {
            send(ws, SOCKET_EVENTS.TRANSCRIPT_PARTIAL, {
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
      if (session.stopped) return;
      if (!session.simulator.hasMore()) {
        send(ws, SOCKET_EVENTS.MEETING_STATUS, {
          meetingId: session.meetingId,
          status: "PROCESSING",
          state: "finalized",
        });
        return;
      }
      const utt = session.simulator.next();
      const words = utt.text.split(" ");
      let i = 0;
      send(ws, SOCKET_EVENTS.MEETING_STATUS, {
        meetingId: session.meetingId,
        status: "RECORDING",
        state: "listening",
      });
      const revealWord = () => {
        if (session.stopped) return;
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
          send(ws, SOCKET_EVENTS.MEETING_STATUS, {
            meetingId: session.meetingId,
            status: "RECORDING",
            state: "processing",
          });
          session.gapTimer = setTimeout(async () => {
            if (session.stopped) return;
            const id = await persistFinal(
              utt.speakerName,
              utt.text,
              utt.startTime
            );
            send(ws, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
              id,
              meetingId: session.meetingId,
              speakerName: utt.speakerName,
              text: utt.text,
              startTime: utt.startTime,
              endTime: utt.endTime,
              isFinal: true,
            });
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
      send(ws, SOCKET_EVENTS.MEETING_STATUS, {
        meetingId,
        status: "RECORDING",
        engine: "simulated",
        state: "live",
      });
      clearTimers();
      speakUtterance();
    };

    const stopAll = () => {
      session.stopped = true;
      clearTimers();
      session.dg?.finish();
      send(ws, SOCKET_EVENTS.MEETING_STATUS, {
        meetingId: session.meetingId,
        status: "PROCESSING",
        state: "finalized",
      });
    };

    ws.on("message", async (raw: RawData, isBinary: boolean) => {
      // Binary frames = raw audio chunks from the browser → forward to Deepgram.
      if (isBinary) {
        session.receivedPackets += 1;
        if (session.dg) session.dg.send(raw as Buffer);
        if (session.receivedPackets % 10 === 0) {
          send(ws, SOCKET_EVENTS.AUDIO_ACK, {
            received: session.receivedPackets,
          });
        }
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
          session.stopped = false;
          if (meetingId) {
            await prisma.meeting
              .update({
                where: { id: meetingId },
                data: { status: "RECORDING", startedAt: new Date() },
              })
              .catch(() => null);
          }
          if (mode === "demo") await startDemoSession(meetingId);
          else startRealSession(meetingId);
          break;
        }
        case SOCKET_EVENTS.MEETING_STOP: {
          stopAll();
          break;
        }
        case SOCKET_EVENTS.TRANSCRIPT_AUDIO_CHUNK: {
          // Audio is sent as binary frames (handled above). This text event is
          // kept for protocol compatibility.
          break;
        }
        case SOCKET_EVENTS.AI_ASK_LIVE: {
          const question = (msg.payload?.question as string) ?? "";
          if (!hasOpenAI) {
            send(ws, SOCKET_EVENTS.AI_SUGGESTION, {
              question,
              configured: false,
              suggestion:
                "The private AI assistant requires an OpenAI API key. Add OPENAI_API_KEY on the server to enable live suggestions.",
            });
            break;
          }
          const recent = await prisma.transcriptSegment
            .findMany({
              where: { meetingId: session.meetingId },
              orderBy: { startTime: "desc" },
              take: 6,
            })
            .catch(() => []);
          const ctx = recent
            .reverse()
            .map((s) => `${s.speakerName}: ${s.text}`)
            .join("\n");
          const suggestion = await generateLiveSuggestion(question, ctx);
          send(ws, SOCKET_EVENTS.AI_SUGGESTION, {
            question,
            configured: true,
            suggestion,
          });
          break;
        }
        default:
          break;
      }
    });

    ws.on("close", () => {
      session.stopped = true;
      clearTimers();
      session.dg?.finish();
    });
    ws.on("error", () => {
      session.stopped = true;
      clearTimers();
      session.dg?.finish();
    });
  });

  return wss;
}
