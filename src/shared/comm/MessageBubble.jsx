// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/MessageBubble.jsx
//   teacher_ui/src/shared/comm/MessageBubble.jsx
//
// One message. Handles all five message_type values the backend can send
// (TEXT / IMAGE / FILE / SYSTEM / ANNOUNCEMENT), a soft-deleted tombstone,
// a reply-to preview, an inline reaction summary + picker, and a hover/tap
// action menu (Reply · React · Copy · Delete · Report) — CC-010.
import { useState, useRef, useEffect } from "react";
import {
  FiCornerUpLeft, FiCopy, FiTrash2, FiFlag, FiMoreHorizontal, FiDownload,
  FiFileText, FiCheck, FiClock, FiAlertTriangle,
} from "react-icons/fi";
import { Avatar, formatClock } from "./common";

const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function AttachmentView({ attachment, uploading }) {
  if (!attachment) return null;
  if (uploading || !attachment.url) {
    return (
      <div className="cc-bubble-file cc-bubble-file-pending">
        <span className="cc-bubble-file-icon"><FiFileText size={18} /></span>
        <span className="cc-bubble-file-meta">
          <span className="cc-bubble-file-name">{attachment.name}</span>
          <span className="cc-bubble-file-size">Sending…</span>
        </span>
      </div>
    );
  }
  if (attachment.kind === "IMAGE") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="cc-bubble-image-link">
        <img src={attachment.url} alt={attachment.name} className="cc-bubble-image" loading="lazy" />
      </a>
    );
  }
  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" className="cc-bubble-file">
      <span className="cc-bubble-file-icon"><FiFileText size={18} /></span>
      <span className="cc-bubble-file-meta">
        <span className="cc-bubble-file-name">{attachment.name}</span>
        <span className="cc-bubble-file-size">{attachment.size ? `${Math.max(1, Math.round(attachment.size / 1024))} KB` : ""}</span>
      </span>
      <span className="cc-bubble-file-dl"><FiDownload size={15} /></span>
    </a>
  );
}

export default function MessageBubble({
  msg,
  mine,
  showSender = false,
  isRead,
  failed = false,
  variant = "default", // "default" | "announcement" | "system"
  onReply,
  onReact,
  onDelete,
  onReport,
  onJumpTo,
  onOpenSender,
  onRetry,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!menuOpen && !pickerOpen) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setMenuOpen(false); setPickerOpen(false); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, pickerOpen]);

  if (msg.message_type === "SYSTEM" || variant === "system") {
    return <div className="cc-msg-system">{msg.body}</div>;
  }

  if (msg.deleted) {
    return (
      <div className={"cc-msg" + (mine ? " cc-msg-mine" : "")}>
        <div className="cc-bubble cc-bubble-deleted">
          <FiTrash2 size={12} />
          {msg.deleted_reason ? "Removed by a moderator" : "This message was deleted"}
        </div>
      </div>
    );
  }

  const isAnnouncement = msg.message_type === "ANNOUNCEMENT" || variant === "announcement";

  return (
    <div
      className={
        "cc-msg" + (mine ? " cc-msg-mine" : "") + (isAnnouncement ? " cc-msg-announcement" : "")
      }
      ref={ref}
    >
      {showSender && !mine && (
        <button className="cc-msg-sender" onClick={() => onOpenSender?.(msg.sender?.identity)}>
          <Avatar src={msg.sender?.avatar} name={msg.sender?.name} identity={msg.sender?.identity} size={20} />
          <span>{msg.sender?.name}</span>
        </button>
      )}

      <div className="cc-bubble-row">
        <div className={"cc-bubble" + (isAnnouncement ? " cc-bubble-announcement" : "") + (failed ? " cc-bubble-failed" : "")}>
          {isAnnouncement && (
            <div className="cc-announcement-tag">
              <FiAlertTriangle size={11} /> Announcement · {msg.sender?.name}
            </div>
          )}
          {msg.reply_to && (
            <button className="cc-reply-quote" onClick={() => onJumpTo?.(msg.reply_to.id)}>
              <span className="cc-reply-quote-name">{msg.reply_to.sender_name}</span>
              <span className="cc-reply-quote-body">{msg.reply_to.body_preview || "Attachment"}</span>
            </button>
          )}
          {msg.attachment && <AttachmentView attachment={msg.attachment} uploading={msg._uploading} />}
          {msg.body && <div className="cc-bubble-text">{msg.body}</div>}

          <div className="cc-bubble-meta">
            <span>{formatClock(msg.created_at)}</span>
            {mine && !failed && (
              isRead
                ? <FiCheck className="cc-read-tick cc-read-tick-on" size={13} title="Read" />
                : <FiClock className="cc-read-tick" size={11} title="Sent" />
            )}
            {failed && (
              <button className="cc-retry-btn" onClick={() => onRetry?.(msg)}>Retry</button>
            )}
          </div>

          {!!(msg.reactions && msg.reactions.length) && (
            <div className="cc-reactions-row">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  className="cc-reaction-chip"
                  onClick={() => onReact?.(msg, r.emoji)}
                  title={`${r.count} reacted`}
                >
                  {r.emoji} <span>{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!failed && (
          <div className="cc-bubble-actions">
            <button className="cc-bubble-action-btn" title="React" onClick={() => setPickerOpen((v) => !v)}>🙂</button>
            <button className="cc-bubble-action-btn" title="Reply" onClick={() => onReply?.(msg)}><FiCornerUpLeft size={14} /></button>
            <button className="cc-bubble-action-btn" title="More" onClick={() => setMenuOpen((v) => !v)}><FiMoreHorizontal size={14} /></button>
          </div>
        )}

        {pickerOpen && (
          <div className="cc-emoji-picker">
            {REACTION_SET.map((e) => (
              <button key={e} onClick={() => { onReact?.(msg, e); setPickerOpen(false); }}>{e}</button>
            ))}
          </div>
        )}

        {menuOpen && (
          <div className="cc-bubble-menu">
            <button onClick={() => { navigator.clipboard?.writeText(msg.body || ""); setMenuOpen(false); }}>
              <FiCopy size={13} /> Copy text
            </button>
            {mine && (
              <button className="cc-menu-danger" onClick={() => { onDelete?.(msg); setMenuOpen(false); }}>
                <FiTrash2 size={13} /> Delete
              </button>
            )}
            {!mine && (
              <button className="cc-menu-danger" onClick={() => { onReport?.(msg); setMenuOpen(false); }}>
                <FiFlag size={13} /> Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
