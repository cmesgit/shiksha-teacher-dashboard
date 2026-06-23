/* shared/chatClient.js — REST + websocket helpers for the dashboard chat.
 * The websocket reuses the cookie session (no token in URL); the backend's
 * JWTAuthMiddleware reads the `access` cookie. Reconnects with backoff.
 */
import api from "./apiClient";

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

export function openChatSocket(conversationId, handlers = {}) {
  const apiUrl = import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api";
  const wsBase = apiUrl.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  let ws, closedByUs = false, attempt = 0;

  const connect = () => {
    ws = new WebSocket(`${wsBase}/ws/chat/${conversationId}/`);
    ws.onopen = () => { attempt = 0; handlers.onOpen?.(); };
    ws.onmessage = (e) => {
      let payload; try { payload = JSON.parse(e.data); } catch { return; }
      if (payload.type === "history") handlers.onHistory?.(payload.data);
      else if (payload.type === "message") handlers.onMessage?.(payload.data);
      else if (payload.type === "typing") handlers.onTyping?.(payload.data);
    };
    ws.onclose = () => {
      if (closedByUs) return;
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      setTimeout(connect, delay);
    };
  };
  connect();

  return {
    send: (body, client_id) => ws?.readyState === 1 &&
      ws.send(JSON.stringify({ type: "message", body, client_id })),
    typing: () => ws?.readyState === 1 && ws.send(JSON.stringify({ type: "typing" })),
    read: () => ws?.readyState === 1 && ws.send(JSON.stringify({ type: "read" })),
    close: () => { closedByUs = true; ws?.close(); },
  };
}
