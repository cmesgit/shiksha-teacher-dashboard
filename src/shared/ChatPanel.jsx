// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/ChatPanel.jsx   (replace whole file)
//   teacher_ui/src/shared/ChatPanel.jsx          (replace whole file)
//
// WHAT CHANGED vs the previous version:
//   • FILTER TABS (All / Academy / Skill Dev / Guest Expert / Faculty) over the
//     conversation list, driven by each counterpart's roles.
//   • "New message" (+) opens a PEOPLE DIRECTORY modal (listed guest experts +
//     approved faculty) with search; picking someone starts a 1:1.
//   • BLOCK / UNBLOCK button in the thread header, shown only when the platform
//     rule allows it (students can't block faculty/experts — server-enforced too).
//     A thread you've blocked disables the composer.
//   • MODERATION / BLOCK feedback: rejected sends (vulgar / political / blocked)
//     come back as an "error" frame; the optimistic bubble is removed and a toast
//     explains why.
//   • In a COURSE ROOM you can click a sender's name to open a 1:1 with them.
// The auto-open effect still keys off primitive target values so it doesn't
// reset the thread on every parent re-render.
/* shared/ChatPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Dashboard chat UI for both student & teacher apps. Two-pane: conversation
 * list + active thread. Live over websocket (shared/chatClient.js); REST for
 * history, the conversation list, the directory and blocking. Identity is
 * whatever context is active (a learner profile, or the teacher identity) —
 * resolved server-side.
 *
 * Usage:
 *   <ChatPanel />                                    // full inbox
 *   <ChatPanel directTo={{ kind:"TEACHER", id }} />  // open/start a 1:1
 *   <ChatPanel courseRoom={{ id, title }} />         // open a course room
 *   <ChatPanel directTo={{...}} initialDraft="Hi…" />// pre-fill the composer
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { ChatAPI, openChatSocket } from "./chatClient";
import "./ChatPanel.css";

const uid = () => Math.random().toString(36).slice(2);

const TABS = [
  { key: "all", label: "All" },
  { key: "academy", label: "Academy" },
  { key: "skilldev", label: "Skill Dev" },
  { key: "guest", label: "Guest Expert" },
  { key: "faculty", label: "Faculty" },
];

const ROLE_LABEL = {
  faculty: "Faculty",
  guest: "Guest expert",
  academy: "Academy student",
  skilldev: "Skill Dev student",
};

function rolesLabel(roles) {
  if (!roles || !roles.length) return "";
  if (roles.includes("faculty") && roles.includes("guest")) return "Faculty · Guest expert";
  return roles.map((r) => ROLE_LABEL[r] || r).join(" · ");
}

// "L:<uuid>" -> { kind:"LEARNER", id:"<uuid>" } ; "T:<uuid>" -> TEACHER
function parseIdentity(identity) {
  if (!identity || identity === "me") return null;
  const idx = identity.indexOf(":");
  if (idx < 0) return null;
  const p = identity.slice(0, idx);
  const id = identity.slice(idx + 1);
  if (p === "L") return { kind: "LEARNER", id };
  if (p === "T") return { kind: "TEACHER", id };
  return null;
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

export default function ChatPanel({ directTo, courseRoom, initialDraft = "" }) {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typingName, setTypingName] = useState("");
  const [tab, setTab] = useState("all");

  // toast (moderation / block feedback)
  const [toast, setToast] = useState(null); // { text, kind: "err"|"ok" }
  const toastTimer = useRef(null);

  // directory modal
  const [dirOpen, setDirOpen] = useState(false);
  const [dirItems, setDirItems] = useState([]);
  const [dirQuery, setDirQuery] = useState("");
  const [dirLoading, setDirLoading] = useState(false);

  const sockRef = useRef(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const seededDraft = useRef(false);

  const pushToast = useCallback((text, kind = "err") => {
    setToast({ text, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Seed the composer once from initialDraft (e.g. a message typed on the
  // public landing page and carried here via the redirect query string).
  useEffect(() => {
    if (initialDraft && !seededDraft.current) {
      seededDraft.current = true;
      setDraft(initialDraft);
    }
  }, [initialDraft]);

  const loadConversations = useCallback(async () => {
    try { setConversations(await ChatAPI.conversations()); } catch { /* */ }
  }, []);

  // Initial load + optional auto-open of a direct/course conversation.
  // Depend on PRIMITIVE target values (not the object literals callers pass),
  // otherwise this re-runs every parent render and resets the thread.
  useEffect(() => {
    (async () => {
      await loadConversations();
      try {
        if (directTo) setActive(await ChatAPI.startDirect(directTo.kind, directTo.id));
        else if (courseRoom) setActive(await ChatAPI.courseRoom(courseRoom.id, courseRoom.title));
      } catch { /* */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations, directTo?.kind, directTo?.id, courseRoom?.id, courseRoom?.title]);

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
      onError: (data) => {
        // A rejected send (vulgar / political / blocked). Drop the optimistic
        // bubble it refers to, and explain why.
        if (data?.client_id) {
          setMessages((prev) => prev.filter((x) => x.client_id !== data.client_id));
        }
        pushToast(data?.reason || "Message couldn't be sent.", "err");
      },
    });
    sockRef.current = sock;
    ChatAPI.markRead(active.id).catch(() => {});
    return () => sock.close();
  }, [active, loadConversations, pushToast]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Directory fetch (debounced) while the modal is open.
  useEffect(() => {
    if (!dirOpen) return;
    let alive = true;
    setDirLoading(true);
    const t = setTimeout(async () => {
      try {
        const items = await ChatAPI.directory(dirQuery.trim());
        if (alive) setDirItems(items);
      } catch {
        if (alive) setDirItems([]);
      } finally {
        if (alive) setDirLoading(false);
      }
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [dirOpen, dirQuery]);

  const myIdentity = active?.me?.identity;
  const isMine = (m) =>
    m._pending || m.sender?.identity === "me" ||
    (myIdentity && m.sender?.identity === myIdentity);

  const iBlocked = !!active?.blocking?.i_blocked;

  // Manually select a conversation from the list (clears any seeded draft).
  const selectConversation = (c) => { setActive(c); setDraft(""); };

  const send = () => {
    const body = draft.trim();
    if (!body || !sockRef.current || iBlocked) return;
    const client_id = uid();
    setMessages((prev) => [...prev, {
      id: client_id, client_id, body, created_at: new Date().toISOString(),
      sender: { name: "You", identity: "me" }, _pending: true,
    }]);
    sockRef.current.send(body, client_id);
    setDraft("");
  };

  // Re-pull the list and refresh the active conversation (picks up new
  // blocking state and freshly created threads).
  const refreshActive = useCallback(async () => {
    try {
      const list = await ChatAPI.conversations();
      setConversations(list);
      setActive((cur) => (cur ? (list.find((c) => c.id === cur.id) || cur) : cur));
    } catch { /* */ }
  }, []);

  const startWith = async (target_kind, target_id) => {
    try {
      const conv = await ChatAPI.startDirect(target_kind, target_id);
      setDirOpen(false);
      setDirQuery("");
      setDraft("");
      await loadConversations();
      setActive(conv);
    } catch (e) {
      pushToast(e?.response?.data?.target_id || "Couldn't start that chat.", "err");
    }
  };

  const dmFromRoom = (identity) => {
    const ident = parseIdentity(identity);
    if (ident) startWith(ident.kind, ident.id);
  };

  const toggleBlock = async () => {
    const cp = active?.counterpart;
    if (!cp) return;
    const ident = parseIdentity(cp.identity);
    if (!ident) return;
    try {
      if (active.blocking?.i_blocked) {
        await ChatAPI.unblock(ident.kind, ident.id);
        pushToast(`Unblocked ${cp.name}.`, "ok");
      } else {
        await ChatAPI.block(ident.kind, ident.id);
        pushToast(`Blocked ${cp.name}. They can no longer message you.`, "ok");
      }
      await refreshActive();
    } catch (e) {
      pushToast(e?.response?.data?.detail || "Couldn't update block.", "err");
    }
  };

  const visible = conversations.filter((c) => {
    if (tab === "all") return true;
    if (c.kind !== "DIRECT") return false; // course rooms only under "All"
    return (c.counterpart?.roles || []).includes(tab);
  });

  return (
    <div className="cp-root">
      <aside className="cp-list">
        <div className="cp-list-head">
          <span>Messages</span>
          <button className="cp-newbtn" title="New message" onClick={() => setDirOpen(true)}>＋</button>
        </div>

        <div className="cp-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={"cp-tab" + (tab === t.key ? " cp-tab-active" : "")}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="cp-empty">
            {conversations.length === 0 ? "No conversations yet." : "Nothing under this filter."}
          </div>
        )}
        {visible.map((c) => {
          const label = c.kind === "DIRECT" ? rolesLabel(c.counterpart?.roles) : "Group room";
          return (
            <button
              key={c.id}
              className={"cp-conv" + (active?.id === c.id ? " cp-conv-active" : "")}
              onClick={() => selectConversation(c)}
            >
              <div className="cp-conv-title">
                {c.title || "Conversation"}
                {c.unread > 0 && <span className="cp-badge">{c.unread}</span>}
              </div>
              {label && <div className="cp-conv-role">{label}</div>}
              <div className="cp-conv-last">{c.last_message?.body || "—"}</div>
            </button>
          );
        })}
      </aside>

      <section className="cp-thread">
        {!active ? (
          <div className="cp-placeholder">Select a conversation</div>
        ) : (
          <>
            <header className="cp-thread-head">
              <div className="cp-thread-id">
                <div className="cp-thread-title">{active.title || "Conversation"}</div>
                {active.kind === "DIRECT" && active.counterpart && (
                  <div className="cp-thread-role">{rolesLabel(active.counterpart.roles)}</div>
                )}
              </div>
              {active.kind === "DIRECT" && active.can_block && (
                <button
                  className={"cp-block" + (iBlocked ? " cp-block-on" : "")}
                  onClick={toggleBlock}
                >
                  {iBlocked ? "Unblock" : "Block"}
                </button>
              )}
            </header>

            <div className="cp-messages">
              {messages.map((m) => {
                const mine = isMine(m);
                const inRoom = active.kind === "COURSE";
                return (
                  <div key={m.id} className={"cp-msg" + (mine ? " cp-msg-mine" : "")}>
                    {!mine && (
                      inRoom && m.sender?.identity ? (
                        <button
                          className="cp-msg-sender cp-msg-sender-btn"
                          title="Message privately"
                          onClick={() => dmFromRoom(m.sender.identity)}
                        >
                          {m.sender?.name}
                        </button>
                      ) : (
                        <div className="cp-msg-sender">{m.sender?.name}</div>
                      )
                    )}
                    <div className="cp-bubble">{m.body}</div>
                  </div>
                );
              })}
              {typingName && <div className="cp-typing">{typingName} is typing…</div>}
              <div ref={endRef} />
            </div>

            {iBlocked ? (
              <div className="cp-blocked-note">
                You’ve blocked this person. Unblock to send messages.
              </div>
            ) : (
              <div className="cp-composer">
                <input
                  value={draft}
                  placeholder="Type a message…"
                  onChange={(e) => { setDraft(e.target.value); sockRef.current?.typing(); }}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button onClick={send} disabled={!draft.trim()}>Send</button>
              </div>
            )}
          </>
        )}
      </section>

      {dirOpen && (
        <div className="cp-modal-backdrop" onClick={() => setDirOpen(false)}>
          <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-head">
              <span>New message</span>
              <button className="cp-modal-x" onClick={() => setDirOpen(false)}>×</button>
            </div>
            <input
              className="cp-modal-search"
              autoFocus
              value={dirQuery}
              placeholder="Search experts & faculty…"
              onChange={(e) => setDirQuery(e.target.value)}
            />
            <div className="cp-modal-list">
              {dirLoading && <div className="cp-modal-empty">Searching…</div>}
              {!dirLoading && dirItems.length === 0 && (
                <div className="cp-modal-empty">No one found.</div>
              )}
              {!dirLoading && dirItems.map((p) => (
                <button
                  key={p.target_id}
                  className="cp-dir-item"
                  onClick={() => startWith(p.target_kind, p.target_id)}
                >
                  <span className="cp-dir-av">
                    {p.avatar ? <img src={p.avatar} alt="" /> : initials(p.name)}
                  </span>
                  <span className="cp-dir-meta">
                    <span className="cp-dir-name">{p.name}</span>
                    <span className="cp-dir-sub">{p.subtitle || p.role_label}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="cp-modal-foot">
              To reach a student, reply to their message or message them from a course room.
            </div>
          </div>
        </div>
      )}

      {toast && <div className={"cp-toast cp-toast-" + toast.kind}>{toast.text}</div>}
    </div>
  );
}
