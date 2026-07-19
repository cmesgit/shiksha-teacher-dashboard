// src/components/StateViews.jsx
// ──────────────────────────────────────────────────────────────────────────
// Reusable page/section states so a page never shows a blank flash or a bare
// line of "Loading…" / "No X" text. Each renders a self-contained card that
// reads correctly on any background:
//
//   <LoadingState label="Loading students" />
//   <EmptyState icon="users" title="No students yet" message="…"
//               action={{ label: "Add a class", to: "/teacher/classes" }} />
//   <ErrorState message={err} onRetry={reload} />
//
// Pass `plain` to drop the card chrome when the state sits inside an existing
// white container (a list body, a grid). Same prop API as the student
// dashboard's components/StateViews.jsx so both apps read as one design
// language; colors derive from shared/tokens.css's --acc (per-track accent),
// so this automatically tints teal under Skill-Dev and slate under Academy.
// ──────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import "../styles/stateViews.css";

const ICONS = {
  book:     (<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
  video:    (<><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>),
  file:     (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>),
  quiz:     (<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  users:    (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  clock:    (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  search:   (<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  inbox:    (<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  alert:    (<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
};

function Icon({ name, className }) {
  return (
    <div className={`sv-empty__icon${className ? ` ${className}` : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[name] || ICONS.inbox}
      </svg>
    </div>
  );
}

function ActionButton({ action }) {
  if (!action) return null;
  const inner = (
    <>
      {action.icon && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONS[action.icon] || null}
        </svg>
      )}
      {action.label}
    </>
  );
  if (action.to) {
    return <Link to={action.to} className="sv-empty__cta">{inner}</Link>;
  }
  return (
    <button type="button" className="sv-empty__cta" onClick={action.onClick}>
      {inner}
    </button>
  );
}

export function EmptyState({ icon = "inbox", title, message, action, plain = false }) {
  return (
    <div className={`sv-state${plain ? " sv-state--plain" : ""}`}>
      <Icon name={icon} className="sv-empty__icon--muted" />
      {title && <h2 className="sv-empty__title">{title}</h2>}
      {message && <p className="sv-empty__text">{message}</p>}
      <ActionButton action={action} />
    </div>
  );
}

export function LoadingState({ label = "Loading", plain = false }) {
  return (
    <div className={`sv-state${plain ? " sv-state--plain" : ""}`} role="status" aria-live="polite">
      <div className="sv-spinner" aria-hidden="true" />
      <p className="sv-state__label">{label}…</p>
    </div>
  );
}

export function ErrorState({ title = "That didn't load", message = "Something went wrong. Please try again.", onRetry, plain = false }) {
  return (
    <div className={`sv-state${plain ? " sv-state--plain" : ""}`} role="alert">
      <Icon name="alert" className="sv-empty__icon--danger" />
      <h2 className="sv-empty__title">{title}</h2>
      <p className="sv-empty__text">{message}</p>
      {onRetry && (
        <button type="button" className="sv-empty__cta" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export default EmptyState;
