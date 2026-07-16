/**
 * src/pages/skill/ExpertCourse.jsx  —  "My Profile" (Expert / Skill Dev)
 *
 * The guest expert's single 1-on-1 teaching profile. The "courses" product
 * concept is scrapped for launch, so this is purely the public teaching
 * profile + weekly availability that learners see and book against — no rate
 * or pricing (booking is free at launch, toggled globally from admin).
 *
 * It merges two things that used to be separate screens:
 *   1. the teaching profile (subject, skills, about, languages) and
 *   2. the weekly availability grid (was ExpertAvailability.jsx).
 *
 * Wired to:
 *   GET   /skill/teacher/profile/       → headline, skills, about, languages
 *   GET   /skill/teacher/dashboard/     → rating / students / sessions stats
 *   GET   /skill/teacher/availability/  → { open, booked }
 *   PATCH /skill/teacher/availability/  → { open: [...] }
 * "Edit Profile" opens the full profile editor (ExpertProfileEdit).
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import { DAYS, SLOTS } from "../../api/availabilityStore";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

const MODE_LABEL = { online: "Online", home: "At my place", travel: "I travel" };

export default function ExpertCourse() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [stats,   setStats]   = useState({ taught: 0, active: 0, pending: 0 });
  const [rating,  setRating]  = useState(null);
  const [avail,   setAvail]   = useState({ open: [], booked: [] });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    Promise.allSettled([
      api.get("/skill/teacher/profile/"),
      api.get("/skill/teacher/dashboard/"),
      api.get("/skill/teacher/availability/"),
    ]).then(([p, d, a]) => {
      if (p.status === "fulfilled") setProfile(p.value.data);
      if (d.status === "fulfilled") {
        const st = d.value.data.stats || {};
        setStats(st);
        if (st.avg_rating != null) setRating(Number(st.avg_rating));
      }
      if (a.status === "fulfilled") {
        setAvail({ open: a.value.data.open || [], booked: a.value.data.booked || [] });
      }
    }).finally(() => setLoading(false));
  }, []);

  // Fallback: profile payload also carries the cached rating.
  useEffect(() => {
    if (profile?.rating != null) setRating(r => (r != null ? r : Number(profile.rating)));
  }, [profile]);

  const toggle = (k) => {
    if (avail.booked.includes(k)) return;           // an accepted booking — locked
    setAvail(prev => ({
      ...prev,
      open: prev.open.includes(k) ? prev.open.filter(x => x !== k) : [...prev.open, k],
    }));
    setSaved(false);
  };

  const resetAvail = () => { setAvail(prev => ({ ...prev, open: [] })); setSaved(false); };

  const saveAvail = async () => {
    setSaving(true); setError("");
    try {
      const r = await api.patch("/skill/teacher/availability/", { open: avail.open });
      setAvail({ open: r.data.open || avail.open, booked: r.data.booked || avail.booked });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Couldn't save your availability. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sk-page">
        <div className="sk-empty">Loading your profile…</div>
      </div>
    );
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
          <div className="sk-head__title">My Profile</div>
          <div className="sk-head__sub">Your 1-on-1 teaching profile — what students see on your public listing.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="sk-btn sk-btn--ghost" onClick={() => navigate("/teacher/expert/profile")}>
            <Icon.cap size={14} /> Edit Profile
          </button>
        </div>
      </div>

      {/* ── Course header card ── */}
      <div className="rd-card teacher" style={{ "--acc": "#13899b" }}>
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
                  <span key={sub} style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 100, background: "#e7f3f4", color: "#0a808a" }}>{sub}</span>
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
                <span key={l} style={{ ...tagStyle, background: "#eef4f5", color: "#0a808a" }}>{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Weekly availability ── */}
      <div className="rd-card teacher" style={{ "--acc": "#13899b" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
          <h4 style={{ margin: 0 }}>Weekly availability</h4>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {saved && (
              <span style={{ fontSize: 12, color: "#2f9d42", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon.check size={13} /> Saved
              </span>
            )}
            <button className="sk-btn sk-btn--ghost" style={{ padding: "8px 14px", fontSize: 12 }} onClick={resetAvail} disabled={saving}>
              Reset
            </button>
            <button className="sk-btn" style={{ padding: "8px 16px", fontSize: 12 }} onClick={saveAvail} disabled={saving}>
              {saving ? "Saving…" : "Save availability"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#6b7c83", margin: "0 0 12px", lineHeight: 1.5 }}>
          Click a slot to toggle it on/off — this weekly pattern <b>repeats every week</b>,
          and students book the next upcoming date for a slot. Accepted bookings are locked.
        </p>

        {error && (
          <div style={{ background: "rgba(192,73,47,.1)", color: "#c0492f", padding: "9px 13px", borderRadius: 9, fontSize: 12.5, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6b7c83", marginBottom: 14, flexWrap: "wrap" }}>
          <Legend color="#13899b" label="Open" />
          <Legend color="#f0a23b" label="Booked · locked" />
          <Legend color="#fff" border label="Closed" />
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `64px repeat(${DAYS.length}, minmax(54px, 1fr))`,
            gap: 6, alignItems: "center", minWidth: 420,
          }}>
            <div />
            {DAYS.map((d) => (
              <div key={d} style={{ fontSize: 10.5, fontWeight: 700, color: "#6b7c83", textAlign: "center" }}>{d}</div>
            ))}
            {SLOTS.map((sl, si) => (
              <Row key={sl} sl={sl} si={si} avail={avail} toggle={toggle} />
            ))}
          </div>
        </div>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: "#0a808a" }}>
        {icon}
        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 19, color: "#1a2c33", letterSpacing: "-.4px" }}>{value}</span>
      </div>
      <div style={{ fontSize: 10.5, color: "#9aa9af", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function Legend({ color, border, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color, border: border ? "1px solid #e3dccf" : "none" }} />
      {label}
    </span>
  );
}

function Row({ sl, si, avail, toggle }) {
  return (
    <>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9aa9af", textAlign: "right", paddingRight: 4 }}>{sl}</div>
      {DAYS.map((d, di) => {
        const k  = `${di}-${si}`;
        const st = avail.booked.includes(k) ? "booked" : avail.open.includes(k) ? "open" : "closed";
        if (st === "booked") {
          return <button key={di} disabled className="slot booked" title="Booked — locked"><Icon.check size={12} /></button>;
        }
        return (
          <button key={di} onClick={() => toggle(k)} className={`slot ${st === "open" ? "on" : ""}`}>
            {st === "open" ? "" : "+"}
          </button>
        );
      })}
    </>
  );
}
