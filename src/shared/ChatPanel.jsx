/* shared/ChatPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Dashboard chat UI for both student & teacher apps. Two-pane: conversation
 * list + active thread. Live over websocket (shared/chatClient.js); REST for
 * history & conversation list. Identity is whatever context is active
 * (a learner profile, or the teacher identity) — handled server-side.
 *
 * Usage:
 *   <ChatPanel />                          // full inbox
 *   <ChatPanel directTo={{ kind:"TEACHER", id }} />  // open/start a 1:1
 *   <ChatPanel courseRoom={{ id, title }} />         // open a course room
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { ChatAPI, openChatSocket } from "./chatClient";
import "./ChatPanel.css";

const uid = () => Math.random().toString(36).slice(2);

export default function ChatPanel({ directTo, courseRoom }) {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typingName, setTypingName] = useState("");
  const sockRef = useRef(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  const loadConversations = useCallback(async () => {
    try { setConversations(await ChatAPI.conversations()); } catch { /* */ }
  }, []);

  // Initial load + optional auto-open of a direct/course conversation.
  useEffect(() => {
    (async () => {
      await loadConversations();
      try {
        if (directTo) setActive(await ChatAPI.startDirect(directTo.kind, directTo.id));
        else if (courseRoom) setActive(await ChatAPI.courseRoom(courseRoom.id, courseRoom.title));
      } catch { /* */ }
    })();
  }, [loadConversations, directTo, courseRoom]);

  // Wire websocket whenever the active conversation changes.
  useEffect(() => {
    if (!active) return;
    sockRef.current?.close();
    setMessages([]);
    const sock = openChatSocket(active.id, {
      onHistory: (data) => setMessages(data),
      onMessage: (m) => {
        setMessages((prev) => {
          // de-dupe by client_id (our own optimistic echoes) or id.
          if (prev.some((x) => (m.client_id && x.client_id === m.client_id) || x.id === m.id)) {
            return prev.map((x) =>
              (m.client_id && x.client_id === m.client_id) ? m : x
            );
          }
          return [...prev, m];
        });
        loadConversations();
      },
      onTyping: (t) => {
        setTypingName(t.name);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingName(""), 2500);
      },
    });
    sockRef.current = sock;
    ChatAPI.markRead(active.id).catch(() => {});
    return () => sock.close();
  }, [active, loadConversations]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    const body = draft.trim();
    if (!body || !sockRef.current) return;
    const client_id = uid();
    // optimistic
    setMessages((prev) => [...prev, {
      id: client_id, client_id, body, created_at: new Date().toISOString(),
      sender: { name: "You", identity: "me" }, _pending: true,
    }]);
    sockRef.current.send(body, client_id);
    setDraft("");
  };

  return (
    <div className="cp-root">
      <aside className="cp-list">
        <div className="cp-list-head">Messages</div>
        {conversations.length === 0 && <div className="cp-empty">No conversations yet.</div>}
        {conversations.map((c) => (
          <button
            key={c.id}
            className={"cp-conv" + (active?.id === c.id ? " cp-conv-active" : "")}
            onClick={() => setActive(c)}
          >
            <div className="cp-conv-title">
              {c.title || "Conversation"}
              {c.unread > 0 && <span className="cp-badge">{c.unread}</span>}
            </div>
            <div className="cp-conv-last">{c.last_message?.body || "—"}</div>
          </button>
        ))}
      </aside>

      <section className="cp-thread">
        {!active ? (
          <div className="cp-placeholder">Select a conversation</div>
        ) : (
          <>
            <header className="cp-thread-head">{active.title || "Conversation"}</header>
            <div className="cp-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={"cp-msg" + (m.sender?.identity === "me" || m._pending ? " cp-msg-mine" : "")}
                >
                  {m.sender?.identity !== "me" && !m._pending && (
                    <div className="cp-msg-sender">{m.sender?.name}</div>
                  )}
                  <div className="cp-bubble">{m.body}</div>
                </div>
              ))}
              {typingName && <div className="cp-typing">{typingName} is typing…</div>}
              <div ref={endRef} />
            </div>
            <div className="cp-composer">
              <input
                value={draft}
                placeholder="Type a message…"
                onChange={(e) => { setDraft(e.target.value); sockRef.current?.typing(); }}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button onClick={send} disabled={!draft.trim()}>Send</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
