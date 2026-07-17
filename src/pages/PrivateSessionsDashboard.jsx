/**
 * FILE: teacher_ui/src/pages/PrivateSessionsDashboard.jsx
 * DEPLOYMENT READY — handles both real API and graceful errors
 *
 * Field names aligned to backend model:
 *   date, time, duration, subject, course, topic, status,
 *   teacher_name (from serializer), student_name, group_size,
 *   requested_by, participants, note, reschedule_date/time/note,
 *   room_name, created_at, updated_at
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as privateSessionService from "../api/privateSessionService";
import "../styles/privateSessions.css";
import { LoadingState } from "../components/StateViews";

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

function calcEnd(t, dur) {
  if (!t || !dur) return "";
  let mins = parseInt(dur, 10);
  if (isNaN(mins)) return "";
  if (t.includes("AM") || t.includes("PM") || t.includes("a.m") || t.includes("p.m")) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return "";
  const tot = h * 60 + (m || 0) + mins;
  const eh = Math.floor(tot / 60) % 24;
  const em = tot % 60;
  return `${eh % 12 || 12}:${String(em).padStart(2, "0")} ${eh >= 12 ? "p.m." : "a.m."}`;
}

function statusLabel(st) {
  const m = {
    approved: "Approved", ongoing: "On Going", pending: "Pending",
    needs_reconfirmation: "Reconfirmation", proposed_changes: "Proposed Changes",
    completed: "Completed", declined: "Declined",
    cancelled: "Cancelled", cancelled_by_student: "Cancelled",
    cancelled_by_teacher: "Cancelled", teacher_no_show: "Teacher No-Show",
    student_no_show: "Student No-Show", expired: "Expired", withdrawn: "Withdrawn",
  };
  return m[st] || st;
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
  const [reqStatusFilter, setReqStatusFilter] = useState("all");
  const [reqSubjectFilter, setReqSubjectFilter] = useState("all");

  // ✅ FIX 2: Auto-refresh + switch tab when navigated back with refresh flag
  useEffect(() => {
    if (loc.state?.refresh) {
      setRefreshKey((k) => k + 1);
      setTab(loc.state?.tab || "scheduled");   // ✅ actually switch to correct tab
      nav(loc.pathname, { replace: true, state: {} }); // ✅ clear state completely
    }
  }, [loc.state?.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [s, r] = await Promise.all([
          privateSessionService.getTeacherSessions().catch(() => []),  // ✅ FIX 1: was getSessions()
          privateSessionService.getRequests().catch(() => []),
        ]);
        setScheduled(s || []);
        setRequests(r || []);
      } catch (err) {
        console.error("Failed to load sessions:", err);
        setError("Failed to load sessions. Please try again.");
      }
      // History — may not have endpoint yet
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

  const pendingCount = requests.filter(r =>
    r.status === "pending" ||
    r.status === "proposed_changes" ||
    r.status === "needs_reconfirmation"
  ).length;

  const reqSubjects = useMemo(() => {
    const set = new Set(requests.map(r => r.subject));
    return [...set].sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let f = requests;
    if (reqStatusFilter !== "all") f = f.filter(r => r.status === reqStatusFilter);
    if (reqSubjectFilter !== "all") f = f.filter(r => r.subject === reqSubjectFilter);
    return f;
  }, [requests, reqStatusFilter, reqSubjectFilter]);

  const filteredHistory =
    historyFilter === "all" ? history : history.filter(h => h.status === historyFilter);

  const filteredScheduled = scheduled;

  return (
    <div className="tps">
      <h1 className="tps__title">Private Sessions</h1>

      {/* Tabs */}
      <div className="tps__tabs">
        <button
          className={`tps__tab ${tab === "scheduled" ? "tps__tab--active" : ""}`}
          onClick={() => setTab("scheduled")}
        >
          Scheduled
        </button>
        <button
          className={`tps__tab ${tab === "requests" ? "tps__tab--active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Requests{pendingCount > 0 && <span className="tps__tab-badge">{pendingCount}</span>}
        </button>
        <button
          className={`tps__tab ${tab === "history" ? "tps__tab--active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {loading && <LoadingState plain label="Loading sessions" />}
      {error && <div className="tps__empty" style={{ color: "#ef4444" }}>{error}</div>}

      {/* ═══ SCHEDULED ═══ */}
      {!loading && tab === "scheduled" && (
        <div className="tps__grid">
          {filteredScheduled.length === 0 && (
            <p className="tps__empty">No scheduled sessions yet.</p>
          )}
          {filteredScheduled.map((raw) => {
            const s = norm(raw);
            return (
              <div
                key={s.id}
                className="tps__scard"
                onClick={() => nav(`/teacher/private-sessions/scheduled/${s.id}`)}
              >
                <div className="tps__scard-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <h3 className="tps__scard-subject">{s.subject}</h3>
                    <span className={`tps__pill tps__pill--${s.status}`}>{statusLabel(s.status)}</span>
                  </div>
                  <p className="tps__scard-course">{s.course}</p>
                  {s.topic && <p className="tps__scard-topic">{s.topic}</p>}
                  {s._student && (
                    <p className="tps__scard-student">
                      👤 {s._student}{s._groupSize > 0 ? ` · ${s._groupSize} students` : ""}
                    </p>
                  )}
                </div>
                <div className="tps__scard-footer">
                  <span className="tps__scard-date">📅 {fmtDate(s._date)}</span>
                  <span className="tps__scard-time">
                    🕐 {fmtTime(s._time)}{calcEnd(s._time, s._duration) ? ` – ${calcEnd(s._time, s._duration)}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ REQUESTS ═══ */}
      {!loading && tab === "requests" && (
        <>
          <div className="tps__filters">
            <div className="tps__select-wrap">
              <select
                className="tps__select"
                value={reqStatusFilter}
                onChange={e => setReqStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="proposed_changes">Proposed Changes</option>
                <option value="needs_reconfirmation">Reconfirmation</option>
              </select>
              <span className="tps__select-arrow">▾</span>
            </div>
            <div className="tps__select-wrap">
              <select
                className="tps__select"
                value={reqSubjectFilter}
                onChange={e => setReqSubjectFilter(e.target.value)}
              >
                <option value="all">All Subjects</option>
                {reqSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="tps__select-arrow">▾</span>
            </div>
          </div>
          <div className="tps__grid">
            {filteredRequests.length === 0 && (
              <p className="tps__empty">No requests match your filters.</p>
            )}
            {filteredRequests.map((raw) => {
              const r = norm(raw);
              return (
                <div
                  key={r.id}
                  className="tps__scard"
                  onClick={() => nav(`/teacher/private-sessions/request/${r.id}`)}
                >
                  <div className="tps__scard-body">
                    <span className={`tps__pill tps__pill--${r.status}`}>{statusLabel(r.status)}</span>
                    <h3 className="tps__scard-subject" style={{ marginTop: 6 }}>{r.subject}</h3>
                    <p className="tps__scard-course">{r.course}</p>
                    {r.topic && <p className="tps__scard-topic">{r.topic}</p>}
                    <p className="tps__scard-student">
                      👤 {r._student}{r._groupSize > 0 ? ` · ${r._groupSize} students` : ""}
                    </p>
                    {r.note && (
                      <p className="tps__scard-topic" style={{ fontStyle: "italic", marginTop: 4 }}>
                        "{r.note}"
                      </p>
                    )}
                  </div>
                  <div className="tps__scard-footer">
                    <span className="tps__scard-date">📅 {fmtDate(r._date)}</span>
                    <span className="tps__scard-time">
                      🕐 {fmtTime(r._time)}{calcEnd(r._time, r._duration) ? ` – ${calcEnd(r._time, r._duration)}` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═══ HISTORY ═══ */}
      {!loading && tab === "history" && (
        <>
          <div className="tps__filters tps__filters--right">
            <div className="tps__select-wrap">
              <select
                className="tps__select"
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
              >
                <option value="all">All History</option>
                <option value="completed">Completed</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="teacher_no_show">Teacher/Student No-Show</option>
                <option value="student_no_show">Student No-Show</option>
                <option value="cancelled">Cancelled</option>
                <option value="cancelled_by_student">Cancelled by Student</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
              </select>
              <span className="tps__select-arrow">▾</span>
            </div>
          </div>
          <div className="tps__hlist">
            {filteredHistory.length === 0 && (
              <p className="tps__empty">
                No history found.
                {history.length === 0 ? " History endpoint may not be set up yet." : ""}
              </p>
            )}
            {filteredHistory.map((raw) => {
              const h = norm(raw);
              return (
                <div
                  key={h.id}
                  className="tps__hrow"
                  onClick={() => nav(`/teacher/private-sessions/history/${h.id}`)}
                >
                  <div className="tps__hrow-avatar">
                    <div className="tps__hrow-ph">{(h._student || "?")[0].toUpperCase()}</div>
                  </div>
                  <div className="tps__hrow-info">
                    <p className="tps__hrow-name">
                      {h._student}{h._studentId ? ` [${h._studentId}]` : ""}
                    </p>
                    <p className="tps__hrow-meta">
                      {h.course}{h._courseId ? `(${h._courseId})` : ""} – {h.subject}{h._subjectCode ? `(${h._subjectCode})` : ""}
                    </p>
                  </div>
                  <div className="tps__hrow-dt">
                    <p>📅 {fmtDate(h._date)}</p>
                    <p>🕐 {fmtTime(h._time)}{calcEnd(h._time, h._duration) ? ` to ${calcEnd(h._time, h._duration)}` : ""}</p>
                    <p>⏱ {h._actualDuration ? `${h._actualDuration} mins` : h._durationLabel || `${h._duration} mins`}</p>
                  </div>
                  <div className="tps__hrow-gs">👥 {h._groupSize}</div>
                  <div className="tps__hrow-st">
                    <span className={`tps__pill tps__pill--${h.status}`}>{statusLabel(h.status)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}