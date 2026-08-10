// Canonical private-session status vocabulary — TEACHER app.
//
// Mirrors the shape of the student app's utils/sessionStatus.js (same idea:
// one map instead of a statusLabel() copy in every file, `tone` names an
// .ac-tag--* variant from styles/academyScreens.css) but is NOT a byte-for-
// byte copy — the teacher side's real statuses (PrivateSessionsDashboard.jsx's
// old statusLabel()/PrivateSessionDetail.jsx's old statusTitle()) cover several
// states the student list never shows: proposed_changes, teacher/student
// no-show, withdrawn, and the two directional cancellations. This file is
// where every one of those keeps a sensible, distinct label so nothing goes
// visually silent just because it collapses onto a 4-tone chip palette.
//
// Design palette (README "Status chip palette"):
//   Scheduled / Confirmed / Completed → success  (#ecf8ee / #2f9d42)
//   Accepted                          → info     (#e8edfb / #1d4ed8)
//   Reschedule sent                   → warning  (#fef3ec / #c2701c)
//   Rejected / Declined               → danger   (#fef2f2 / #dc2626)
// Two states outside that table reuse tones Group/Live Sessions already
// established for the same idea (a live-in-progress pulse, a grey "this is
// over and nobody rejected anything" neutral) rather than inventing new ones.

export const SESSION_STATUS = {
  // The design's own "Confirmed" chip (teacher-15 screenshot, a booked
  // session). README's Scheduled tab also describes "requests the teacher
  // accepted" as a separate "Accepted" chip — but the backend has no status
  // distinct from `approved` for that case (accepting a request just makes it
  // an approved session, same as a direct booking), so both read as
  // "Confirmed" here; there's no data signal to tell them apart.
  approved: { label: "Confirmed", tone: "success" },
  // Reuses the teal "live" tag + pulse Group/Live Sessions use for the same
  // in-progress idea; the design's static screenshots never show a session
  // mid-call, so there's no literal chip text to match.
  ongoing: { label: "Live", tone: "live" },
  pending: { label: "Pending", tone: "warning" },
  // Teacher proposed a new time and is waiting on the student — README's
  // "Reschedule sent" chip.
  needs_reconfirmation: { label: "Reschedule sent", tone: "warning" },
  // The reverse direction: a change is in front of the teacher (their own
  // outgoing reschedule counts as this too in the existing code's isProposed
  // check — see PrivateSessionDetail.jsx) awaiting an Accept/Decline. Same
  // tone as needs_reconfirmation (both are "awaiting a decision" amber
  // states) but a distinct label so the two don't read as identical.
  proposed_changes: { label: "Proposed changes", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "danger" },
  cancelled_by_student: { label: "Cancelled by student", tone: "danger" },
  cancelled_by_teacher: { label: "Cancelled by you", tone: "danger" },
  teacher_no_show: { label: "Teacher no-show", tone: "danger" },
  student_no_show: { label: "Student no-show", tone: "danger" },
  // Nobody rejected anything here — the request/slot just lapsed — so these
  // two stay out of the danger family and use the neutral grey Group/Live
  // Sessions already use for "expired".
  expired: { label: "Expired", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export function statusLabel(status) {
  return SESSION_STATUS[status]?.label ?? status;
}

export function statusTone(status) {
  return SESSION_STATUS[status]?.tone ?? "neutral";
}
