/**
 * FILE: teacher_ui/src/pages/PrivateSessionDetail.jsx
 * DEPLOYMENT READY — field-name agnostic via norm()
 *
 * FIX: Moved isApproved/isOngoing/isPending/isProposed declarations
 *      ABOVE `startable` to fix TDZ (Temporal Dead Zone) error:
 *      "Cannot access 'ae' before initialization"
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import privateSessionService from "../api/privateSessionService";
import "../styles/privateSessions.css";
import { LoadingState } from "../components/StateViews";

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

function statusTitle(s) {
  const map = {
    approved: "UPCOMING", ongoing: "LIVE SESSION", pending: "PENDING",
    needs_reconfirmation: "PROPOSED CHANGES", proposed_changes: "PROPOSED CHANGES",
    completed: "COMPLETED", declined: "DECLINED",
    cancelled: "CANCELLED", cancelled_by_student: "CANCELLED BY STUDENT",
    cancelled_by_teacher: "CANCELLED BY TEACHER",
    teacher_no_show: "TEACHER NO-SHOW", student_no_show: "STUDENT NO-SHOW",
    expired: "EXPIRED", withdrawn: "REQUEST WITHDRAWN",
  };
  return map[s] || s?.toUpperCase() || "";
}

function canStart() {
  // Teachers can start the session at any time once approved
  return true;
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

  const [modal, setModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [resTime, setResTime] = useState("");
  const [resDuration, setResDuration] = useState("");
  const [resNote, setResNote] = useState("");
  const [busy, setBusy] = useState(false);

  const pathTab = loc.pathname.includes("/request/") ? "requests"
    : loc.pathname.includes("/history/") ? "history" : "scheduled";

  const goBack = () => nav("/teacher/private-sessions", { state: { tab: pathTab, refresh: true } });

  // Tick for start button timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
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

  if (loading) return (
    <div className="tps__detail-wrapper">
      <div className="tps__sidebar-back">
        <button className="tps__back" onClick={goBack}>‹ Back to Sessions</button>
      </div>
      <LoadingState label="Loading session details" />
    </div>
  );
  if (error) return (
    <div className="tps__detail-wrapper">
      <div className="tps__sidebar-back">
        <button className="tps__back" onClick={goBack}>‹ Back to Sessions</button>
      </div>
      <div className="tps__page">
        <p className="tps__empty" style={{ color: "#ef4444" }}>{error}</p>
      </div>
    </div>
  );
  if (!session) return (
    <div className="tps__detail-wrapper">
      <div className="tps__sidebar-back">
        <button className="tps__back" onClick={goBack}>‹ Back to Sessions</button>
      </div>
      <div className="tps__page">
        <p className="tps__empty">Session not found.</p>
      </div>
    </div>
  );

  const s = norm(session);

  // ✅ FIX: Declare status flags BEFORE they are used
  const isPending = s.status === "pending";
  const isProposed = s.status === "proposed_changes" || s.status === "needs_reconfirmation";
  const isApproved = s.status === "approved";
  const isOngoing = s.status === "ongoing";
  const startable = isApproved;
  const mins = minsUntilStart(s._date, s._time);

  async function doAction(fn) {
    setBusy(true);
    try { await fn(); } catch (err) { console.error("Action failed:", err); }
    setBusy(false);
    setModal(null);
  }

  /* participant names — handles both array of strings and array of objects */
  const participantNames = (s._participants || []).map(p => {
    if (typeof p === "string") return p;
    if (p.name) return p.name;
    if (p.student?.name) return p.student.name;
    return `Student ${p.id || ""}`;
  });

  return (
    <div className="tps__detail-wrapper">
      <div className="tps__sidebar-back">
        <button className="tps__back" onClick={goBack}>‹ Back to Sessions</button>
      </div>

      <div className="tps__tabs" style={{ marginBottom: 20 }}>
        <button className={`tps__tab ${pathTab === "scheduled" ? "tps__tab--active" : ""}`} onClick={() => nav("/teacher/private-sessions", { state: { tab: "scheduled", refresh: true } })}>Scheduled</button>
        <button className={`tps__tab ${pathTab === "requests" ? "tps__tab--active" : ""}`} onClick={() => nav("/teacher/private-sessions", { state: { tab: "requests", refresh: true } })}>Requests</button>
        <button className={`tps__tab ${pathTab === "history" ? "tps__tab--active" : ""}`} onClick={() => nav("/teacher/private-sessions", { state: { tab: "history", refresh: true } })}>History</button>
      </div>

      <div className="tps__page">
      <div className="tps__dheader">
        <h2 className="tps__dstatus">
          STATUS: {statusTitle(s.status)}
          {isApproved && s._date && s._time && ` (${fmtDate(s._date)}) at ${fmtTime(s._time)}`}
          {mins !== null && isApproved && mins > 0 && mins <= 20 && (
            <span className="tps__countdown"> · Session Starting in {mins} Minutes</span>
          )}
        </h2>
        <div className="tps__dactions">
          {isOngoing && (
            <button className="tps__abtn tps__abtn--primary" onClick={() => nav(`/teacher/private-session/live/${s.id}`)}>🔴 Join Live Session</button>
          )}
          {isOngoing && (
            <button className="tps__abtn tps__abtn--outline" onClick={() => setModal("end")}>End Session</button>
          )}
          {isApproved && (
            <button className="tps__abtn tps__abtn--outline" onClick={() => setModal("cancel")}>Cancel Class</button>
          )}
          {isApproved && startable && (
            <button className="tps__abtn tps__abtn--primary" onClick={() => setModal("start")}>Start Session</button>
          )}
          {isPending && (
            <>
              <button className="tps__abtn tps__abtn--accept" onClick={() => setModal("accept-session")}>Accept Session</button>
              <button className="tps__abtn tps__abtn--primary" onClick={() => setModal("timing")}>Set Timing</button>
              <button className="tps__abtn tps__abtn--outline" onClick={() => setModal("decline")}>Decline</button>
            </>
          )}
          {isProposed && (
            <>
              <button className="tps__abtn tps__abtn--primary" onClick={() => setModal("accept")}>Accept</button>
              <button className="tps__abtn tps__abtn--outline" onClick={() => setModal("decline")}>Decline</button>
            </>
          )}
        </div>
      </div>

      <div className="tps__dbody">
        <div className="tps__dleft">
          <h3>Summary:</h3>
          <table className="tps__dtable"><tbody>
            <tr><td>Course:</td><td>{s.course}</td></tr>
            <tr><td>Subject:</td><td>{s.subject}</td></tr>
            {s.topic && <tr><td>Topic:</td><td>{s.topic}</td></tr>}
            <tr><td>Teacher:</td><td>{s._teacher}</td></tr>
            <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
            <tr><td>{isPending || isProposed ? "Time Slot:" : "Timing:"}</td><td>{fmtTime(s._time)}{calcEnd(s._time, s._duration) ? ` – ${calcEnd(s._time, s._duration)}` : ""}</td></tr>
            <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
          </tbody></table>

          {s.note && (<><h4>Student's Note:</h4><div className="tps__note">{s.note}</div></>)}
          {s.teacher_note && (<><h4>Teacher's Note:</h4><div className="tps__note tps__note--teacher">{s.teacher_note}</div></>)}
          {s.reschedule_note && (<><h4>Reschedule Note:</h4><div className="tps__note tps__note--teacher">{s.reschedule_note}</div></>)}
          {s.cancel_reason && (<><h4>Cancellation Reason:</h4><div className="tps__note tps__note--cancel">{s.cancel_reason}</div></>)}

          {isApproved && (
            <div className="tps__start-wrap">
              <button
                className="tps__start-btn"
                onClick={() => setModal("start")}
              >
                ▶ Start Session
              </button>
            </div>
          )}

          {isPending && (
            <div className="tps__accept-wrap">
              <button
                className="tps__accept-btn"
                onClick={() => setModal("accept-session")}
              >
                ✓ Accept Session
              </button>
            </div>
          )}
        </div>

        <div className="tps__dright">
          <div className="tps__gbox">
            <h3>Group Strength: {s._groupSize}</h3>
            {participantNames.length > 0
              ? participantNames.map((p, i) => <p key={i} className="tps__gname">{p}</p>)
              : <p className="tps__gname" style={{ opacity: 0.5 }}>No participants yet</p>}
          </div>
        </div>
      </div>
      </div>{/* end tps__page */}

      {/* ══ MODALS ══ */}

      {modal === "cancel" && (
        <div className="tps__overlay" onClick={() => setModal(null)}>
          <div className="tps__modal" onClick={e => e.stopPropagation()}>
            <h3>Cancel Session</h3>
            <table className="tps__minfo"><tbody>
              <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
              <tr><td>Time:</td><td>{fmtTime(s._time)}{calcEnd(s._time, s._duration) ? ` – ${calcEnd(s._time, s._duration)}` : ""}</td></tr>
              <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
            </tbody></table>
            <h4>Reason for Cancellation:</h4>
            <textarea className="tps__mtxt" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="A family emergency has come up..." />
            <p className="tps__mwarn"><strong>Note:</strong> This will cancel the session and notify the students.</p>
            <div className="tps__mbtns">
              <button className="tps__mbtn tps__mbtn--sec" onClick={() => setModal(null)}>Back</button>
              <button className="tps__mbtn tps__mbtn--pri" disabled={busy} onClick={() => doAction(async () => {
                await privateSessionService.cancelSession(s.id, cancelReason);
                goBack();
              })}>{busy ? "..." : "Proceed"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "start" && (
        <div className="tps__overlay" onClick={() => setModal(null)}>
          <div className="tps__modal" onClick={e => e.stopPropagation()}>
            <h3>Start Session?</h3>
            <table className="tps__minfo"><tbody>
              <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
              <tr><td>Time:</td><td>{fmtTime(s._time)}{calcEnd(s._time, s._duration) ? ` – ${calcEnd(s._time, s._duration)}` : ""}</td></tr>
              <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
            </tbody></table>
            <p className="tps__mwarn"><strong>Note:</strong> Students will be notified immediately.</p>
            {mins !== null && mins > 0 && (
              <p className="tps__minfo-text">Starting {mins} minute{mins !== 1 ? "s" : ""} before scheduled time.</p>
            )}
            <div className="tps__mbtns">
              <button className="tps__mbtn tps__mbtn--sec" onClick={() => setModal(null)}>Back</button>
              <button className="tps__mbtn tps__mbtn--pri" disabled={busy} onClick={() => doAction(async () => {
                await privateSessionService.startSession(s.id);
                nav(`/teacher/private-session/live/${s.id}`);
              })}>{busy ? "..." : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "timing" && (
        <div className="tps__overlay" onClick={() => setModal(null)}>
          <div className="tps__modal" onClick={e => e.stopPropagation()}>
            <h3>Set Schedule Timing</h3>
            <table className="tps__minfo"><tbody>
              <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
              <tr><td>Time:</td><td>{fmtTime(s._time)}</td></tr>
              <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
            </tbody></table>
            <div className="tps__mfield">
              <label>Timing:</label>
              <input type="time" className="tps__minput-time" value={resTime} onChange={e => setResTime(e.target.value)} />
            </div>
            <div className="tps__mfield">
              <label>Duration:</label>
              <input type="number" className="tps__minput" value={resDuration} onChange={e => setResDuration(e.target.value)} placeholder={`${s._duration}`} />
              <span style={{ color: "#b8cce0", marginLeft: 4 }}>minutes</span>
            </div>
            <div className="tps__mfield">
              <label>Note (For Students):</label>
              <textarea className="tps__mtxt" value={resNote} onChange={e => setResNote(e.target.value)} placeholder="Dear students, I've adjusted our session..." />
            </div>
            <p className="tps__mwarn"><strong>Note:</strong> This will send a confirmation request to the students.</p>
            <div className="tps__mbtns">
              <button className="tps__mbtn tps__mbtn--sec" onClick={() => setModal(null)}>Back</button>
              <button className="tps__mbtn tps__mbtn--pri" disabled={busy} onClick={() => doAction(async () => {
                await privateSessionService.rescheduleRequest(s.id, {
                  new_date: s._date,
                  new_time: resTime,
                  duration: resDuration || s._duration,
                  note: resNote,
                });
                goBack();
              })}>{busy ? "..." : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "decline" && (
        <div className="tps__overlay" onClick={() => setModal(null)}>
          <div className="tps__modal" onClick={e => e.stopPropagation()}>
            <h3>Decline Request</h3>
            <table className="tps__minfo"><tbody>
              <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
              <tr><td>Time:</td><td>{fmtTime(s._time)}</td></tr>
              <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
            </tbody></table>
            <h4>Reason for Declining:</h4>
            <textarea className="tps__mtxt" value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="I'm unavailable at this time..." />
            <p className="tps__mwarn"><strong>Note:</strong> This will decline the request and notify students.</p>
            <div className="tps__mbtns">
              <button className="tps__mbtn tps__mbtn--sec" onClick={() => setModal(null)}>Back</button>
              <button className="tps__mbtn tps__mbtn--decline" disabled={busy} onClick={() => doAction(async () => {
                await privateSessionService.declineRequest(s.id, declineReason);
                goBack();
              })}>{busy ? "..." : "Decline"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "accept" && (
        <div className="tps__overlay" onClick={() => setModal(null)}>
          <div className="tps__modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Session</h3>
            <table className="tps__minfo"><tbody>
              <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
              <tr><td>Timing:</td><td>{fmtTime(s._time)}{calcEnd(s._time, s._duration) ? ` – ${calcEnd(s._time, s._duration)}` : ""}</td></tr>
              <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
            </tbody></table>
            <p className="tps__mwarn"><strong>Note:</strong> The session will be scheduled upon confirmation.</p>
            <div className="tps__mbtns">
              <button className="tps__mbtn tps__mbtn--sec" onClick={() => setModal(null)}>Back</button>
              <button className="tps__mbtn tps__mbtn--pri" disabled={busy} onClick={() => doAction(async () => {
                await privateSessionService.acceptRequest(s.id);
                goBack();
              })}>{busy ? "..." : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
      {modal === "accept-session" && (
        <div className="tps__overlay" onClick={() => setModal(null)}>
          <div className="tps__modal" onClick={e => e.stopPropagation()}>
            <h3>Accept Session Request</h3>
            <table className="tps__minfo"><tbody>
              <tr><td>Student:</td><td>{s._student}</td></tr>
              <tr><td>Subject:</td><td>{s.subject}</td></tr>
              <tr><td>Date:</td><td>{fmtDate(s._date)}</td></tr>
              <tr><td>Time:</td><td>{fmtTime(s._time)}{calcEnd(s._time, s._duration) ? ` – ${calcEnd(s._time, s._duration)}` : ""}</td></tr>
              <tr><td>Duration:</td><td>{s._durationLabel || `${s._duration} minutes`}</td></tr>
              <tr><td>Group Size:</td><td>{s._groupSize} student{s._groupSize !== 1 ? "s" : ""}</td></tr>
            </tbody></table>
            <p className="tps__mwarn"><strong>Note:</strong> The session will be approved and scheduled. The student will be notified immediately.</p>
            <div className="tps__mbtns">
              <button className="tps__mbtn tps__mbtn--sec" onClick={() => setModal(null)}>Back</button>
              <button className="tps__mbtn tps__mbtn--accept" disabled={busy} onClick={() => doAction(async () => {
                await privateSessionService.acceptRequest(s.id);
                nav("/teacher/private-sessions", { state: { tab: "scheduled", refresh: true } });
              })}>{busy ? "Accepting..." : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {modal === "end" && (
        <div className="tps__overlay" onClick={() => setModal(null)}>
          <div className="tps__modal" onClick={e => e.stopPropagation()}>
            <h3>End Session?</h3>
            <p className="tps__mwarn"><strong>Note:</strong> This will end the session for all participants.</p>
            <div className="tps__mbtns">
              <button className="tps__mbtn tps__mbtn--sec" onClick={() => setModal(null)}>Back</button>
              <button className="tps__mbtn tps__mbtn--pri" disabled={busy} onClick={() => doAction(async () => {
                await privateSessionService.endSession(s.id);
                goBack();
              })}>{busy ? "..." : "End Session"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}