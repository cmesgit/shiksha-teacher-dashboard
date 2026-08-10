/**
 * FILE: src/components/PrivateSessionModals.jsx
 *
 * The two Private Sessions modals that need real form fields — everything
 * else on that screen (Start/End/Accept/Confirm) is a plain yes/no and uses
 * the shared <ConfirmDialog />. These two don't fit that shape, so they get
 * their own small components, shared between PrivateSessionsDashboard.jsx
 * (Requests-tab row actions) and PrivateSessionDetail.jsx (same actions from
 * the detail page) so there's exactly one implementation of each:
 *
 *   - RescheduleModal — README section 6 / teacher-17 screenshot: "Propose a
 *     new time", amber icon tile, New date + New time, footer
 *     Cancel / Send to student (#c2701c). See the header comment inside for
 *     the one field the screenshot doesn't show (Note) and why it stayed.
 *   - ReasonModal — generic amber/danger icon-tile modal with one optional
 *     reason textarea, used for both "Decline request" and "Cancel session".
 *     The design has no screenshot for either (README: "don't have individual
 *     screenshots but should follow the same shared modal-shell pattern"), so
 *     this reuses RescheduleModal's exact shell rather than inventing a
 *     second visual language.
 *
 * Both render on top of everything (z-index in privateSessions.css's .psm__*
 * block) and take a `session` prop that's `norm()`-shaped (_student, _date,
 * _time, topic) from either caller.
 */

import { useState } from "react";
import "../styles/privateSessions.css";

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// NOTE: state initializes straight from `session` (no effect syncing it in)
// — callers must remount this component per-session (e.g. a `key={session.id}`
// on the render site) rather than toggling `session` on one persistent
// instance, or the fields won't reset between two different requests.
export function RescheduleModal({ session, busy, error, onClose, onSubmit }) {
  const [date, setDate] = useState(session?._date || "");
  const [time, setTime] = useState(session?._time || "");
  const [note, setNote] = useState("");

  if (!session) return null;
  const canSubmit = Boolean(date && time);

  return (
    <div className="psm__overlay" onClick={() => !busy && onClose()}>
      <div className="psm__panel" onClick={(e) => e.stopPropagation()}>
        <div className="psm__header">
          <div className="psm__iconTile psm__iconTile--warning"><CalendarIcon /></div>
          <div>
            <h3 className="psm__title">Propose a new time</h3>
            <p className="psm__sub">
              Suggest a new slot for {session._student || "the student"}&rsquo;s request
              {session.topic ? ` — "${session.topic}"` : ""}. They&rsquo;ll be able to accept or decline the new time.
            </p>
          </div>
        </div>

        {error && <div className="psm__error">{error}</div>}

        <div className="psm__row">
          <div className="psm__field">
            <label className="psm__label" htmlFor="psm-resched-date">New date</label>
            <input
              id="psm-resched-date"
              type="date"
              className="psm__input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="psm__field">
            <label className="psm__label" htmlFor="psm-resched-time">New time</label>
            <input
              id="psm-resched-time"
              type="time"
              className="psm__input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {/* Not in the design's 2-field spec, but a real field the reschedule
            API accepts (privateSessionService.rescheduleRequest's `note`,
            sent as `reason`) — dropping it would silently remove the
            teacher's only way to tell the student why the time changed, so
            it stays as an optional third field below the two required ones. */}
        <div className="psm__field">
          <label className="psm__label" htmlFor="psm-resched-note">
            Note for student <span className="psm__optional">(optional)</span>
          </label>
          <textarea
            id="psm-resched-note"
            className="psm__textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Let the student know why you're proposing this change…"
          />
        </div>

        <div className="psm__footer">
          <button type="button" className="psm__btn psm__btn--ghost" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="psm__btn psm__btn--warning"
            disabled={busy || !canSubmit}
            onClick={() => onSubmit({ new_date: date, new_time: time, note })}
          >
            {busy ? "Sending…" : "Send to student"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Same remount-per-session contract as RescheduleModal above.
export function ReasonModal({
  session,
  title,
  sub,
  placeholder = "Let the student know why…",
  confirmLabel = "Confirm",
  tone = "danger",
  busy,
  error,
  onClose,
  onSubmit,
}) {
  const [reason, setReason] = useState("");
  if (!session) return null;

  return (
    <div className="psm__overlay" onClick={() => !busy && onClose()}>
      <div className="psm__panel" onClick={(e) => e.stopPropagation()}>
        <div className="psm__header">
          <div className={`psm__iconTile psm__iconTile--${tone}`}><AlertIcon /></div>
          <div>
            <h3 className="psm__title">{title}</h3>
            {sub && <p className="psm__sub">{sub}</p>}
          </div>
        </div>

        {error && <div className="psm__error">{error}</div>}

        <div className="psm__field">
          <label className="psm__label" htmlFor="psm-reason">
            Reason <span className="psm__optional">(optional)</span>
          </label>
          <textarea
            id="psm-reason"
            className="psm__textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
          />
        </div>

        <div className="psm__footer">
          <button type="button" className="psm__btn psm__btn--ghost" disabled={busy} onClick={onClose}>
            Back
          </button>
          <button
            type="button"
            className={`psm__btn psm__btn--${tone}`}
            disabled={busy}
            onClick={() => onSubmit(reason)}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
