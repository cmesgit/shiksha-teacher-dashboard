/**
 * src/pages/skill/ExpertDashboard.jsx
 * Wired to GET /skill/teacher/dashboard/
 *
 * Follows the Expert Teacher Skill Dev design:
 *   Stats:            Total Students · Lessons Taught · Avg Rating · Pending
 *                     ("Students Who Paid" from the design is intentionally
 *                     dropped — payment tracking is not part of the product.)
 *   Upcoming bookings: next sessions from now onward (not just today).
 *   Recent reviews:    latest learner reviews with stars.
 *   Advertising card:  reach + subscription state → Promote.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";
import { LoadingState } from "../../components/StateViews";

function fmtWhen(iso) {
  if (!iso) return "Time to be confirmed";
  try {
    const d = new Date(iso);
    const now = new Date();
    const t = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    const tom = new Date(now); tom.setDate(now.getDate() + 1);
    if (sameDay(d, now)) return `Today · ${t}`;
    if (sameDay(d, tom)) return `Tomorrow · ${t}`;
    return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${t}`;
  } catch { return iso; }
}

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return ""; }
}

function Stars({ n }) {
  const full = Math.round(n || 0);
  return (
    <span style={{ color: "#ff8f01", fontSize: 12, letterSpacing: 1 }}>
      {"★".repeat(full)}<span style={{ color: "#e2e2e2" }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}

const EMPTY = {
  stats:          { taught: 0, total_students: 0, active: 0, pending: 0, avg_rating: null, reviews_count: 0 },
  next_up:        [],
  recent_reviews: [],
  advertising:    { is_advertised: false, is_featured: false, reach_count: 0,
                    billing_free: true, sub_status: "none", sub_active: false, period_end: null },
  profile_todo:   { needs_payment: false, needs_location: false },
  activity:       [],
};

export default function ExpertDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [profile, setProfile] = useState({ name: "", subtitle: "" });

  const load = () => {
    setError("");
    api.get("/skill/teacher/dashboard/")
      .then(r => setData({ ...EMPTY, ...r.data, stats: { ...EMPTY.stats, ...(r.data.stats || {}) } }))
      .catch(() => setError("Couldn't load your dashboard."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/accounts/me/").then(r => {
      const me = r.data;
      const name = me?.active_profile?.display_name
        || me?.active_profile?.first_name || me?.username || "there";
      const tp = me?.teacher || {};
      setProfile({
        name,
        subtitle: tp.type === "GUEST" ? (tp.headline || "Guest expert") : "Expert teacher",
      });
    }).catch(() => {});
  }, []);

  const { stats, next_up, recent_reviews, advertising, profile_todo, activity } = data;

  const statCards = [
    { c: "#0a808a", icon: <Icon.users size={16} />, v: stats.total_students ?? stats.taught, l: "Total students" },
    { c: "#2f9d42", icon: <Icon.check size={16} />, v: stats.taught,   l: "Lessons taught" },
    { c: "#ff8f01", icon: <Icon.star size={16} />,
      v: stats.avg_rating != null ? Number(stats.avg_rating).toFixed(1) : "—",
      l: stats.reviews_count ? `Avg rating · ${stats.reviews_count} review${stats.reviews_count === 1 ? "" : "s"}` : "Avg rating" },
    { c: "#7c6fd0", icon: <Icon.cal size={16} />,   v: stats.pending,  l: "Pending requests" },
  ];

  const adv   = advertised(advertising);
  const todos = buildTodos(profile_todo);

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">
            {loading ? "Loading…" : `Hi ${profile.name} 👋`}
          </div>
          <div className="sk-head__sub">{profile.subtitle}</div>
        </div>
      </div>

      {error && !loading && (
        <div className="rd-card teacher" style={{ borderLeft: "3px solid #c0492f", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#6b7c83" }}>{error}</span>
          <button className="sk-btn sk-btn--ghost" onClick={() => { setLoading(true); load(); }}>Retry</button>
        </div>
      )}

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

        {/* Left column: upcoming bookings + recent reviews */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Upcoming bookings</h4>
              <button
                onClick={() => navigate("/teacher/expert/bookings")}
                style={{ background: "none", border: "none", color: "#0a808a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                All bookings →
              </button>
            </div>
            {loading ? (
              <LoadingState plain label="Loading sessions" />
            ) : next_up.length === 0 ? (
              <div className="sk-empty">No upcoming sessions. New booking requests will appear here.</div>
            ) : next_up.map((b) => (
              <div key={b.id} className="rd-book">
                <span className="bt" style={{ background: b.status === "requested" ? "#ff8f01" : "#13899b" }}>
                  <Icon.cal size={15} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2c33" }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7c83" }}>{b.topic}</div>
                  <div style={{ fontSize: 11.5, color: "#0a808a", fontWeight: 700, marginTop: 3 }}>
                    {fmtWhen(b.scheduled_for)} · {b.duration_mins} min
                  </div>
                </div>
                {b.status === "requested" ? (
                  <button className="start" style={{ background: "#ff8f01" }} onClick={() => navigate("/teacher/expert/bookings")}>
                    Respond
                  </button>
                ) : b.live ? (
                  <button className="start" onClick={() => navigate("/teacher/expert/bookings")}>
                    <Icon.vid size={14} /> Start class
                  </button>
                ) : (
                  <span className="soon">Scheduled</span>
                )}
              </div>
            ))}
          </div>

          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>Recent reviews</h4>
            {loading ? (
              <LoadingState plain label="Loading reviews" />
            ) : recent_reviews.length === 0 ? (
              <div className="sk-empty">No reviews yet — they'll appear here after your first completed sessions.</div>
            ) : recent_reviews.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 11, padding: "10px 0", borderBottom: "1px solid #f0eee8" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#13899b", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {(r.reviewer || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2c33" }}>{r.reviewer}</span>
                    <span style={{ fontSize: 11, color: "#9aa9af", flexShrink: 0 }}>{fmtDate(r.created_at)}</span>
                  </div>
                  <Stars n={r.rating} />
                  {r.body && <div style={{ fontSize: 12.5, color: "#6b7c83", lineHeight: 1.55, marginTop: 3 }}>{r.body}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: advertising + activity */}
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
    return { label: "Live · free", bg: "#2f9d4222", fg: "#2f9d42",
             blurb: "You're advertised free during the launch period." };
  }
  if (a.is_advertised) {
    return { label: "Live", bg: "#2f9d4222", fg: "#2f9d42",
             blurb: "Your profile is promoted across ShikshaCom." };
  }
  if (a.sub_status === "submitted") {
    return { label: "Pending", bg: "#ff8f0122", fg: "#b46a00",
             blurb: "Payment submitted — we're verifying your subscription." };
  }
  return { label: "Not promoted", bg: "#9aa9af22", fg: "#6b7c83",
           blurb: "Subscribe to be advertised consistently and grow your reach." };
}

function buildTodos(p = {}) {
  const out = [];
  if (p.needs_location) {
    out.push({
      key: "loc", to: "/teacher/expert/profile", cta: "Add location",
      text: "Add your class location so nearby learners can find you for offline lessons.",
    });
  }
  return out;
}
