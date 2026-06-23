import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { SOCKET_EVENTS } from "@aurora/shared";
import { verifyAccessToken, type TokenPayload } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";
import { TranscriptSimulator } from "../services/transcript.simulator.js";
import { generateLiveSuggestion } from "../services/ai.service.js";
import { hasDeepgram } from "../config/env.js";

interface ClientMessage {
  type: string;
  payload?: Record<string, unknown>;
}

interface Session {
  meetingId: string;
  simulator: TranscriptSimulator;
  timer: NodeJS.Timeout | null;
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
      timer: null,
    };

    const stopSim = () => {
      if (session.timer) {
        clearInterval(session.timer);
        session.timer = null;
      }
    };

    const startSimulation = async (meetingId: string) => {
      session.meetingId = meetingId;
      session.simulator = new TranscriptSimulator();
      send(ws, SOCKET_EVENTS.MEETING_STATUS, {
        meetingId,
        status: "RECORDING",
        engine: hasDeepgram ? "deepgram" : "simulated",
      });
      send(ws, SOCKET_EVENTS.RECORDING_WARNING, {
        message:
          "Recording active. Ensure all participants have consented per your workspace policy.",
      });

      stopSim();
      session.timer = setInterval(async () => {
        if (!session.simulator.hasMore()) {
          stopSim();
          send(ws, SOCKET_EVENTS.MEETING_STATUS, {
            meetingId,
            status: "PROCESSING",
          });
          return;
        }
        const seg = session.simulator.next();
        // Emit a partial first for realism, then the final segment.
        send(ws, SOCKET_EVENTS.TRANSCRIPT_PARTIAL, {
          meetingId,
          speakerName: seg.speakerName,
          text: seg.text.slice(0, Math.ceil(seg.text.length / 2)),
        });
        try {
          const saved = await prisma.transcriptSegment.create({
            data: {
              meetingId,
              speakerName: seg.speakerName,
              text: seg.text,
              startTime: seg.startTime,
              endTime: seg.endTime,
              confidence: seg.confidence,
            },
          });
          send(ws, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
            id: saved.id,
            meetingId,
            speakerName: saved.speakerName,
            text: saved.text,
            startTime: saved.startTime,
            endTime: saved.endTime,
            confidence: saved.confidence,
          });
        } catch {
          // Meeting may not exist (e.g. ad-hoc); still stream to UI.
          send(ws, SOCKET_EVENTS.TRANSCRIPT_SEGMENT, {
            id: `tmp-${Date.now()}`,
            meetingId,
            speakerName: seg.speakerName,
            text: seg.text,
            startTime: seg.startTime,
            endTime: seg.endTime,
            confidence: seg.confidence,
          });
        }
      }, 3500);
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
          stopSim();
          send(ws, SOCKET_EVENTS.MEETING_STATUS, {
            meetingId: session.meetingId,
            status: "PROCESSING",
          });
          break;
        }
        case SOCKET_EVENTS.TRANSCRIPT_AUDIO_CHUNK: {
          // Real audio bytes would be forwarded to Deepgram/Whisper here.
          // In simulation mode we ignore the bytes and rely on the timer.
          break;
        }
        case SOCKET_EVENTS.AI_ASK_LIVE: {
          const question = (msg.payload?.question as string) ?? "";
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
          send(ws, SOCKET_EVENTS.AI_SUGGESTION, { question, suggestion });
          break;
        }
        default:
          break;
      }
    });

    ws.on("close", () => stopSim());
    ws.on("error", () => stopSim());
  });

  return wss;
}
