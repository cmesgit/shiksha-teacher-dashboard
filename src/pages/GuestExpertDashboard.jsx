// src/pages/GuestExpertDashboard.jsx  — REDESIGNED (correct colours)
// ──────────────────────────────────────────────────────────────────────
// Expert / Skill Dev teacher dashboard.
// Colours per Auth Flow handoff doc:
//   body bg  #f3e2da  (warm blush — from .teacher-content--expert)
//   sidebar  #b3402e  (from .sidebar--expert)
//   accent   #c0492f  (buttons, active elements, progress bar)
// White/light cards (#f4f7f8) on warm blush background.
// ──────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import expertService from "../api/expertService";
import useNotificationSocket from "../hooks/useNotificationSocket";
import "../styles/guestExpert.css";

/* ── Inline SVG icons ─────────────────────────────────────────────── */
const Ic = {
  Users: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Trending: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Bell: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Check: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Play: () => (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="white">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
};

const initOf = (s = "") =>
  (s || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

const ACTIVITY_COLORS = ["#c0492f", "#13899b", "#e07055", "#9b59b6", "#c0492f"];

export default function GuestExpertDashboard() {
  const { user, teacherInfo } = useAuth();
  const navigate = useNavigate();

  const [loading,        setLoading]        = useState(true);
  const [profile,        setProfile]        = useState(null);
  const [courses,        setCourses]        = useState([]);
  const [applications,   setApplications]   = useState([]);
  const [earnings,       setEarnings]       = useState({
    available: 0, payouts: [],
    month_earned: 0, month_sessions: 0,
    month_goal: 25000, goal_pct: 0,
  });
  const [nextUpSessions, setNextUpSessions] = useState([]);

  const { notifications: liveNotifs } = useNotificationSocket();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, c, a, e] = await Promise.all([
          expertService.getProfile(),
          expertService.getCourses(),
          expertService.getApplications(),
          expertService.getEarnings(),
        ]);
        if (cancelled) return;
        setProfile(p);
        setCourses(c.courses || []);
        setApplications(a.applications || []);
        setEarnings(e.earnings || {
          available: 0, payouts: [],
          month_earned: 0, month_sessions: 0,
          month_goal: 25000, goal_pct: 0,
        });
        setNextUpSessions(a.upcoming_sessions || []);
      } catch (err) {
        console.error("Expert dashboard load:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="ge-loading">Loading your dashboard…</div>;
  }

  const firstName = (
    profile?.name && profile.name !== "Your profile"
      ? profile.name
      : user?.active_profile?.display_name || user?.username || "there"
  ).split(" ")[0];

  const subtitle = profile?.title || teacherInfo?.expert_title || "Skill Dev teacher";

  const studentCount   = profile?.total_students   ?? courses.reduce((a, c) => a + (c.students ?? 0), 0);
  const activeLearners = profile?.active_learners  ?? 0;
  const pendingCount   = applications.length;
  const completedCount = profile?.completed_sessions ?? 0;

  const stats = [
    { value: studentCount,   label: "Students taught",  Icon: Ic.Users   },
    { value: activeLearners, label: "Active learners",   Icon: Ic.Trending },
    { value: pendingCount,   label: "Pending requests",  Icon: Ic.Bell    },
    { value: completedCount, label: "Sessions done",     Icon: Ic.Check   },
  ];

  const monthEarned   = earnings.month_earned  ?? earnings.available ?? 0;
  const monthGoal     = earnings.month_goal    ?? 25000;
  const monthSessions = earnings.month_sessions ?? 0;
  const goalPct       = earnings.goal_pct ?? (
    monthGoal > 0 ? Math.min(100, Math.round(monthEarned / monthGoal * 100)) : 0
  );

  const activity = liveNotifs.slice(0, 5).map((n, i) => ({
    color: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length],
    text:  n.message || n.body || n.text || "",
  }));

  const sessionList = nextUpSessions.length > 0 ? nextUpSessions : applications;

  return (
    <div className="ge-body-wrap">

      {/* ── Greeting ── */}
      <div className="ge-greeting">
        <h1>Hi {firstName} 👋</h1>
        <p>{subtitle}</p>
      </div>

      {/* ── Stats row ── */}
      <div className="ge-stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="ge-stat-card">
            <div className="ge-stat-icon"><s.Icon /></div>
            <div className="ge-stat-value">{s.value}</div>
            <div className="ge-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="ge-grid">

        {/* Left column — session queue */}
        <div className="ge-col-left">
          <div className="ge-card">
            <h4>Next up today</h4>

            {sessionList.length === 0 ? (
              <p className="ge-card-empty">No sessions scheduled for today.</p>
            ) : sessionList.slice(0, 4).map((s, i) => {
              const name      = s.student_name || s.name || "Student";
              const sessionNo = s.session_label || s.session || "";
              const topic     = s.subject || s.course || s.topic || "";
              const time      = s.display_time || s.when || "";
              const duration  = s.duration || "60 min";
              const link      = s.session_id
                ? `/teacher/private-sessions/scheduled/${s.session_id}`
                : s.id ? `/teacher/private-sessions/request/${s.id}` : null;
              const isNext = i === 0;

              return (
                <div key={s.id ?? i} className="ge-session-card">
                  <div className="ge-session-av">{initOf(name)}</div>
                  <div className="ge-session-info">
                    <div className="ge-session-name">{name}</div>
                    {(sessionNo || topic) && (
                      <div className="ge-session-meta">
                        {sessionNo}{sessionNo && topic ? " · " : ""}{topic}
                      </div>
                    )}
                    {time && (
                      <div className="ge-session-time">{time} · {duration}</div>
                    )}
                  </div>
                  {isNext ? (
                    <button
                      className="ge-session-cta"
                      onClick={() => link && navigate(link)}
                    >
                      <Ic.Play /> Start class
                    </button>
                  ) : (
                    <span className="ge-session-later">
                      {s.starts_in ?? "Later today"}
                    </span>
                  )}
                </div>
              );
            })}

            <button
              className="ge-more-link"
              onClick={() => navigate("/teacher/private-sessions")}
            >
              View all bookings →
            </button>
          </div>
        </div>

        {/* Right column — earnings + activity */}
        <div className="ge-col-right">

          <div className="ge-earnings-card">
            <h4>This month</h4>
            <div className="ge-earnings-amount">
              <span className="ge-earnings-big">
                ₹{(monthEarned / 1000).toFixed(1)}
              </span>
              <span className="ge-earnings-unit">k</span>
            </div>
            <div className="ge-earnings-sub">Earned · {monthSessions} sessions</div>
            <div className="ge-progress-bar">
              <div className="ge-progress-fill" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="ge-progress-label">
              {goalPct}% to your ₹{(monthGoal / 1000).toFixed(0)}k goal
            </div>
          </div>

          <div className="ge-activity-card">
            <h4>Recent activity</h4>
            <div className="ge-activity-list">
              {activity.length === 0 ? (
                <p className="ge-card-empty">No recent activity.</p>
              ) : activity.map((a, i) => (
                <div key={i} className="ge-act-row">
                  <div className="ge-act-dot" style={{ background: a.color }} />
                  <div className="ge-act-text">{a.text}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
