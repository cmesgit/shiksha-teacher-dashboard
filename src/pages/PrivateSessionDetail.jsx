/**
 * FILE: teacher_ui/src/pages/PrivateSessionDetail.jsx
 *
 * Private Session detail (teacher). The design handoff has no mockup for
 * this page — only the list, requests, and reschedule-modal screens (README
 * section 6) — so this isn't a pixel-matched screen; it's re-skinned onto
 * the same tokens/shadows/radii as the rest of the redesigned app (shared
 * .ac-tag for the status chip, .ac-btn for actions, .ac-tabs for the
 * cross-navigation tab bar) rather than left on the old bespoke tps__ look.
 *
 * All the real per-status action logic is unchanged from before this pass:
 * isPending/isProposed/isApproved/isOngoing/isCompleted still gate exactly
 * the same actions they did (see the "FIX: TDZ" comment below, kept because
 * the bug it fixes is still real). What changed is presentation:
 *   - Confirm/Start/End/Accept/Accept-session are plain yes/no, so they now
 *     use the shared <ConfirmDialog /> (same component Assignments' delete
 *     confirm uses) instead of a hand-rolled tps__modal.
 *   - Decline and Reschedule need real form fields (a reason textarea; a
 *     date+time pair), so they use the new shared <ReasonModal />box and
 *     <RescheduleModal /> from components/PrivateSessionModals.jsx — the
 *     exact "Propose a new time" modal from the teacher-17 screenshot, also
 *     used by PrivateSessionsDashboard.jsx's Requests-tab row action so
 *     there's one implementation, not two.
 *   - The old page rendered every action twice — once in the header actions
 *     row, once again as a giant centered CTA at the bottom of the summary
 *     column (isApproved: header "Start Session" + a second bottom "Start
 *     Session" button; isPending: same duplication for "Accept Session").
 *     Both pairs called the exact same setModal(...), so the bottom copy was
 *     pure visual duplication, not a second capability — it's gone; the
 *     header action is the only one now.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import privateSessionService from "../api/privateSessionService";
import "../styles/academyScreens.css";
import "../styles/privateSessions.css";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";
import { RescheduleModal, ReasonModal } from "../components/PrivateSessionModals";
import NotesViewModal from "../components/live/NotesViewModal";
import { statusLabel, statusTone } from "../utils/sessionStatus";

/* ── Normalize fields — handles both mock + real API shapes ── */
function norm(s) {
  if (!s) return null;
  const actualDur = s.actual_duration_minutes;
  const scheduledDur = s.duration_minutes || (typeof s.duration === "number" ? s.duration : parseInt(s.duration, 10) || 0);
  return {
    ...s,
    _date: s.scheduled_date || s.requested_date || s.date || "",
    _time: s.scheduled_time || s.requested_time || s.time || "",
    _student: s.student_name || s.requested_by?.name || (typeof s.requested_by === "string" ? s.requested_by : ""),
    _teacher: s.teacher_name || s.teacher?.name || (typeof s.teacher === "string" ? s.teacher : ""),
    _groupSize: s.group_strength || s.group_size || 0,
    _duration: actualDur || scheduledDur,
    _durationLabel: actualDur ? `${actualDur} mins (actual)` : (scheduledDur ? `${scheduledDur} minutes` : ""),
    _actualDuration: actualDur,
    _participants: s.participants || [],
  };
}

/* ── Helpers ── */
function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
}

function fmtTime(t) {
  if (!t) return "";
  if (t.includes("AM") || t.includes("PM") || t.includes("a.m") || t.includes("p.m")) return t;
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  if (isNaN(hr)) return t;
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m" : "a.m"}`;
}

function calcEnd(t, dur) {
  if (!t || !dur) return "";
  let mins = typeof dur === "number" ? dur : parseInt(dur, 10);
  if (isNaN(mins)) return "";
  if (t.includes("AM") || t.includes("PM") || t.includes("a.m") || t.includes("p.m")) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return "";
  const tot = h * 60 + (m || 0) + mins;
  const eh = Math.floor(tot / 60) % 24;
  const em = tot % 60;
  return `${eh % 12 || 12}:${String(em).padStart(2, "0")} ${eh >= 12 ? "p.m" : "a.m"}`;
}

function minsUntilStart(date, time) {
  if (!date || !time) return null;
  try {
    let sessionDate;
    if (time.includes("AM") || time.includes("PM") || time.includes("a.m") || time.includes("p.m")) {
      sessionDate = new Date(`${date} ${time.replace(/\./g, "")}`);
    } else {
      const [h, m] = time.split(":").map(Number);
      sessionDate = new Date(date);
      sessionDate.setHours(h, m, 0, 0);
    }
    if (isNaN(sessionDate.getTime())) return null;
    return Math.round((sessionDate - new Date()) / 60000);
  } catch { return null; }
}

/* ── Component ── */
export default function PrivateSessionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null); // cancel | start | reschedule | decline | accept | accept-session | end
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  const pathTab = loc.pathname.includes("/request/") ? "requests"
    : loc.pathname.includes("/history/") ? "history" : "scheduled";

  const goBack = () => nav("/teacher/private-sessions", { state: { tab: pathTab, refresh: true } });

  // Tick for start button timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await privateSessionService.getSessionDetail(id);
        setSession(data);
      } catch (err) {
        console.error("Failed to load session:", err);
        setError("Failed to load session details. Please go back and try again.");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const BackButton = () => (
    <div className="psd__backRow">
      <button type="button" className="psd__back" onClick={goBack}>&lsaquo; Back to Sessions</button>
    </div>
  );

  if (loading) return (
    <div className="psd__wrapper">
      <BackButton />
      <LoadingState label="Loading session details" />
    </div>
  );
  if (error) return (
    <div className="psd__wrapper">
      <BackButton />
      <ErrorState message={error} />
    </div>
  );
  if (!session) return (
    <div className="psd__wrapper">
      <BackButton />
      <EmptyState icon="calendar" title="Session not found" message="It may have been removed." />
    </div>
  );

  const s = norm(session);

  // Declare status flags BEFORE they are used (TDZ fix from the original
  // file — still real: `startable` reads isApproved).
  const isPending = s.status === "pending";
  const isProposed = s.status === "proposed_changes" || s.status === "needs_reconfirmation";
  const isApproved = s.status === "approved";
  const isOngoing = s.status === "ongoing";
  const isCompleted = s.status === "completed";
  const startable = isApproved;
  const mins = minsUntilStart(s._date, s._time);

  const timingLine = `${fmtTime(s._time)}${calcEnd(s._time, s._duration) ? ` – ${calcEnd(s._time, s._duration)}` : ""}`;

  async function runAction(fn, successMsg) {
    setBusy(true);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      setModal(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "That didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /* participant names — handles both array of strings and array of objects */
  const participantNames = (s._participants || []).map((p) => {
    if (typeof p === "string") return p;
    if (p.name) return p.name;
    if (p.student?.name) return p.student.name;
    return `Student ${p.id || ""}`;
  });

  return (
    <div className="psd__wrapper">
      <BackButton />

      <div className="ac-tabs ac-tabs--tight" role="tablist" aria-label="Private session view">
        <button type="button" role="tab" aria-selected={pathTab === "scheduled"} className={`ac-tab${pathTab === "scheduled" ? " is-active" : ""}`} onClick={() => nav("/teacher/private-sessions", { state: { tab: "scheduled", refresh: true } })}>Scheduled</button>
        <button type="button" role="tab" aria-selected={pathTab === "requests"} className={`ac-tab${pathTab === "requests" ? " is-active" : ""}`} onClick={() => nav("/teacher/private-sessions", { state: { tab: "requests", refresh: true } })}>Requests</button>
        <button type="button" role="tab" aria-selected={pathTab === "history"} className={`ac-tab${pathTab === "history" ? " is-active" : ""}`} onClick={() => nav("/teacher/private-sessions", { state: { tab: "history", refresh: true } })}>History</button>
      </div>

      <div className="psd__page">
        <div className="psd__header">
          <h2 className="psd__status">
            <span className={`ac-tag ac-tag--${statusTone(s.status)}`}>{statusLabel(s.status)}</span>
            {isApproved && s._date && s._time && (
              <span className="psd__statusWhen">{fmtDate(s._date)} at {fmtTime(s._time)}</span>
            )}
            {mins !== null && isApproved && mins > 0 && mins <= 20 && (
              <span className="psd__countdown">Starting in {mins} minutes</span>
            )}
          </h2>
          <div className="psd__actions">
            {isOngoing && (
              <button type="button" className="ac-btn ac-btn--primary" onClick={() => nav(`/teacher/private-session/live/${s.id}`)}>Join Live Session</button>
            )}
            {isOngoing && (
              <button type="button" className="ac-btn ac-btn--danger" onClick={() => setModal("end")}>End Session</button>
            )}
            {isApproved && (
              <button type="button" className="ac-btn ac-btn--danger" onClick={() => setModal("cancel")}>Cancel Class</button>
            )}
            {isApproved && startable && (
              <button type="button" className="ac-btn ac-btn--success" onClick={() => setModal("start")}>Start Session</button>
            )}
            {isPending && (
              <>
                <button type="button" className="ac-btn ac-btn--success" onClick={() => setModal("accept-session")}>Accept Session</button>
                <button type="button" className="ac-btn ac-btn--warning" onClick={() => setModal("reschedule")}>Reschedule</button>
                <button type="button" className="ac-btn ac-btn--danger" onClick={() => setModal("decline")}>Decline</button>
              </>
            )}
            {isProposed && (
              <>
                <button type="button" className="ac-btn ac-btn--primary" onClick={() => setModal("accept")}>Accept</button>
                <button type="button" className="ac-btn ac-btn--danger" onClick={() => setModal("decline")}>Decline</button>
              </>
            )}
            {isCompleted && (
              <button type="button" className="ac-btn" onClick={() => setShowNotes(true)}>My Notes</button>
            )}
          </div>
        </div>

        <div className="psd__body">
          <div className="psd__left">
            <h3>Summary</h3>
            <table className="psd__table"><tbody>
              <tr><td>Course:</td><td>{s.course}</td></tr>
              <tr><td>Subject:</td><td>{s.subject}</td></tr>
              {s.topic && <tr><td>Topic:</td><td>{s.topic}</td></tr>}
              <tr><td>Teacher:</td><td>{s._teacher}</td></tr>
              <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
              <tr><td>{isPending || isProposed ? "Time slot:" : "Timing:"}</td><td>{timingLine}</td></tr>
              <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
            </tbody></table>

            {s.note && (<><h4>Student&rsquo;s note</h4><div className="psd__note">{s.note}</div></>)}
            {s.teacher_note && (<><h4>Teacher&rsquo;s note</h4><div className="psd__note psd__note--info">{s.teacher_note}</div></>)}
            {s.reschedule_note && (<><h4>Reschedule note</h4><div className="psd__note psd__note--info">{s.reschedule_note}</div></>)}
            {s.cancel_reason && (<><h4>Cancellation reason</h4><div className="psd__note psd__note--danger">{s.cancel_reason}</div></>)}
          </div>

          <div className="psd__right">
            <div className="psd__groupBox">
              <h3>Group strength: {s._groupSize}</h3>
              {participantNames.length > 0
                ? participantNames.map((p, i) => <p key={i} className="psd__gname">{p}</p>)
                : <p className="psd__gname" style={{ opacity: 0.5 }}>No participants yet</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODALS ══ */}

      {modal === "cancel" && (
        <ReasonModal
          session={s}
          title="Cancel session"
          sub={`This will cancel the ${fmtDate(s._date)} session and notify the student${s._groupSize > 1 ? "s" : ""}.`}
          placeholder="A family emergency has come up…"
          confirmLabel="Cancel session"
          tone="danger"
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(reason) => runAction(async () => {
            await privateSessionService.teacherCancelSession(s.id, reason);
            goBack();
          })}
        />
      )}

      {modal === "reschedule" && (
        <RescheduleModal
          session={s}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={({ new_date, new_time, note }) => runAction(async () => {
            await privateSessionService.rescheduleRequest(s.id, { new_date, new_time, note });
            goBack();
          })}
        />
      )}

      {modal === "decline" && (
        <ReasonModal
          session={s}
          title="Decline request"
          sub={`${s._student || "This student"}'s request will be declined and they'll be notified.`}
          placeholder="I'm unavailable at this time…"
          confirmLabel="Decline"
          tone="danger"
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(reason) => runAction(async () => {
            await privateSessionService.declineRequest(s.id, reason);
            goBack();
          })}
        />
      )}

      <ConfirmDialog
        dialog={modal === "start" ? {
          title: "Start session?",
          message: `${fmtDate(s._date)} · ${timingLine} · ${s._durationLabel || `${s._duration} minutes`}. Students will be notified immediately.${mins !== null && mins > 0 ? ` Starting ${mins} minute${mins !== 1 ? "s" : ""} before the scheduled time.` : ""}`,
          confirmLabel: "Start session",
          busy,
          onConfirm: () => runAction(async () => {
            await privateSessionService.startSession(s.id);
            nav(`/teacher/private-session/live/${s.id}`);
          }),
        } : null}
        onClose={() => setModal(null)}
      />

      <ConfirmDialog
        dialog={modal === "accept" ? {
          title: "Confirm session",
          message: `${fmtDate(s._date)} · ${timingLine} · ${s._durationLabel || `${s._duration} minutes`}. The session will be scheduled upon confirmation.`,
          confirmLabel: "Confirm",
          busy,
          onConfirm: () => runAction(async () => {
            await privateSessionService.acceptRequest(s.id);
            goBack();
          }, "Session confirmed."),
        } : null}
        onClose={() => setModal(null)}
      />

      <ConfirmDialog
        dialog={modal === "accept-session" ? {
          title: "Accept session request?",
          message: `${s._student || "Student"} · ${s.subject || ""} · ${fmtDate(s._date)} · ${timingLine} · ${s._durationLabel || `${s._duration} minutes`} · ${s._groupSize} student${s._groupSize !== 1 ? "s" : ""}. The session will be approved and scheduled — the student will be notified immediately.`,
          confirmLabel: "Confirm",
          busy,
          onConfirm: () => runAction(async () => {
            await privateSessionService.acceptRequest(s.id);
            nav("/teacher/private-sessions", { state: { tab: "scheduled", refresh: true } });
          }, "Session accepted."),
        } : null}
        onClose={() => setModal(null)}
      />

      <ConfirmDialog
        dialog={modal === "end" ? {
          title: "End session?",
          message: "This will end the session for all participants.",
          confirmLabel: "End session",
          danger: true,
          busy,
          onConfirm: () => runAction(async () => {
            await privateSessionService.endSession(s.id);
            goBack();
          }),
        } : null}
        onClose={() => setModal(null)}
      />

      {showNotes && (
        <NotesViewModal sessionId={s.id} sessionType="private" onClose={() => setShowNotes(false)} />
      )}
    </div>
  );
}
