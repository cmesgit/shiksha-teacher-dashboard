// src/pages/GuestExpertDashboard.jsx  — FULL REPLACEMENT
// ──────────────────────────────────────────────────────────────────────
// Rework of the expert teacher dashboard to match the new Skill Dev
// design: forest-dark sidebar (handled by Sidebar.jsx + isExpertRoute),
// cream background, Montserrat/Poppins, orange CTAs.
//
// Route:   /teacher/expert  (inside TeacherLayout)
// Who:     GUEST teachers always land here.
//          BOTH teachers land here when active_track === "skill" or
//          when they click "Skill Dev" in the TrackSwitcher.
//
// API:     expertService.getProfile / getCourses / getApplications / getEarnings
//          (same service as before — no changes needed there).
// ──────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import expertService from "../api/expertService";
import useNotificationSocket from "../hooks/useNotificationSocket";
import {
  Users, TrendingUp, Bell, CheckCircle,
  Play, Calendar, Clock, DollarSign
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  forestDk:  "#003223",
  forest:    "#125027",
  forestMid: "#1b9c85",
  orange:    "#ff8f01",
  cream:     "#f5eedb",
  cream2:    "#f7f1de",
  earth:     "#e8e0cc",
  border:    "rgba(9,62,5,.13)",
  ink:       "#0e1c0f",
  soft:      "rgba(14,28,15,.52)",
};
const MH = '"Montserrat", system-ui, sans-serif';
const MP = '"Poppins", system-ui, sans-serif';

/* ── Helpers ───────────────────────────────────────────────────────── */
const initOf = (s = "") =>
  (s || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

function Bar({ pct, color = C.forestMid, h = 8 }) {
  return (
    <div style={{ height: h, borderRadius: 100, background: "rgba(9,62,5,.10)", overflow: "hidden", margin: "10px 0 5px" }}>
      <div style={{ width: `${Math.min(100, pct ?? 0)}%`, height: "100%", borderRadius: 100, background: color }} />
    </div>
  );
}

function Avatar({ text, size = 42, bg = C.earth }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.27, background: bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.ink, fontSize: size * 0.3, fontWeight: 800, fontFamily: MH }}>
      {initOf(text)}
    </div>
  );
}

function StatCard({ value, label, Icon }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 10px rgba(18,80,39,.04)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: C.cream2, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icon size={18} color={C.forest} strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: MH, fontWeight: 900, fontSize: 26, color: C.ink, letterSpacing: "-.6px" }}>{value}</div>
      <div style={{ fontSize: 12, color: C.soft, marginTop: 3, fontFamily: MP }}>{label}</div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function GuestExpertDashboard() {
  const { user, teacherInfo } = useAuth();
  const navigate = useNavigate();

  const [loading,      setLoading]      = useState(true);
  const [profile,      setProfile]      = useState(null);
  const [courses,      setCourses]      = useState([]);
  const [applications, setApplications] = useState([]);
  const [earnings,     setEarnings]     = useState({ available: 0, payouts: [], month_earned: 0, month_sessions: 0, month_goal: 25000, goal_pct: 0 });
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
        setEarnings(e.earnings || { available: 0, payouts: [], month_earned: 0, month_sessions: 0, month_goal: 25000, goal_pct: 0 });
        // next-up sessions may come from applications or a separate endpoint
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
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: MP, color: C.soft, background: C.cream2 }}>
        Loading your dashboard…
      </div>
    );
  }

  const firstName = (
    profile?.name && profile.name !== "Your profile"
      ? profile.name
      : user?.active_profile?.display_name || user?.username || "there"
  ).split(" ")[0];

  const subtitle = profile?.title || teacherInfo?.expert_title || "Guest expert";
  const avatarStr = initOf(profile?.name || user?.username || "ET");

  // Compute stats
  const studentCount  = profile?.total_students   ?? courses.reduce((a, c) => a + (c.students ?? 0), 0);
  const activeLearners= profile?.active_learners  ?? 0;
  const pendingCount  = applications.length;
  const completedCount= profile?.completed_sessions ?? 0;

  const stats = [
    { value: studentCount,   label: "Students taught",   Icon: Users       },
    { value: activeLearners, label: "Active learners",    Icon: TrendingUp  },
    { value: pendingCount,   label: "Pending requests",   Icon: Bell        },
    { value: completedCount, label: "Completed",          Icon: CheckCircle },
  ];

  // Earnings summary
  const monthEarned  = earnings.month_earned  ?? earnings.available ?? 0;
  const monthGoal    = earnings.month_goal    ?? 25000;
  const monthSessions= earnings.month_sessions ?? 0;
  const goalPct      = earnings.goal_pct       ?? (monthGoal > 0 ? Math.min(100, Math.round(monthEarned / monthGoal * 100)) : 0);

  // Recent activity from notifications
  const activityColors = [C.teal, C.forestMid, C.orange, C.teal, C.forestMid];
  const activity = liveNotifs.slice(0, 5).map((n, i) => ({
    color: activityColors[i % activityColors.length],
    text: n.message || n.body || n.text || "",
  }));

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: MP, background: C.cream2, overflow: "hidden" }}>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px" }}>

        {/* Greeting */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontFamily: MH, fontWeight: 900, fontSize: 26, color: C.ink, letterSpacing: "-.5px", margin: 0 }}>
            Hi {firstName} 👋
          </h1>
          <p style={{ fontSize: 13, color: C.soft, margin: "4px 0 0", fontFamily: MP }}>{subtitle}</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* Next up today */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontFamily: MH, fontWeight: 800, fontSize: 15, color: C.ink, letterSpacing: "-.3px", margin: 0 }}>Next up today</h3>
        </div>

        {nextUpSessions.length === 0 && applications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", color: C.soft, fontSize: 13, background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, fontFamily: MP, marginBottom: 16 }}>
            No sessions scheduled for today.
          </div>
        ) : (nextUpSessions.length > 0 ? nextUpSessions : applications).slice(0, 4).map((s, i) => {
          const name      = s.student_name || s.name || "Student";
          const sessionNo = s.session_label || s.session || "";
          const topic     = s.subject || s.course || s.topic || "";
          const time      = s.display_time || s.when || "";
          const duration  = s.duration || "60 min";
          const link      = s.session_id
            ? `/teacher/private-sessions/scheduled/${s.session_id}`
            : s.id ? `/teacher/private-sessions/request/${s.id}` : null;
          const isNext    = i === 0;

          return (
            <div key={s.id ?? i} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 12, boxShadow: "0 2px 10px rgba(18,80,39,.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar text={name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: MH, fontWeight: 800, fontSize: 14, color: C.ink }}>{name}</div>
                  {sessionNo && (
                    <div style={{ fontSize: 11.5, color: C.soft, marginTop: 1, fontFamily: MP }}>{sessionNo}{topic && ` · ${topic}`}</div>
                  )}
                  {time && (
                    <div style={{ fontSize: 12, color: C.orange, fontWeight: 600, marginTop: 4, fontFamily: MP }}>{time} · {duration}</div>
                  )}
                </div>
                {isNext ? (
                  <button onClick={() => link && navigate(link)} style={{
                    all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 10, background: C.orange, color: "#fff",
                    fontSize: 12, fontWeight: 700, flexShrink: 0, fontFamily: MP,
                  }}>
                    <Play size={12} fill="white" color="white" /> Start class
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: C.soft, flexShrink: 0, fontFamily: MP }}>
                    {s.starts_in ?? "Later today"}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <button onClick={() => navigate("/teacher/private-sessions")} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: C.forestMid, fontWeight: 600, fontFamily: MP }}>
          View all bookings →
        </button>
      </div>

      {/* ── Right panel ── */}
      <div style={{ width: 280, minWidth: 280, overflowY: "auto", padding: "24px 20px 24px 0" }}>

        {/* Earnings */}
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", marginBottom: 12, boxShadow: "0 2px 10px rgba(18,80,39,.04)" }}>
          <h3 style={{ fontFamily: MH, fontWeight: 800, fontSize: 14, color: C.ink, margin: "0 0 14px", letterSpacing: "-.25px" }}>This month</h3>
          <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <span style={{ fontFamily: MH, fontWeight: 900, fontSize: 30, color: C.ink, letterSpacing: "-.7px" }}>
              ₹{(monthEarned / 1000).toFixed(1)}
            </span>
            <span style={{ fontFamily: MH, fontWeight: 700, fontSize: 15, color: C.ink, opacity: .7 }}>k</span>
          </div>
          <div style={{ fontSize: 12, color: C.soft, marginTop: 2, fontFamily: MP }}>Earned · {monthSessions} sessions</div>
          <Bar pct={goalPct} color={C.forestMid} h={8} />
          <div style={{ fontSize: 11, color: C.soft, marginTop: 4, fontFamily: MP }}>
            {goalPct}% to your ₹{(monthGoal / 1000).toFixed(0)}k goal
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px", boxShadow: "0 2px 10px rgba(18,80,39,.04)" }}>
          <h3 style={{ fontFamily: MH, fontWeight: 800, fontSize: 14, color: C.ink, margin: "0 0 14px", letterSpacing: "-.25px" }}>Recent activity</h3>
          {activity.length === 0 ? (
            <p style={{ fontSize: 12, color: C.soft, fontFamily: MP }}>No recent activity.</p>
          ) : activity.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 12 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: a.color, marginTop: 4, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: C.soft, lineHeight: 1.45, fontFamily: MP }}>{a.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
