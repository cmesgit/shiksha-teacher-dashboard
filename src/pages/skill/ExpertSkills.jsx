/**
 * src/pages/skill/ExpertSkills.jsx
 *
 * "My skills" — split out of the old merged ExpertCourse.jsx ("My Profile")
 * so the sidebar matches design_handoff_skilldev's flat nav (Dashboard,
 * Bookings, Students, Availability, My skills, Profile, Inbox, Promote).
 * Availability moved to its own already-existing page; this keeps the
 * read-only subject/skills/about/languages summary that page also showed.
 *
 * The handoff's README describes this screen as "skill listing with
 * intro-video upload state" — the intro-video upload field actually lives on
 * ExpertProfileEdit.jsx ("Profile"), not here; this page covers the read-only
 * "skill listing" half. No pixel-exact mockup for this screen is interactive
 * in the standalone HTML to verify layout against (only Dashboard/Bookings/
 * Students/Inbox are — Availability/My skills/Profile/Promote are static
 * sidebar labels there), so this reuses the old merged page's already-real,
 * already-wired layout rather than inventing a new one from a one-line spec.
 *
 * Wired to the same two endpoints the old merged page used:
 *   GET /skill/teacher/profile/    → headline, skills, about, languages
 *   GET /skill/teacher/dashboard/  → rating / students / sessions stats
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";
import { LoadingState } from "../../components/StateViews";

const MODE_LABEL = { online: "Online", home: "At my place", travel: "I travel" };

export default function ExpertSkills() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [stats,   setStats]   = useState({ taught: 0, active: 0, pending: 0 });
  const [rating,  setRating]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get("/skill/teacher/profile/"),
      api.get("/skill/teacher/dashboard/"),
    ]).then(([p, d]) => {
      const profileData = p.status === "fulfilled" ? p.value.data : null;
      if (profileData) setProfile(profileData);

      // Dashboard's avg_rating wins; profile's cached rating is the fallback
      // when the dashboard call fails — computed here, not a second effect.
      let nextRating = null;
      if (d.status === "fulfilled") {
        const st = d.value.data.stats || {};
        setStats(st);
        if (st.avg_rating != null) nextRating = Number(st.avg_rating);
      }
      if (nextRating == null && profileData?.rating != null) nextRating = Number(profileData.rating);
      if (nextRating != null) setRating(nextRating);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState label="Loading your skills" />;
  }

  const subject   = profile?.headline || profile?.subject_description || "Your 1-on-1 course";
  const subjects  = profile?.subjects || [];          // every subject taught (multi-subject)
  const skills    = profile?.skill_tags || [];
  const languages = profile?.languages || [];
  const about     = profile?.bio || "";
  const mode      = MODE_LABEL[profile?.class_mode] || "Online";

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">My skills</div>
          <div className="sk-head__sub">What students see on your public listing.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="sk-btn sk-btn--ghost" onClick={() => navigate("/teacher/expert/profile")}>
            <Icon.cap size={14} /> Edit Profile
          </button>
        </div>
      </div>

      <div className="rd-card teacher">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 22, color: "#1a2c33", letterSpacing: "-.5px" }}>
              {subject}
            </div>
            <div style={{ fontSize: 12.5, color: "#6b7c83", marginTop: 5, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span>1-on-1 sessions</span>
              <span style={{ opacity: .5 }}>·</span>
              <span>{mode}</span>
            </div>
            {subjects.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                {subjects.map((sub) => (
                  <span key={sub} style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 100, background: "var(--skill-soft)", color: "var(--skill-ink)" }}>{sub}</span>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            <Metric icon={<Icon.star size={15} />} value={rating != null ? Number(rating).toFixed(1) : "—"} label="Avg rating" />
            <Metric icon={<Icon.users size={15} />} value={stats.taught ?? 0} label="Students taught" />
            <Metric icon={<Icon.cal size={15} />} value={stats.active ?? 0} label="Active sessions" />
          </div>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={sectionLabel}>Skills &amp; subjects</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {skills.map((s) => (
                <span key={s} style={tagStyle}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        {about && (
          <div style={{ marginTop: 16 }}>
            <div style={sectionLabel}>About</div>
            <p style={{ fontSize: 13, color: "#516066", lineHeight: 1.6, margin: 0 }}>{about}</p>
          </div>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={sectionLabel}>Languages</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {languages.map((l) => (
                <span key={l} style={{ ...tagStyle, background: "var(--skill-soft)", color: "var(--skill-ink)" }}>{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── small presentational helpers ── */
const sectionLabel = {
  fontSize: 10.5, fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase",
  color: "#9aa9af", marginBottom: 8,
};
const tagStyle = {
  fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 8,
  background: "#f4f7f8", color: "#516066",
};

function Metric({ icon, value, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: "var(--skill-ink)" }}>
        {icon}
        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 19, color: "#1a2c33", letterSpacing: "-.4px" }}>{value}</span>
      </div>
      <div style={{ fontSize: 10.5, color: "#9aa9af", marginTop: 3 }}>{label}</div>
    </div>
  );
}
