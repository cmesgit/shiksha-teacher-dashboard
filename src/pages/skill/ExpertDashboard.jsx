/**
 * src/pages/skill/ExpertDashboard.jsx
 * Wired to GET /skill/teacher/dashboard/
 * Falls back to empty-state UI if the endpoint isn't ready yet.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

const initOf = (s = "") =>
  (s || "?").trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

const EMPTY = {
  stats:    { taught: 0, active: 0, pending: 0, course_students: 0 },
  next_up:  [],
  earnings: { month_earned: 0, month_sessions: 0, month_goal: 25000 },
  activity: [],
};

export default function ExpertDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ name: "", subtitle: "" });

  useEffect(() => {
    // Fetch dashboard data
    api.get("/skill/teacher/dashboard/")
      .then(r => setData(r.data))
      .catch(() => {/* keep empty state */})
      .finally(() => setLoading(false));

    // Fetch own profile for the greeting
    api.get("/accounts/me/").then(r => {
      const me = r.data;
      const name = me?.active_profile?.display_name
        || me?.active_profile?.first_name
        || me?.username
        || "there";
      const tp = me?.teacher || {};
      setProfile({
        name,
        subtitle: tp.type === "GUEST"
          ? (tp.headline || "Guest expert")
          : "Expert teacher",
      });
    }).catch(() => {});
  }, []);

  const { stats, next_up, earnings, activity } = data;
  const goalPct = earnings.month_goal
    ? Math.min(100, Math.round((earnings.month_earned / earnings.month_goal) * 100))
    : 0;

  const statCards = [
    { c: "#0a808a", icon: <Icon.users size={16} />,  v: stats.taught,          l: "Students taught"   },
    { c: "#2f9d42", icon: <Icon.spark size={16} />,  v: stats.active,          l: "Active sessions"   },
    { c: "#ff8f01", icon: <Icon.cal size={16} />,    v: stats.pending,         l: "Pending requests"  },
    { c: "#7c6fd0", icon: <Icon.check size={16} />,  v: stats.course_students, l: "Course students"   },
  ];

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">
            {loading ? "Loading…" : `Hi ${profile.name} 👋`}
          </div>
          <div className="sk-head__sub">{profile.subtitle}</div>
        </div>
        <button className="sk-btn sk-btn--ghost" onClick={() => navigate("/teacher/expert/courses")}>
          <Icon.plus size={14} /> New course
        </button>
      </div>

      {/* Stats */}
      <div className="rd-statgrid">
        {statCards.map((s) => (
          <div key={s.l} className="rd-stat">
            <div className="ic" style={{ background: s.c + "22", color: s.c }}>{s.icon}</div>
            <div className="v">{loading ? "—" : s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Two-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }} className="sk-dash-grid">

        {/* Next up today */}
        <div className="rd-card teacher">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>Next up today</h4>
            <button
              onClick={() => navigate("/teacher/expert/bookings")}
              style={{ background: "none", border: "none", color: "#0a808a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              All bookings →
            </button>
          </div>
          {loading ? (
            <div className="sk-empty">Loading sessions…</div>
          ) : next_up.length === 0 ? (
            <div className="sk-empty">No sessions scheduled for today.</div>
          ) : next_up.map((b) => (
            <div key={b.id} className="rd-book">
              <span className="bt" style={{ background: "#13899b" }}>
                {fmtTime(b.scheduled_for).split(":")[0]}
                <span style={{ fontSize: 9, opacity: .8 }}>
                  {fmtTime(b.scheduled_for).includes("PM") ? "PM" : "AM"}
                </span>
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2c33" }}>{b.name}</div>
                <div style={{ fontSize: 12, color: "#6b7c83" }}>{b.topic}</div>
                <div style={{ fontSize: 11.5, color: "#0a808a", fontWeight: 700, marginTop: 3 }}>
                  {fmtTime(b.scheduled_for)} · {b.duration_mins} min
                </div>
              </div>
              {b.live ? (
                <button className="start" onClick={() => navigate("/teacher/expert/bookings")}>
                  <Icon.vid size={14} /> Start class
                </button>
              ) : (
                <span className="soon">Scheduled</span>
              )}
            </div>
          ))}
        </div>

        {/* Side: earnings + activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>This month</h4>
            <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 30, color: "#1a2c33", letterSpacing: "-.7px" }}>
                ₹{((earnings.month_earned || 0) / 1000).toFixed(1)}
              </span>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#6b7c83" }}>k</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7c83", marginTop: 2 }}>
              Earned · {earnings.month_sessions} sessions
            </div>
            <div style={{ height: 8, borderRadius: 100, background: "rgba(14,45,20,.1)", overflow: "hidden", margin: "10px 0 5px" }}>
              <div style={{ width: `${goalPct}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#13899b,#1dcaab)" }} />
            </div>
            <div style={{ fontSize: 11, color: "#9aa9af" }}>
              {goalPct}% to your ₹{((earnings.month_goal || 0) / 1000).toFixed(0)}k goal
            </div>
          </div>

          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>Recent activity</h4>
            {activity.length === 0 ? (
              <div className="sk-empty">No recent activity.</div>
            ) : activity.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, marginTop: 5, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: "#6b7c83", lineHeight: 1.5 }}>{a.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
