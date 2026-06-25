// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/chatClient.js   (replace whole file)
//   teacher_ui/src/shared/chatClient.js          (replace whole file)
// FIX: WS host now follows config/urls.js (WS_HOST) instead of a hardcoded
//      prod fallback, so the dev server connects to dev, not prod.
/* shared/chatClient.js — REPLACEMENT
 *
 * Fixes the "message disappears" bug. Root cause: the socket was idle-killed
 * (no keepalive), the client reconnected every few seconds, and a send issued
 * while the socket was mid-reconnect (readyState !== 1) was silently dropped —
 * so the message was never transmitted, never saved, and the next reconnect's
 * history overwrote the optimistic bubble.
 *
 * Changes:
 *   1. KEEPALIVE: send a ping every 25s so proxies/Nginx don't idle-close it.
 *   2. SEND QUEUE: if the socket isn't OPEN, queue the message and flush on
 *      reconnect instead of dropping it.
 *   3. Heartbeat-driven reconnect detection stays the same (exponential backoff).
 *
 * Backend note: the consumer ignores unknown message types, so a {"type":"ping"}
 * frame is harmless. (Optionally handle it explicitly in ChatConsumer.receive.)
 */
import api from "./apiClient";
import { API_URL, WS_HOST } from "../config/urls";

export const ChatAPI = {
  conversations: () => api.get("/chat/conversations/").then((r) => r.data),
  startDirect: (target_kind, target_id) =>
    api.post("/chat/conversations/direct/", { target_kind, target_id }).then((r) => r.data),
  courseRoom: (course_id, title) =>
    api.post("/chat/conversations/course/", { course_id, title }).then((r) => r.data),
  messages: (id, params = {}) =>
    api.get(`/chat/conversations/${id}/messages/`, { params }).then((r) => r.data),
  markRead: (id) => api.post(`/chat/conversations/${id}/read/`).then((r) => r.data),
};

const PING_MS = 25000;

export function openChatSocket(conversationId, handlers = {}) {
  // Use the SAME environment resolution as the rest of the app (config/urls.js):
  // WS_HOST is the correct host per environment (prod/dev/VITE override), and the
  // scheme follows API_URL (https -> wss). The old code re-derived this from
  // VITE_API_URL with a hardcoded prod fallback, so on the dev server (which has
  // no VITE_API_URL and relies on hostname detection) chat connected to PROD.
  const scheme = API_URL.startsWith("https") ? "wss" : "ws";
  const wsBase = `${scheme}://${WS_HOST}`;

  let ws;
  let closedByUs = false;
  let attempt = 0;
  let pingTimer = null;
  const outbox = []; // messages queued while not OPEN

  const startPing = () => {
    stopPing();
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === 1) {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }, PING_MS);
  };
  const stopPing = () => { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } };

  const flushOutbox = () => {
    while (outbox.length && ws && ws.readyState === 1) {
      ws.send(JSON.stringify(outbox.shift()));
    }
  };

  const connect = () => {
    ws = new WebSocket(`${wsBase}/ws/chat/${conversationId}/`);

    ws.onopen = () => {
      attempt = 0;
      startPing();
      flushOutbox();          // resend anything queued during the gap
      handlers.onOpen?.();
    };

    ws.onmessage = (e) => {
      let payload; try { payload = JSON.parse(e.data); } catch { return; }
      if (payload.type === "history") handlers.onHistory?.(payload.data);
      else if (payload.type === "message") handlers.onMessage?.(payload.data);
      else if (payload.type === "typing") handlers.onTyping?.(payload.data);
      // "pong" (if the server ever sends one) is ignored.
    };

    ws.onclose = () => {
      stopPing();
      if (closedByUs) return;
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => { try { ws.close(); } catch {} };
  };

  connect();

  const sendFrame = (frame) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(frame));
    } else {
      // queue instead of silently dropping — flushed on next onopen
      outbox.push(frame);
    }
  };

  return {
    send: (body, client_id) => sendFrame({ type: "message", body, client_id }),
    typing: () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "typing" })); },
    read: () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "read" })); },
    close: () => { closedByUs = true; stopPing(); ws?.close(); },
  };
}
