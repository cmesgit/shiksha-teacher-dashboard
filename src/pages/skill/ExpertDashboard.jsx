/**
 * src/pages/skill/ExpertDashboard.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Skill Dev overview ("My Dashboard"). Stats row + next-up sessions +
 * earnings snapshot + recent activity. Ported from the prototype's expert
 * dashboard tab.
 *
 * Route: /teacher/expert  (inside SkillDevLayout)
 * API TODO markers live in src/data/skillMockData.js.
 */
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import { STUDENTS, EARNINGS, NEXT_UP, ACTIVITY } from "../../data/skillMockData";
import "../../styles/skillDev.css";

const initOf = (s = "") =>
  (s || "?").trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function ExpertDashboard() {
  const navigate = useNavigate();

  const stats = [
    { c: "#0a808a", icon: <Icon.users size={16} />,  v: STUDENTS.taught,    l: "Students taught"   },
    { c: "#2f9d42", icon: <Icon.spark size={16} />,  v: STUDENTS.active,    l: "Active learners"   },
    { c: "#ff8f01", icon: <Icon.cal size={16} />,    v: STUDENTS.pending,   l: "Pending requests"  },
    { c: "#7c6fd0", icon: <Icon.check size={16} />,  v: STUDENTS.completed, l: "Sessions done"     },
  ];

  const goalPct = EARNINGS.month_goal
    ? Math.min(100, Math.round(EARNINGS.month_earned / EARNINGS.month_goal * 100))
    : 0;

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Hi Eric 👋</div>
          <div className="sk-head__sub">UI/UX Designer · Guest expert</div>
        </div>
        <button className="sk-btn sk-btn--ghost" onClick={() => navigate("/teacher/expert/courses")}>
          <Icon.plus size={14} /> New course
        </button>
      </div>

      {/* Stats */}
      <div className="rd-statgrid">
        {stats.map((s) => (
          <div key={s.l} className="rd-stat">
            <div className="ic" style={{ background: s.c + "22", color: s.c }}>{s.icon}</div>
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Two-column: next up + side */}
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
          {NEXT_UP.length === 0 ? (
            <div className="sk-empty">No sessions scheduled for today.</div>
          ) : NEXT_UP.map((b) => (
            <div key={b.name + b.time} className="rd-book">
              <span className="bt" style={{ background: "#13899b" }}>
                {b.time.split(":")[0]}
                <span style={{ fontSize: 9, opacity: .8 }}>{b.time.includes("PM") ? "PM" : "AM"}</span>
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2c33" }}>{b.name}</div>
                <div style={{ fontSize: 12, color: "#6b7c83" }}>{b.topic}</div>
                <div style={{ fontSize: 11.5, color: "#0a808a", fontWeight: 700, marginTop: 3 }}>{b.time} · {b.dur}</div>
              </div>
              {b.live ? (
                <button className="start" onClick={() => navigate("/teacher/expert/bookings")}>
                  <Icon.vid size={14} /> Start class
                </button>
              ) : (
                <span className="soon">{b.soon ? `Starts ${b.soon}` : "Scheduled"}</span>
              )}
            </div>
          ))}
        </div>

        {/* Side column: earnings + activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>This month</h4>
            <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 30, color: "#1a2c33", letterSpacing: "-.7px" }}>
                ₹{(EARNINGS.month_earned / 1000).toFixed(1)}
              </span>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#6b7c83" }}>k</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7c83", marginTop: 2 }}>Earned · {EARNINGS.month_sessions} sessions</div>
            <div style={{ height: 8, borderRadius: 100, background: "rgba(14,45,20,.1)", overflow: "hidden", margin: "10px 0 5px" }}>
              <div style={{ width: `${goalPct}%`, height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#13899b,#1dcaab)" }} />
            </div>
            <div style={{ fontSize: 11, color: "#9aa9af" }}>{goalPct}% to your ₹{(EARNINGS.month_goal / 1000).toFixed(0)}k goal</div>
          </div>

          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>Recent activity</h4>
            {ACTIVITY.length === 0 ? (
              <div className="sk-empty">No recent activity.</div>
            ) : ACTIVITY.map((a, i) => (
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
