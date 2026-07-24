// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/SupportView.jsx
//   teacher_ui/src/shared/comm/SupportView.jsx
//
// CC-022 Academic Support. Wires the reserved SUPPORT conversation kind:
// list my tickets, open one (message thread + reply), start a new one,
// close it once resolved.
import { useEffect, useState } from "react";
import { FiPlus, FiX, FiChevronLeft, FiSend, FiCheckCircle } from "react-icons/fi";
import { ChatAPI } from "../chatClient";
import { EmptyState, Spinner, timeAgo } from "./common";
import MessageBubble from "./MessageBubble";

const CATEGORIES = [
  ["TECHNICAL", "Technical issue"],
  ["BILLING", "Billing / payments"],
  ["COURSE", "Course content"],
  ["ACCOUNT", "Account / access"],
  ["OTHER", "Other"],
];

const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed" };

function NewTicketForm({ onCreated, onCancel }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setBusy(true); setError("");
    try {
      const ticket = await ChatAPI.createSupportTicket(subject.trim(), category, message.trim());
      onCreated(ticket);
    } catch (e) {
      setError(e?.response?.data?.reason || "Couldn't submit your ticket — try again.");
    }
    setBusy(false);
  };

  return (
    <div className="cc-support-new">
      <div className="cc-field-label">What's this about?</div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" maxLength={200} />
      <div className="cc-field-label">Category</div>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <div className="cc-field-label">Tell us more</div>
      <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened? What did you expect instead?" />
      {error && <div className="cc-form-error">{error}</div>}
      <div className="cc-modal-foot">
        <button className="cc-btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="cc-btn-primary" disabled={busy || !subject.trim() || !message.trim()} onClick={submit}>Submit ticket</button>
      </div>
    </div>
  );
}

function TicketThread({ ticket, onBack, onClosed }) {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => ChatAPI.supportTicketMessages(ticket.id).then(setMessages);
  useEffect(() => { load(); }, [ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reply = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try { await ChatAPI.replySupportTicket(ticket.id, draft.trim()); setDraft(""); await load(); }
    catch { /* keep draft so the user can retry */ }
    setSending(false);
  };

  const close = async () => { const t = await ChatAPI.closeSupportTicket(ticket.id); onClosed(t); };

  return (
    <div className="cc-support-thread">
      <header className="cc-thread-head">
        <button className="cc-icon-btn" onClick={onBack}><FiChevronLeft size={18} /></button>
        <span className="cc-thread-id-text">
          <span className="cc-thread-title">{ticket.subject}</span>
          <span className="cc-thread-role">
            {STATUS_LABEL[ticket.status]} · {ticket.category}
            {ticket.assignee ? ` · Being handled by ${ticket.assignee}` : ""}
          </span>
        </span>
        {ticket.status !== "CLOSED" && (
          <button className="cc-btn-secondary" onClick={close}><FiCheckCircle size={13} /> Close ticket</button>
        )}
      </header>
      <div className="cc-messages cc-messages-static">
        {messages === null ? <Spinner label="Loading…" /> : messages.map((m) => (
          <MessageBubble key={m.id} msg={m} mine={m.sender?.identity === ticket.requester_identity} showSender />
        ))}
      </div>
      {ticket.status !== "CLOSED" && (
        <div className="cc-composer">
          <div className="cc-composer-row">
            <input className="cc-composer-input" value={draft} onChange={(e) => setDraft(e.target.value)}
                   placeholder="Reply to support…" onKeyDown={(e) => e.key === "Enter" && reply()} disabled={sending} />
            <button className="cc-send-btn" onClick={reply} disabled={!draft.trim() || sending}><FiSend size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportView() {
  const [tickets, setTickets] = useState(null);
  const [active, setActive] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => ChatAPI.supportTickets().then(setTickets).catch(() => setTickets([]));
  useEffect(() => { load(); }, []);

  if (active) {
    return <TicketThread ticket={active} onBack={() => { setActive(null); load(); }} onClosed={(t) => setActive(t)} />;
  }

  return (
    <div className="cc-support-view">
      <header className="cc-view-head">
        <span className="cc-view-title">Academic Support</span>
        <button className="cc-newbtn" onClick={() => setCreating(true)}><FiPlus size={16} /></button>
      </header>

      {creating && (
        <div className="cc-modal-backdrop" onClick={() => setCreating(false)}>
          <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head"><span>New support ticket</span><button onClick={() => setCreating(false)}><FiX size={18} /></button></div>
            <NewTicketForm onCancel={() => setCreating(false)} onCreated={(t) => { setCreating(false); load(); setActive(t); }} />
          </div>
        </div>
      )}

      <div className="cc-list-scroll">
        {tickets === null ? (
          <Spinner label="Loading tickets…" />
        ) : tickets.length === 0 ? (
          <EmptyState title="No support tickets" hint="Need help with something? Open a ticket and our team will follow up." />
        ) : (
          tickets.map((t) => (
            <button className="cc-card cc-ticket-card" key={t.id} onClick={() => setActive(t)}>
              <span className="cc-card-body">
                <span className="cc-card-top">
                  <span className="cc-card-title">{t.subject}</span>
                  <span className={"cc-status-pill cc-status-" + t.status.toLowerCase()}>{STATUS_LABEL[t.status]}</span>
                </span>
                <span className="cc-card-preview">{t.last_message?.body || "No replies yet"}</span>
                <span className="cc-card-time">{timeAgo(t.updated_at)} ago</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
