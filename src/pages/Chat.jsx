// teacher_dashboard/src/pages/Chat.jsx
//
// Teacher Messages. Rebuilt to match the design handoff's flat two-pane
// Messages screen (Academy Dashboard.dc.html, data-screen-label="Messages"):
// a searchable thread list on the left, the open thread + composer on the
// right — no category sidebar, directory, notifications, settings or
// support tabs (the design has none of those). Real backend underneath is
// unchanged: GET /chat/conversations/, REST history, and the existing WS
// protocol in shared/chatClient.js.
//
// This intentionally does NOT reuse shared/ChatPanel.jsx — that file still
// powers pages/SkillInbox.jsx (Skill Dev's Expert inbox, out of scope for
// this design pass) with its full category-sidebar hub. Gutting it here
// would have regressed that screen too, so it and shared/comm/* are left
// untouched; only the three stateless helpers below are reused from there.
//
// Navigation contract (unchanged):
//   navigate("/teacher/chat")                                        → inbox
//   navigate("/teacher/chat", { state: { learnerId } })              → DM a student
//   navigate("/teacher/chat", { state: { courseId, courseTitle } })  → a course room
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiChevronLeft } from "react-icons/fi";
import { ChatAPI, openChatSocket } from "../shared/chatClient";
import { initials, formatClock, rolesLabel } from "../shared/comm/common";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import "../styles/messages.css";

const uid = () => Math.random().toString(36).slice(2);
const COMPACT_BREAKPOINT = 860;

function subtitleFor(conv) {
  if (!conv) return "";
  if (conv.kind === "DIRECT") {
    const role = rolesLabel(conv.counterpart?.roles);
    return conv.course ? `${role} · ${conv.course.title}` : role;
  }
  if (conv.kind === "ROOM") return conv.course ? `Class discussion · ${conv.course.title}` : "Class discussion";
  if (conv.kind === "BROADCAST") return "Announcements";
  return "";
}

function useCompact() {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < COMPACT_BREAKPOINT
  );
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < COMPACT_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return compact;
}

export default function Chat() {
  const { state } = useLocation();
  const directTo = state?.learnerId ? { kind: "LEARNER", id: state.learnerId } : undefined;
  const courseRoom = state?.courseId ? { id: state.courseId, title: state.courseTitle || "" } : undefined;
  const compact = useCompact();

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [q, setQ] = useState("");

  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState("");

  const sockRef = useRef(null);
  const seeded = useRef(false);
  const scrollRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      setConvError(false);
      setConversations(await ChatAPI.conversations());
    } catch {
      setConvError(true);
    }
    setConvLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Resolve directTo / courseRoom exactly once, on first mount — same
  // contract the previous ChatPanel honored.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    (async () => {
      try {
        let conv = null;
        if (directTo) conv = await ChatAPI.startDirect(directTo.kind, directTo.id);
        else if (courseRoom) conv = await ChatAPI.courseRoom(courseRoom.id, courseRoom.title);
        if (conv) {
          setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
          setActiveId(conv.id);
        }
      } catch { /* the list still loads below */ }
      loadConversations();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directTo?.kind, directTo?.id, courseRoom?.id, courseRoom?.title]);

  const active = conversations.find((c) => c.id === activeId) || null;

  // Load history + open the socket whenever the active conversation changes.
  useEffect(() => {
    if (!active?.id) { setMessages([]); return undefined; }
    let alive = true;
    setMsgLoading(true);
    setMessages([]);

    (async () => {
      try {
        const msgs = await ChatAPI.messages(active.id, { limit: 40 });
        if (alive) setMessages(msgs);
      } catch { /* the socket's history frame still populates it */ }
      if (alive) setMsgLoading(false);
    })();

    sockRef.current?.close();
    const sock = openChatSocket(active.id, {
      onHistory: (data) => { setMessages((prev) => (prev.length ? prev : data)); setMsgLoading(false); },
      onMessage: (m) => {
        setMessages((prev) => {
          const idx = prev.findIndex((x) => (m.client_id && x.client_id === m.client_id) || x.id === m.id);
          if (idx === -1) return [...prev, m];
          const next = prev.slice();
          next[idx] = m;
          return next;
        });
      },
    });
    sockRef.current = sock;
    ChatAPI.markRead(active.id).catch(() => {});
    // Tell the global Messages badge (Header) to re-fetch its unread total.
    window.dispatchEvent(new Event("shiksha:messages-read"));
    return () => { alive = false; sock.close(); };
  }, [active?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const body = draft.trim();
    if (!body || active?.can_post === false) return;
    const client_id = uid();
    setMessages((prev) => [...prev, {
      id: client_id, client_id, body, created_at: new Date().toISOString(),
      sender: { name: "You", identity: "me" },
    }]);
    sockRef.current?.send(body, client_id);
    setDraft("");
  };

  const myIdentity = active?.me?.identity;
  const isMine = (m) => m.sender?.identity === "me" || (myIdentity && m.sender?.identity === myIdentity);

  const filtered = useMemo(() => {
    const list = conversations
      .filter((c) => c.kind !== "SUPPORT" && !c.archived)
      .slice()
      .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((c) => (c.title || c.counterpart?.name || "").toLowerCase().includes(needle));
  }, [conversations, q]);

  const showList = !compact || !activeId;
  const showThread = !compact || !!activeId;

  return (
    <div className="msgs-panel">
      {showList && (
        <aside className="msgs-list">
          <div className="msgs-list__head">Messages</div>
          <div className="msgs-list__searchWrap">
            <input
              className="msgs-list__search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search messages…"
            />
          </div>
          <div className="msgs-list__scroll">
            {convLoading ? (
              <LoadingState label="Loading messages" plain />
            ) : convError ? (
              <ErrorState message="Couldn't load your messages." onRetry={loadConversations} plain />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="inbox"
                title={q ? "No matches" : "No conversations yet"}
                message={q ? `Nothing matches "${q}".` : undefined}
                plain
              />
            ) : (
              filtered.map((c) => {
                const name = c.title || c.counterpart?.name || "Conversation";
                const preview = c.last_message
                  ? (c.last_message.deleted
                      ? "Message deleted"
                      : c.last_message.attachment
                      ? `Attachment: ${c.last_message.attachment.name}`
                      : c.last_message.body || "…")
                  : "No messages yet";
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={"msgs-row" + (c.id === activeId ? " msgs-row--active" : "")}
                    onClick={() => setActiveId(c.id)}
                  >
                    <span className="msgs-row__avatar">{initials(name)}</span>
                    <span className="msgs-row__body">
                      <span className="msgs-row__top">
                        <span className="msgs-row__name">{name}</span>
                        <span className="msgs-row__time">{formatClock(c.last_message_at)}</span>
                      </span>
                      <span className="msgs-row__preview">{preview}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}

      {showThread && (
        <div className="msgs-thread">
          {!active ? (
            <EmptyState icon="inbox" title="Select a conversation" message="Pick a thread on the left to read and reply." />
          ) : (
            <>
              <div className="msgs-thread__head">
                {compact && (
                  <button type="button" className="msgs-thread__back" onClick={() => setActiveId(null)}>
                    <FiChevronLeft size={18} />
                  </button>
                )}
                <div className="msgs-thread__headText">
                  <div className="msgs-thread__title">{active.title || active.counterpart?.name || "Conversation"}</div>
                  <div className="msgs-thread__sub">{subtitleFor(active)}</div>
                </div>
              </div>

              <div className="msgs-thread__scroll" ref={scrollRef}>
                {msgLoading ? (
                  <LoadingState label="Loading conversation" plain />
                ) : messages.length === 0 ? (
                  <div className="msgs-thread__empty">Say hello — this is the start of your conversation.</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={"msgs-bubbleRow" + (isMine(m) ? " msgs-bubbleRow--mine" : "")}>
                      <div className="msgs-bubble">{m.deleted ? "Message deleted" : m.body}</div>
                      <div className="msgs-bubble__time">{formatClock(m.created_at)}</div>
                    </div>
                  ))
                )}
              </div>

              {active.can_post === false ? (
                <div className="msgs-readonly">This conversation is read-only.</div>
              ) : (
                <div className="msgs-composer">
                  <input
                    className="msgs-composer__input"
                    value={draft}
                    placeholder="Type a message…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
                  />
                  <button type="button" className="msgs-composer__send" onClick={send} disabled={!draft.trim()}>
                    Send
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
