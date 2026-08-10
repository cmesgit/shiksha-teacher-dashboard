// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/PeopleDirectory.jsx
//   teacher_ui/src/shared/comm/PeopleDirectory.jsx
//
// CC-002 (people search)/CC-018 (User Directory). One component, two modes:
//   mode="picker" — the "New message" modal (replaces the inline directory
//                   modal the old ChatPanel had).
//   mode="screen" — a standalone, full directory with role filter tabs and
//                   bigger cards, each with a "Message" button — CC-018.
import { useEffect, useState } from "react";
import { FiX, FiSearch, FiMessageCircle } from "react-icons/fi";
import { ChatAPI } from "../chatClient";
import { Avatar, EmptyState, Spinner } from "./common";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "faculty", label: "Faculty" },
  { key: "guest", label: "Guest Experts" },
];

export default function PeopleDirectory({ mode = "picker", onClose, onStart, contactsNote }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await ChatAPI.directory(q.trim());
        if (alive) setItems(data);
      } catch { if (alive) setItems([]); }
      if (alive) setLoading(false);
    }, mode === "picker" ? 220 : 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, mode]);

  const visible = (items || []).filter((p) => filter === "all" || p.roles.includes(filter));

  const body = (
    <>
      <div className="cc-search-bar cc-modal-search">
        <FiSearch size={14} />
        <input autoFocus={mode === "picker"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search experts & faculty…" />
      </div>
      {mode === "screen" && (
        <div className="cc-cat-chips" style={{ padding: "0 16px 10px" }}>
          {FILTERS.map((f) => (
            <button key={f.key} className={"cc-chip" + (filter === f.key ? " cc-chip-active" : "")} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      )}
      <div className={mode === "picker" ? "cc-modal-list" : "cc-directory-grid"}>
        {loading ? (
          <Spinner label="Searching…" />
        ) : visible.length === 0 ? (
          <EmptyState title="No one found" hint="Try a different search term." />
        ) : (
          visible.map((p) => (
            <button key={p.target_id} className={mode === "picker" ? "cc-dir-item" : "cc-dir-card"} onClick={() => onStart(p.target_kind, p.target_id)}>
              <Avatar src={p.avatar} name={p.name} identity={p.target_id} size={mode === "picker" ? 34 : 52} />
              <span className="cc-dir-meta">
                <span className="cc-dir-name">{p.name}</span>
                <span className="cc-dir-sub">{p.subtitle || p.role_label}</span>
              </span>
              {mode === "screen" && <span className="cc-dir-message-btn"><FiMessageCircle size={14} /> Message</span>}
            </button>
          ))
        )}
      </div>
      {mode === "picker" && contactsNote && (
        <div className="cc-modal-foot">{contactsNote}</div>
      )}
    </>
  );

  if (mode === "screen") {
    return <div className="cc-directory-screen">{body}</div>;
  }

  return (
    <div className="cc-modal-backdrop" onClick={onClose}>
      <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cc-modal-head"><span>New message</span><button onClick={onClose}><FiX size={18} /></button></div>
        {body}
      </div>
    </div>
  );
}
