// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/ConversationList.jsx
//   teacher_ui/src/shared/comm/ConversationList.jsx
//
// CC-005/006. The inbox list: Pinned / Unread / Recent / Archived sections,
// each conversation rendered as a card with role/course badge, last-message
// preview, pin indicator, unread badge, and an on-hover action menu
// (Pin · Mute · Archive · Report).
import { useEffect, useMemo, useState } from "react";
import {
  FiPlus, FiSearch, FiMoreHorizontal, FiBookmark, FiVolumeX, FiArchive, FiFlag,
  FiChevronDown, FiChevronRight, FiPaperclip,
} from "react-icons/fi";
import { ChatAPI } from "../chatClient";
import { Avatar, timeAgo, rolesLabel, categoryLabel, EmptyState, SkeletonRows } from "./common";

function CardMenu({ conv, onChanged, onClose }) {
  const act = async (fn) => { const c = await fn(); onChanged(c); onClose(); };
  return (
    <div className="cc-card-menu" onMouseLeave={onClose}>
      <button onClick={() => act(() => ChatAPI.pin(conv.id))}><FiBookmark size={13} /> {conv.pinned ? "Unpin" : "Pin"}</button>
      <button onClick={() => act(() => (conv.muted_until ? ChatAPI.mute(conv.id, { unmute: true }) : ChatAPI.mute(conv.id, { minutes: 480 })))}>
        <FiVolumeX size={13} /> {conv.muted_until ? "Unmute" : "Mute"}
      </button>
      <button onClick={() => act(() => ChatAPI.archive(conv.id))}><FiArchive size={13} /> {conv.archived ? "Restore" : "Archive"}</button>
      <button className="cc-menu-danger" onClick={() => act(() => ChatAPI.reportConversation(conv.id, { reason: "OTHER" }))}>
        <FiFlag size={13} /> Report
      </button>
    </div>
  );
}

function ConversationCard({ conv, active, onSelect, onChanged }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const preview = conv.last_message
    ? (conv.last_message.deleted ? "Message deleted" : conv.last_message.attachment ? <><FiPaperclip size={11} /> {conv.last_message.attachment.name}</> : conv.last_message.body || "…")
    : "No messages yet";
  const badge = conv.course?.title || (conv.kind === "DIRECT" ? rolesLabel(conv.counterpart?.roles) : conv.kind === "BROADCAST" ? "Announcements" : conv.kind === "SUPPORT" ? "Support" : "");

  return (
    <div className={"cc-card" + (active ? " cc-card-active" : "") + (conv.unread ? " cc-card-unread" : "")}>
      <button className="cc-card-main" onClick={() => onSelect(conv)}>
        <Avatar
          src={conv.kind === "DIRECT" ? conv.counterpart?.avatar : null}
          name={conv.title || conv.counterpart?.name}
          identity={conv.counterpart?.identity || conv.id}
          online={conv.kind === "DIRECT" ? conv.counterpart?.online : undefined}
          size={42}
        />
        <span className="cc-card-body">
          <span className="cc-card-top">
            <span className="cc-card-title">
              {conv.pinned && <FiBookmark size={11} className="cc-pin-flag" />}
              {conv.title || conv.counterpart?.name || "Conversation"}
            </span>
            <span className="cc-card-time">{timeAgo(conv.last_message_at)}</span>
          </span>
          {badge && <span className="cc-card-badge">{badge}</span>}
          <span className="cc-card-preview">
            {conv.muted_until && <FiVolumeX size={11} />} {preview}
          </span>
        </span>
        {conv.unread > 0 && <span className="cc-card-unread-badge">{conv.unread > 9 ? "9+" : conv.unread}</span>}
      </button>
      <div className="cc-card-menu-anchor">
        <button className="cc-card-more" onClick={() => setMenuOpen((v) => !v)}><FiMoreHorizontal size={15} /></button>
        {menuOpen && <CardMenu conv={conv} onChanged={onChanged} onClose={() => setMenuOpen(false)} />}
      </div>
    </div>
  );
}

function Section({ title, items, activeId, onSelect, onChanged, collapsible, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;
  return (
    <div className="cc-section">
      <button className="cc-section-head" onClick={() => collapsible && setOpen((v) => !v)} disabled={!collapsible}>
        {collapsible && (open ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />)}
        {title} <span className="cc-section-count">{items.length}</span>
      </button>
      {open && items.map((c) => (
        <ConversationCard key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} onChanged={onChanged} />
      ))}
    </div>
  );
}

export default function ConversationList({
  conversations,
  loading,
  error,
  onRetry,
  activeId,
  category = "all",
  categories,
  onSelectCategory,
  onSelect,
  onChanged,
  onNewChat,
  onStartDirect,
}) {
  const [q, setQ] = useState("");
  const [globalResults, setGlobalResults] = useState(null);

  const filtered = useMemo(() => {
    let list = conversations;
    if (category !== "all") list = list.filter((c) => c.category === category);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((c) => (c.title || c.counterpart?.name || "").toLowerCase().includes(needle));
    }
    return list;
  }, [conversations, category, q]);

  // CC-002 Global Search: beyond filtering the conversations already
  // loaded client-side (above), a query also searches message bodies and
  // the people directory server-side — the two Message search / directory
  // searches the gap analysis called out as missing entirely.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setGlobalResults(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await ChatAPI.searchAll(query);
        if (alive) setGlobalResults(r);
      } catch { if (alive) setGlobalResults(null); }
    }, 260);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const openConversationById = (conversationId) => {
    const hit = conversations.find((c) => c.id === conversationId);
    if (hit) onSelect(hit);
  };

  const pinned = filtered.filter((c) => c.pinned && !c.archived);
  const unread = filtered.filter((c) => !c.pinned && !c.archived && c.unread > 0);
  const recent = filtered.filter((c) => !c.pinned && !c.archived && !c.unread);
  const archived = filtered.filter((c) => c.archived);

  const showGlobalExtras = q.trim().length >= 2 && globalResults &&
    (globalResults.messages?.length > 0 || globalResults.people?.length > 0);

  return (
    <aside className="cc-list">
      <div className="cc-list-head">
        <span>Messages</span>
        <button className="cc-newbtn" title="New message" aria-label="Start a new conversation" onClick={onNewChat}><FiPlus size={16} /></button>
      </div>


      <div className="cc-search-bar">
        <FiSearch size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
      </div>

      {categories && categories.length > 1 && (
        <div className="cc-cat-chips">
          {categories.map((cat) => (
            <button
              key={cat}
              className={"cc-chip" + (category === cat ? " cc-chip-active" : "")}
              onClick={() => onSelectCategory(cat)}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      <div className="cc-list-scroll">
        {loading ? (
          <SkeletonRows n={6} />
        ) : error ? (
          <EmptyState
            title="Couldn't load your messages"
            hint="Check your connection and try again."
            action={onRetry && <button className="cc-btn-primary" onClick={onRetry}>Retry</button>}
          />
        ) : filtered.length === 0 && !showGlobalExtras ? (
          <EmptyState
            title={q ? "No matches" : "No conversations yet"}
            hint={q ? `Nothing matches "${q}".` : "Start a conversation with the + button above."}
          />
        ) : (
          <>
            <Section title="Pinned" items={pinned} activeId={activeId} onSelect={onSelect} onChanged={onChanged} />
            <Section title="Unread" items={unread} activeId={activeId} onSelect={onSelect} onChanged={onChanged} />
            <Section title="Recent" items={recent} activeId={activeId} onSelect={onSelect} onChanged={onChanged} />
            <Section title="Archived" items={archived} activeId={activeId} onSelect={onSelect} onChanged={onChanged} collapsible defaultOpen={false} />

            {showGlobalExtras && globalResults.messages?.length > 0 && (
              <div className="cc-section">
                <div className="cc-section-head"><span>Messages</span></div>
                {globalResults.messages.map((m) => (
                  <button key={m.id} className="cc-global-hit" onClick={() => openConversationById(m.conversation_id)}>
                    <strong>{m.conversation_title || "Conversation"}</strong>
                    <span>{m.deleted ? "Message deleted" : (m.body || "(attachment)")}</span>
                  </button>
                ))}
              </div>
            )}

            {showGlobalExtras && globalResults.people?.length > 0 && (
              <div className="cc-section">
                <div className="cc-section-head"><span>People</span></div>
                {globalResults.people.map((p) => (
                  <button key={p.target_id} className="cc-global-hit" onClick={() => onStartDirect?.(p.target_kind, p.target_id)}>
                    <strong>{p.name}</strong>
                    <span>{p.subtitle || p.role_label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
