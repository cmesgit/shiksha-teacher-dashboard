// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/chatClient.js   (replace whole file)
//   teacher_ui/src/shared/chatClient.js          (replace whole file)
//
// Communication Center closure (Stages A–E). WHAT CHANGED vs the previous
// version:
//   • ChatAPI grows one method per new backend endpoint: conversation
//     actions (pin/archive/mute/report), reactions, delete, attachment
//     upload, members, per-conversation + global search, course-hub
//     composition (resources/assignments/announcements), support tickets,
//     and communication preferences.
//   • openChatSocket() surfaces four new server event types
//     (reaction / message_deleted / read / presence) via new handler
//     callbacks, and can now send a `reply_to` alongside a message.
// Everything that already worked (keepalive ping, send queue, reconnect
// backoff, history/message/typing/error handling) is UNCHANGED.
/* shared/chatClient.js
 *
 * KEEPALIVE / RECONNECT
 *   1. KEEPALIVE: ping every 25s so proxies/Nginx don't idle-close it (also
 *      refreshes the server's presence TTL — see chat/redis_utils.py).
 *   2. SEND QUEUE: if the socket isn't OPEN, queue and flush on reconnect.
 *   3. Heartbeat-driven reconnect with exponential backoff.
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

  // --- start-a-new-chat directory (listed experts + approved faculty) ---
  directory: (q) =>
    api.get("/chat/directory/", { params: q ? { q } : {} }).then((r) => r.data),

  // --- CC-019 profile ---
  profile: (kind, id) => api.get(`/chat/profile/${kind}/${id}/`).then((r) => r.data),

  // --- blocking ---
  blocks: () => api.get("/chat/blocks/").then((r) => r.data),
  block: (target_kind, target_id) =>
    api.post("/chat/blocks/", { target_kind, target_id }).then((r) => r.data),
  unblock: (target_kind, target_id) =>
    api.post("/chat/blocks/remove/", { target_kind, target_id }).then((r) => r.data),

  // --- Stage B: conversation management (CC-006) ---
  pin: (id, pinned) => api.post(`/chat/conversations/${id}/pin/`, pinned === undefined ? {} : { pinned }).then((r) => r.data),
  archive: (id, archived) => api.post(`/chat/conversations/${id}/archive/`, archived === undefined ? {} : { archived }).then((r) => r.data),
  mute: (id, opts) => api.post(`/chat/conversations/${id}/mute/`, opts).then((r) => r.data),
  reportConversation: (id, { message_id, reason, detail } = {}) =>
    api.post(`/chat/conversations/${id}/report/`, { message_id, reason, detail }).then((r) => r.data),

  // --- Stage B: reactions + delete (CC-007/010) ---
  react: (messageId, emoji) => api.post(`/chat/messages/${messageId}/react/`, { emoji }).then((r) => r.data),
  deleteMessage: (messageId) => api.post(`/chat/messages/${messageId}/delete/`).then((r) => r.data),

  // --- Stage C: attachments, members, search (CC-012/014/016/002) ---
  uploadAttachment: (conversationId, file, { caption, reply_to } = {}, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    if (caption) form.append("caption", caption);
    if (reply_to) form.append("reply_to", reply_to);
    return api
      .post(`/chat/conversations/${conversationId}/attachments/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: onProgress
          ? (evt) => onProgress(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0)
          : undefined,
      })
      .then((r) => r.data);
  },
  members: (id) => api.get(`/chat/conversations/${id}/members/`).then((r) => r.data),
  sharedFiles: (id) => api.get(`/chat/conversations/${id}/attachments/`).then((r) => r.data),
  searchInConversation: (id, q) => api.get(`/chat/conversations/${id}/search/`, { params: { q } }).then((r) => r.data),
  searchAll: (q) => api.get("/chat/search/", { params: { q } }).then((r) => r.data),

  // --- Stage C: Course Hub composition (CC-013) ---
  courseResources: (courseId) => api.get(`/chat/course/${courseId}/resources/`).then((r) => r.data),
  courseAssignments: (courseId) => api.get(`/chat/course/${courseId}/assignments/`).then((r) => r.data),

  // --- Stage D: Announcements (CC-015) ---
  announcements: (courseId) => api.get(`/chat/course/${courseId}/announcements/`).then((r) => r.data),
  postAnnouncement: (courseId, body) => api.post(`/chat/course/${courseId}/announcements/`, { body }).then((r) => r.data),

  // --- Stage D: Academic Support tickets (CC-022) ---
  supportTickets: () => api.get("/chat/support/tickets/").then((r) => r.data),
  createSupportTicket: (subject, category, message) =>
    api.post("/chat/support/tickets/", { subject, category, message }).then((r) => r.data),
  supportTicketMessages: (id) => api.get(`/chat/support/tickets/${id}/messages/`).then((r) => r.data),
  replySupportTicket: (id, message) => api.post(`/chat/support/tickets/${id}/reply/`, { message }).then((r) => r.data),
  closeSupportTicket: (id) => api.post(`/chat/support/tickets/${id}/close/`).then((r) => r.data),

  // --- Stage E: communication preferences (CC-020/021) ---
  getPreferences: () => api.get("/chat/preferences/").then((r) => r.data),
  updatePreferences: (data) => api.put("/chat/preferences/", data).then((r) => r.data),
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
  let reconnectTimer = null;
  let hasConnectedBefore = false; // true from the 2nd successful open onward
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
      // isReconnect lets the caller distinguish "just opened for the first
      // time" (REST history already covers everything) from "reopened
      // after a drop" (messages sent during the gap need to be fetched —
      // the server's "history" frame below is always just the last 30 with
      // no cursor, not a real resume mechanism).
      const isReconnect = hasConnectedBefore;
      hasConnectedBefore = true;
      handlers.onOpen?.({ isReconnect });
    };

    ws.onmessage = (e) => {
      let payload; try { payload = JSON.parse(e.data); } catch { return; }
      if (payload.type === "history") handlers.onHistory?.(payload.data);
      else if (payload.type === "message") handlers.onMessage?.(payload.data);
      else if (payload.type === "typing") handlers.onTyping?.(payload.data);
      else if (payload.type === "error") handlers.onError?.(payload.data);
      else if (payload.type === "reaction") handlers.onReaction?.(payload.data);
      else if (payload.type === "message_deleted") handlers.onMessageDeleted?.(payload.data);
      else if (payload.type === "read") handlers.onRead?.(payload.data);
      else if (payload.type === "presence") handlers.onPresence?.(payload.data);
      // "pong" (if the server ever sends one) is ignored.
    };

    ws.onclose = () => {
      stopPing();
      if (closedByUs) return;
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      reconnectTimer = setTimeout(connect, delay);
      handlers.onDisconnect?.();
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
    send: (body, client_id, reply_to) => sendFrame({ type: "message", body, client_id, reply_to }),
    typing: () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "typing" })); },
    read: () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "read" })); },
    isOpen: () => !!ws && ws.readyState === 1,
    close: () => {
      closedByUs = true;
      stopPing();
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      ws?.close();
    },
  };
}
