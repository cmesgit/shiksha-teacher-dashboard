// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/chatClient.js   (replace whole file)
//   teacher_ui/src/shared/chatClient.js          (replace whole file)
//
// WHAT CHANGED vs the previous version:
//   • ChatAPI gains directory()/blocks()/block()/unblock() for the new
//     "start a chat" people directory and the block/unblock controls.
//   • openChatSocket now surfaces server "error" frames (moderation rejection
//     or a block) via handlers.onError, so the UI can drop the rejected
//     optimistic bubble and show a reason.
// Everything else (keepalive ping, send queue, reconnect backoff, WS host
// following config/urls.js) is unchanged.
/* shared/chatClient.js
 *
 * The socket was previously idle-killed (no keepalive) and a send issued while
 * mid-reconnect was silently dropped. Fixes retained here:
 *   1. KEEPALIVE: ping every 25s so proxies/Nginx don't idle-close it.
 *   2. SEND QUEUE: if the socket isn't OPEN, queue and flush on reconnect.
 *   3. Heartbeat-driven reconnect with exponential backoff.
 *
 * Backend note: the consumer ignores unknown message types, so {"type":"ping"}
 * is harmless.
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

  // --- NEW: start-a-new-chat directory (listed experts + approved faculty) ---
  directory: (q) =>
    api.get("/chat/directory/", { params: q ? { q } : {} }).then((r) => r.data),

  // --- NEW: blocking ---
  blocks: () => api.get("/chat/blocks/").then((r) => r.data),
  block: (target_kind, target_id) =>
    api.post("/chat/blocks/", { target_kind, target_id }).then((r) => r.data),
  unblock: (target_kind, target_id) =>
    api.post("/chat/blocks/remove/", { target_kind, target_id }).then((r) => r.data),
};

const PING_MS = 25000;

export function openChatSocket(conversationId, handlers = {}) {
  // Same environment resolution as the rest of the app (config/urls.js):
  // WS_HOST is the correct host per environment; the scheme follows API_URL.
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
      else if (payload.type === "error") handlers.onError?.(payload.data);
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
