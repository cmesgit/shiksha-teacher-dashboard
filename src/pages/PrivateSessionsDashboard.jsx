/**
 * FILE: teacher_ui/src/pages/PrivateSessionsDashboard.jsx
 *
 * Private Sessions (teacher) — the design's shared Academy list screen
 * (Academy Dashboard.dc.html, `data-screen-label="Private Sessions"`, lines
 * 1616–1727): head, an underline Scheduled/Requests/History tab bar, and one
 * ac-listCard of standard ac-rows per tab. Teacher branch per README section 6:
 *
 *   - Scheduled: confirmed bookings + accepted requests (chip "Confirmed"),
 *     reschedules the teacher sent and is waiting on (chip "Reschedule sent").
 *   - Requests: pending student requests ("Requested by {name}"), with THREE
 *     inline row actions — Reject / Reschedule / Accept — straight from the
 *     list (dc.html lines 1663–1667), not behind a click-through.
 *   - History: completed + declined/cancelled sessions, with a Newest/Oldest
 *     sort (dc.html line 1706) alongside the existing status filter.
 *   - No "Request session" button — that's student-only.
 *
 * Field names aligned to backend model:
 *   date, time, duration, subject, course, topic, status,
 *   teacher_name (from serializer), student_name, group_size,
 *   requested_by, participants, note, reschedule_date/time/note,
 *   room_name, created_at, updated_at
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import * as privateSessionService from "../api/privateSessionService";
import "../styles/academyScreens.css";
import "../styles/privateSessions.css";
import { LoadingState, ErrorState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";
import { RescheduleModal, ReasonModal } from "../components/PrivateSessionModals";
import NotesViewModal from "../components/live/NotesViewModal";
import { statusLabel, statusTone } from "../utils/sessionStatus";
import { subjectChipSlot } from "../utils/subjectChips";
import { fmtClockTime, dayLabel } from "../utils/sessionTime";

/* ── Helpers ── */

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

function fmtTime(t) {
  if (!t) return "";
  if (t.includes("AM") || t.includes("PM") || t.includes("a.m") || t.includes("p.m")) return t;
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  if (isNaN(hr)) return t;
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
}

// The design's row wants a real Date for its time/day block (ac-row__when).
// Session date/time are stored as separate strings, one of which may already
// be a presentation string ("2:30 PM") rather than "14:30" — Date can't parse
// that, so this falls back to null and callers use the old fmtDate/fmtTime
// formatters instead, same as GroupSessions.jsx's groupStartDate().
function rowStartDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const t = timeStr || "";
  if (/am|pm/i.test(t)) return null;
  const d = new Date(`${dateStr}T${t || "00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* Normalize a session object — handles both old mock fields and real API fields */
function norm(s) {
  return {
    ...s,
    _date: s.scheduled_date || s.requested_date || s.date || "",
    _time: s.scheduled_time || s.requested_time || s.time || "",
    _student: s.student_name || s.requested_by?.name || s.requested_by || "",
    _teacher: s.teacher_name || s.teacher?.name || s.teacher || "",
    _groupSize: s.group_strength || s.group_size || 0,
    _duration: s._duration || s.duration_minutes || s.duration || "",
    _durationLabel: s._durationLabel || (s.duration_minutes ? `${s.duration_minutes} minutes` : ""),
    _actualDuration: s._actualDuration || s.actual_duration_minutes || null,
    _studentId: s.student_id || s.requested_by?.user_id || "",
    _courseId: s.course_id || "",
    _subjectCode: s.subject_code || "",
  };
}

/* ── Row ── */
function SessionRow({ r, subLabel, actionLabel, onAction, actionDisabled, extraActions }) {
  const start = rowStartDate(r._date, r._time);
  return (
    <div className="ac-row" onClick={() => onAction?.(r)} style={{ cursor: onAction ? "pointer" : "default" }}>
      <div className="ac-row__when">
        <div className="ac-row__time">{start ? fmtClockTime(start) : fmtTime(r._time)}</div>
        <div className="ac-row__day">{start ? dayLabel(start) : fmtDate(r._date)}</div>
      </div>
      <div className="ac-row__divider" />
      <div className="ac-row__body">
        <div className="ac-row__meta">
          {r.subject && (
            <span className={`subj-chip subj-chip--${subjectChipSlot(r.subject)}`}>{r.subject}</span>
          )}
          {subLabel}
        </div>
        <div className="ac-row__topic">{r.topic || `1-on-1 — ${r.subject || "Session"}`}</div>
        <div className="ac-row__sub">
          {r._student}{r._groupSize > 1 ? ` · ${r._groupSize} students` : ""}
        </div>
      </div>
      {extraActions}
      {actionLabel && (
        <button
          type="button"
          className="ac-btn ac-btn--primary"
          disabled={actionDisabled}
          onClick={(e) => { e.stopPropagation(); onAction?.(r); }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ── Component ── */

export default function PrivateSessionsDashboard() {
  const nav = useNavigate();
  const loc = useLocation();
  const [tab, setTab] = useState(loc.state?.tab || "scheduled");
  const [scheduled, setScheduled] = useState([]);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historySort, setHistorySort] = useState("newest"); // README: Newest/Oldest, both roles.
  const [reqStatusFilter, setReqStatusFilter] = useState("all");
  const [reqSubjectFilter, setReqSubjectFilter] = useState("all");

  // Requests-tab inline row actions (dc.html lines 1663–1667 — Reject /
  // Reschedule / Accept live on the row itself, no click-through required).
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [confirmDlg, setConfirmDlg] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [notesSession, setNotesSession] = useState(null);

  const reload = () => setRefreshKey((k) => k + 1);

  // Auto-refresh + switch tab when navigated back with refresh flag
  useEffect(() => {
    if (loc.state?.refresh) {
      setRefreshKey((k) => k + 1);
      setTab(loc.state?.tab || "scheduled");
      nav(loc.pathname, { replace: true, state: {} });
    }
  }, [loc.state?.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [s, r] = await Promise.all([
          privateSessionService.getTeacherSessions().catch(() => []),
          privateSessionService.getRequests().catch(() => []),
        ]);
        setScheduled(s || []);
        setRequests(r || []);
      } catch (err) {
        console.error("Failed to load sessions:", err);
        setError("Failed to load sessions. Please try again.");
      }
      try {
        const h = await privateSessionService.getHistory();
        setHistory(h || []);
      } catch {
        setHistory([]);
      }
      setLoading(false);
    }
    load();
  }, [refreshKey]);

  const pendingCount = requests.filter((r) =>
    r.status === "pending" ||
    r.status === "proposed_changes" ||
    r.status === "needs_reconfirmation"
  ).length;

  const reqSubjects = useMemo(() => {
    const set = new Set(requests.map((r) => r.subject));
    return [...set].sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let f = requests;
    if (reqStatusFilter !== "all") f = f.filter((r) => r.status === reqStatusFilter);
    if (reqSubjectFilter !== "all") f = f.filter((r) => r.subject === reqSubjectFilter);
    return f;
  }, [requests, reqStatusFilter, reqSubjectFilter]);

  const filteredHistory = useMemo(() => {
    const base = historyFilter === "all" ? history : history.filter((h) => h.status === historyFilter);
    const sorted = [...base].sort((a, b) => {
      const av = norm(a), bv = norm(b);
      const at = new Date(`${av._date || "1970-01-01"}T${/am|pm/i.test(av._time) ? "00:00" : (av._time || "00:00")}`).getTime();
      const bt = new Date(`${bv._date || "1970-01-01"}T${/am|pm/i.test(bv._time) ? "00:00" : (bv._time || "00:00")}`).getTime();
      const aVal = Number.isNaN(at) ? 0 : at;
      const bVal = Number.isNaN(bt) ? 0 : bt;
      return historySort === "newest" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [history, historyFilter, historySort]);

  const filteredScheduled = scheduled;

  /* ── Row actions ── */
  const openDetail = (r, bucket) => nav(`/teacher/private-sessions/${bucket}/${r.id}`);

  const askAccept = (r) => setConfirmDlg({
    title: "Accept this request?",
    message: `${r._student || "The student"}'s 1-on-1 request${r.topic ? ` — "${r.topic}"` : ""} will be scheduled${r._date ? ` for ${fmtDate(r._date)}${r._time ? ` at ${fmtTime(r._time)}` : ""}` : ""}. They'll be notified immediately.`,
    confirmLabel: "Accept",
    onConfirm: () => doAccept(r.id),
  });

  const doAccept = async (id) => {
    setActionBusy(true);
    try {
      await privateSessionService.acceptRequest(id);
      toast.success("Request accepted.");
      setConfirmDlg(null);
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not accept this request.");
    } finally {
      setActionBusy(false);
    }
  };

  const submitReject = async (reason) => {
    if (!rejectTarget) return;
    setActionBusy(true);
    try {
      await privateSessionService.declineRequest(rejectTarget.id, reason);
      toast.success("Request declined.");
      setRejectTarget(null);
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not decline this request.");
    } finally {
      setActionBusy(false);
    }
  };

  const submitReschedule = async ({ new_date, new_time, note }) => {
    if (!rescheduleTarget) return;
    setActionBusy(true);
    try {
      await privateSessionService.rescheduleRequest(rescheduleTarget.id, { new_date, new_time, note });
      toast.success("New time sent to student.");
      setRescheduleTarget(null);
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not send the new time.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Private Sessions</h1>
          <p className="ac-head__sub">Manage 1-on-1 session requests from your students.</p>
        </div>
        {/* No "+ Request session" button here — student-only (README section 6). */}
      </div>

      <div className="ac-tabs" role="tablist" aria-label="Private session view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "scheduled"}
          className={`ac-tab${tab === "scheduled" ? " is-active" : ""}`}
          onClick={() => setTab("scheduled")}
        >
          Scheduled
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "requests"}
          className={`ac-tab${tab === "requests" ? " is-active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Requests
          {pendingCount > 0 && <span className="ac-tab__count">{pendingCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={`ac-tab${tab === "history" ? " is-active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {loading && <LoadingState plain label="Loading sessions" />}
      {error && !loading && <ErrorState message={error} />}

      {/* ═══ SCHEDULED ═══ */}
      {!loading && !error && tab === "scheduled" && (
        <section className="ac-listCard">
          {filteredScheduled.length === 0 ? (
            <div className="ac-emptyRow">No sessions scheduled.</div>
          ) : (
            <div className="ac-list">
              {filteredScheduled.map((raw) => {
                const r = norm(raw);
                const tone = statusTone(r.status);
                const label = statusLabel(r.status);
                const isLive = r.status === "ongoing";
                const isPendingReconfirm = r.status === "needs_reconfirmation";
                // README: a reschedule-sent row's button reads "Pending". The
                // existing Detail page (isProposed) actually still offers
                // Accept/Decline for this exact status — that's preserved
                // real functionality this redesign must not remove — so the
                // row stays clickable ("Review") into the detail page rather
                // than a dead disabled "Pending" label that would hide it.
                const actionLabel = isLive ? "Join live"
                  : isPendingReconfirm || r.status === "proposed_changes" ? "Review"
                  : "View details";
                const onAction = isLive
                  ? () => nav(`/teacher/private-session/live/${r.id}`)
                  : () => openDetail(r, "scheduled");
                return (
                  <SessionRow
                    key={r.id}
                    r={r}
                    onAction={onAction}
                    actionLabel={actionLabel}
                    subLabel={<span className={`ac-tag ac-tag--${tone}`}>{label}</span>}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ═══ REQUESTS ═══ */}
      {!loading && !error && tab === "requests" && (
        <>
          <div className="ac-sortRow" style={{ gap: 8 }}>
            <select
              className="ac-select"
              value={reqStatusFilter}
              onChange={(e) => setReqStatusFilter(e.target.value)}
              aria-label="Filter requests by status"
            >
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="proposed_changes">Proposed changes</option>
              <option value="needs_reconfirmation">Reconfirmation</option>
            </select>
            <select
              className="ac-select"
              value={reqSubjectFilter}
              onChange={(e) => setReqSubjectFilter(e.target.value)}
              aria-label="Filter requests by subject"
            >
              <option value="all">All subjects</option>
              {reqSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <section className="ac-listCard">
            {filteredRequests.length === 0 ? (
              <div className="ac-emptyRow">No requests match your filters.</div>
            ) : (
              <div className="ac-list">
                {filteredRequests.map((raw) => {
                  const r = norm(raw);
                  return (
                    <SessionRow
                      key={r.id}
                      r={r}
                      onAction={() => openDetail(r, "request")}
                      subLabel={<span className="ac-when">Requested by {r._student || "a student"}</span>}
                      extraActions={
                        <div className="ac-row__actions">
                          <button
                            type="button"
                            className="ac-btn ac-btn--danger"
                            onClick={(e) => { e.stopPropagation(); setRejectTarget(r); }}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="ac-btn ac-btn--warning"
                            onClick={(e) => { e.stopPropagation(); setRescheduleTarget(r); }}
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            className="ac-btn ac-btn--primary"
                            onClick={(e) => { e.stopPropagation(); askAccept(r); }}
                          >
                            Accept
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ═══ HISTORY ═══ */}
      {!loading && !error && tab === "history" && (
        <>
          <div className="ac-sortRow" style={{ gap: 8 }}>
            <select
              className="ac-select"
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              aria-label="Filter history by status"
            >
              <option value="all">All history</option>
              <option value="completed">Completed</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="teacher_no_show">Teacher/Student no-show</option>
              <option value="student_no_show">Student no-show</option>
              <option value="cancelled">Cancelled</option>
              <option value="cancelled_by_student">Cancelled by student</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
            {/* README: "History tab (both roles) has a Newest / Oldest filter." */}
            <select
              className="ac-select"
              value={historySort}
              onChange={(e) => setHistorySort(e.target.value)}
              aria-label="Sort history"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <section className="ac-listCard">
            {filteredHistory.length === 0 ? (
              <div className="ac-emptyRow">
                {history.length === 0 ? "No history yet — the history endpoint may not be set up yet." : "No sessions match this filter."}
              </div>
            ) : (
              <div className="ac-list">
                {filteredHistory.map((raw) => {
                  const h = norm(raw);
                  const tone = statusTone(h.status);
                  const label = statusLabel(h.status);
                  return (
                    <SessionRow
                      key={h.id}
                      r={h}
                      onAction={() => openDetail(h, "history")}
                      subLabel={<span className={`ac-tag ac-tag--${tone}`}>{label}</span>}
                      extraActions={h.status === "completed" ? (
                        <button
                          type="button"
                          className="ac-btn"
                          onClick={(e) => { e.stopPropagation(); setNotesSession(h); }}
                        >
                          Notes
                        </button>
                      ) : null}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        dialog={confirmDlg && { ...confirmDlg, busy: actionBusy }}
        onClose={() => setConfirmDlg(null)}
      />
      <RescheduleModal
        key={rescheduleTarget?.id || "closed"}
        session={rescheduleTarget}
        busy={actionBusy}
        onClose={() => setRescheduleTarget(null)}
        onSubmit={submitReschedule}
      />
      <ReasonModal
        key={rejectTarget?.id || "closed"}
        session={rejectTarget}
        title="Decline request"
        sub={rejectTarget ? `${rejectTarget._student || "This student"}'s request will be declined and they'll be notified.` : ""}
        confirmLabel="Decline"
        tone="danger"
        busy={actionBusy}
        onClose={() => setRejectTarget(null)}
        onSubmit={submitReject}
      />
      {notesSession && (
        <NotesViewModal sessionId={notesSession.id} sessionType="private" onClose={() => setNotesSession(null)} />
      )}
    </div>
  );
}
