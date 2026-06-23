import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { SOCKET_EVENTS } from "@aurora/shared";
import { verifyAccessToken, type TokenPayload } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";
import { TranscriptSimulator } from "../services/transcript.simulator.js";
import { generateLiveSuggestion } from "../services/ai.service.js";
import { hasDeepgram, hasOpenAI } from "../config/env.js";

interface ClientMessage {
  type: string;
  payload?: Record<string, unknown>;
}

interface Session {
  meetingId: string;
  simulator: TranscriptSimulator;
  wordTimer: NodeJS.Timeout | null;
  gapTimer: NodeJS.Timeout | null;
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
      simulator: new TranscriptSimulator(),
      wordTimer: null,
      gapTimer: null,
      stopped: false,
    };

    const clearTimers = () => {
      if (session.wordTimer) clearTimeout(session.wordTimer);
      if (session.gapTimer) clearTimeout(session.gapTimer);
      session.wordTimer = null;
      session.gapTimer = null;
    };

    /**
     * Simulated low-latency engine. Streams each utterance word-by-word as
     * interim (TRANSCRIPT_PARTIAL), then finalizes once (TRANSCRIPT_SEGMENT,
     * persisted). Interim text is never saved as final.
     */
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
        const interim = words.slice(0, i).join(" ");
        send(ws, SOCKET_EVENTS.TRANSCRIPT_PARTIAL, {
          meetingId: session.meetingId,
          speakerName: utt.speakerName,
          text: interim,
          isFinal: false,
        });
        if (i < words.length) {
          // 90–190ms per word feels fast and natural.
          session.wordTimer = setTimeout(revealWord, 90 + Math.random() * 100);
        } else {
          // Endpointing: short silence, then finalize.
          send(ws, SOCKET_EVENTS.MEETING_STATUS, {
            meetingId: session.meetingId,
            status: "RECORDING",
            state: "processing",
          });
          session.gapTimer = setTimeout(finalizeUtterance.bind(null, utt), 380);
        }
      };
      revealWord();
    };

    const finalizeUtterance = async (utt: {
      speakerName: string;
      text: string;
      startTime: number;
      endTime: number;
      confidence: number;
    }) => {
      if (session.stopped) return;
      let id = `tmp-${Date.now()}`;
      try {
        if (session.meetingId) {
          const saved = await prisma.transcriptSegment.create({
            data: {
              meetingId: session.meetingId,
              speakerName: utt.speakerName,
              text: utt.text,
              startTime: utt.startTime,
              endTime: utt.endTime,
              confidence: utt.confidence,
            },
          });
          id = saved.id;
        }
      } catch {
        /* meeting may be ad-hoc; still stream to UI */
      }
      send(ws, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
        id,
        meetingId: session.meetingId,
        speakerName: utt.speakerName,
        text: utt.text,
        startTime: utt.startTime,
        endTime: utt.endTime,
        confidence: utt.confidence,
        isFinal: true,
      });
      // Pause between speakers, then continue.
      session.gapTimer = setTimeout(speakUtterance, 500 + Math.random() * 400);
    };

    const startSimulation = async (meetingId: string) => {
      session.meetingId = meetingId;
      session.simulator = new TranscriptSimulator();
      session.stopped = false;
      send(ws, SOCKET_EVENTS.MEETING_STATUS, {
        meetingId,
        status: "RECORDING",
        engine: hasDeepgram ? "deepgram" : "simulated",
        state: "live",
      });
      send(ws, SOCKET_EVENTS.RECORDING_WARNING, {
        message:
          "Recording active. Ensure all participants have consented per your workspace policy.",
      });
      clearTimers();
      speakUtterance();
    };

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case SOCKET_EVENTS.MEETING_START: {
          const meetingId = (msg.payload?.meetingId as string) ?? "";
          if (meetingId) {
            await prisma.meeting
              .update({
                where: { id: meetingId },
                data: { status: "RECORDING", startedAt: new Date() },
              })
              .catch(() => null);
          }
          await startSimulation(meetingId);
          break;
        }
        case SOCKET_EVENTS.MEETING_STOP: {
          session.stopped = true;
          clearTimers();
          send(ws, SOCKET_EVENTS.MEETING_STATUS, {
            meetingId: session.meetingId,
            status: "PROCESSING",
            state: "finalized",
          });
          break;
        }
        case SOCKET_EVENTS.TRANSCRIPT_AUDIO_CHUNK: {
          // Real audio bytes would be forwarded to Deepgram/Whisper here.
          break;
        }
        case SOCKET_EVENTS.AI_ASK_LIVE: {
          const question = (msg.payload?.question as string) ?? "";
          // Honest gating: never fabricate a "real" AI answer when no key is set.
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
    });
    ws.on("error", () => {
      session.stopped = true;
      clearTimers();
    });
  });

  return wss;
}
