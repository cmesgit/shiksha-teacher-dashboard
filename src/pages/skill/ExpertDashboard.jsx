/**
 * src/pages/skill/ExpertDashboard.jsx
 * Wired to GET /skill/teacher/dashboard/
 *
 * Change from original:
 *   The "This month" EARNINGS card is removed — guest experts settle payment
 *   directly with learners (off-platform), so there is no earnings bar. In its
 *   place we show an ADVERTISING status card (reach + subscription state, with a
 *   link to Promote) and profile-completion nudges (add payment UPI / location).
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

const EMPTY = {
  stats:        { taught: 0, active: 0, pending: 0, course_students: 0 },
  next_up:      [],
  advertising:  { is_advertised: false, is_featured: false, reach_count: 0,
                  billing_free: true, sub_status: "none", sub_active: false, period_end: null },
  profile_todo: { needs_payment: false, needs_location: false },
  activity:     [],
};

export default function ExpertDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ name: "", subtitle: "" });

  useEffect(() => {
    api.get("/skill/teacher/dashboard/")
      .then(r => setData({ ...EMPTY, ...r.data }))
      .catch(() => {/* keep empty state */})
      .finally(() => setLoading(false));

    api.get("/accounts/me/").then(r => {
      const me = r.data;
      const name = me?.active_profile?.display_name
        || me?.active_profile?.first_name
        || me?.username
        || "there";
      const tp = me?.teacher || {};
      setProfile({
        name,
        subtitle: tp.type === "GUEST" ? (tp.headline || "Guest expert") : "Expert teacher",
      });
    }).catch(() => {});
  }, []);

  const { stats, next_up, advertising, profile_todo, activity } = data;

  const statCards = [
    { c: "#0a808a", icon: <Icon.users size={16} />,  v: stats.taught,          l: "Students taught"   },
    { c: "#2f9d42", icon: <Icon.spark size={16} />,  v: stats.active,          l: "Active sessions"   },
    { c: "#ff8f01", icon: <Icon.cal size={16} />,    v: stats.pending,         l: "Pending requests"  },
    // HIDDEN until skill-courses are implemented:
    // { c: "#7c6fd0", icon: <Icon.check size={16} />,  v: stats.course_students, l: "Course students"   },
  ];

  const adv     = advertised(advertising);
  const todos   = buildTodos(profile_todo);

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">
            {loading ? "Loading…" : `Hi ${profile.name} 👋`}
          </div>
          <div className="sk-head__sub">{profile.subtitle}</div>
        </div>
        {/* HIDDEN until skill-courses are implemented:
        <button className="sk-btn sk-btn--ghost" onClick={() => navigate("/teacher/expert/courses")}>
          <Icon.plus size={14} /> New course
        </button> */}
      </div>

      {/* Profile-completion nudges */}
      {!loading && todos.length > 0 && (
        <div className="rd-card teacher" style={{ borderLeft: "3px solid #ff8f01" }}>
          <h4 style={{ margin: "0 0 8px" }}>Finish setting up</h4>
          {todos.map((t) => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
              <div style={{ fontSize: 13, color: "#6b7c83" }}>{t.text}</div>
              <button className="sk-btn sk-btn--ghost" onClick={() => navigate(t.to)} style={{ flexShrink: 0 }}>
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      )}

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
              {b.status === "requested" ? (
                <span className="soon" style={{ color: "#b46a00", background: "#ff8f0122" }}>Pending</span>
              ) : (
                <button className="start" onClick={() => navigate("/teacher/expert/bookings")}>
                  <Icon.vid size={14} /> Start class
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Side: advertising status + activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>Advertising</h4>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 100,
                background: adv.bg, color: adv.fg,
              }}>{adv.label}</span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 30, color: "#1a2c33", letterSpacing: "-.7px" }}>
                {loading ? "—" : (advertising.reach_count ?? 0).toLocaleString("en-IN")}
              </span>
              <span style={{ fontSize: 12, color: "#6b7c83", fontWeight: 700 }}>reach</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7c83", marginTop: 2, lineHeight: 1.5 }}>
              {adv.blurb}
            </div>

            <button
              className="sk-btn sk-btn--primary"
              onClick={() => navigate("/teacher/expert/promote")}
              style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
            >
              {advertising.sub_active ? "Manage subscription" : "Promote my profile"}
            </button>
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

/* Derive the advertising badge + copy from the dashboard payload. */
function advertised(a = {}) {
  if (a.is_advertised && a.billing_free) {
    return {
      label: "Live · free", bg: "#2f9d4222", fg: "#2f9d42",
      blurb: "You're advertised free during the launch period.",
    };
  }
  if (a.is_advertised) {
    return {
      label: "Live", bg: "#2f9d4222", fg: "#2f9d42",
      blurb: "Your profile is promoted across ShikshaCom.",
    };
  }
  if (a.sub_status === "submitted") {
    return {
      label: "Pending", bg: "#ff8f0122", fg: "#b46a00",
      blurb: "Payment submitted — we're verifying your subscription.",
    };
  }
  return {
    label: "Not promoted", bg: "#9aa9af22", fg: "#6b7c83",
    blurb: "Subscribe to be advertised consistently and grow your reach.",
  };
}

function buildTodos(p = {}) {
  const out = [];
  if (p.needs_payment) {
    out.push({
      key: "pay", to: "/teacher/expert/profile", cta: "Add UPI",
      text: "Add your UPI so learners can pay you directly for sessions.",
    });
  }
  if (p.needs_location) {
    out.push({
      key: "loc", to: "/teacher/expert/profile", cta: "Add location",
      text: "Add your class location so nearby learners can find you for offline lessons.",
    });
  }
  return out;
}
