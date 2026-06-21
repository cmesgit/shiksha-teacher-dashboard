/**
 * src/pages/GuestExpertDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Guest-expert (Skills) dashboard — faithful to the Figma DashShell:
 *
 *   Banner (dark forest, radial glow)
 *     ├─ Avatar initials · "Hi <name> 👋" · TYPE_BOTH switcher
 *     ├─ 4 frosted-glass stat tiles
 *     └─ Tabs: Courses Created · Applications · Expert Profile · Earnings
 *   Cream-2 body below
 *     └─ Tab content (cards, earnings grid, profile card)
 *
 * The TYPE_BOTH switcher lives in the banner header row — no extra bar below
 * the header. TeacherLayout hides its own switch banner when this page is
 * active.
 *
 * Data via expertService: tries live endpoints, falls back gracefully.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import expertService from "../api/expertService";
import "../styles/guestExpert.css";

/* ── Inline SVG icons (matches Figma token set exactly) ─────────────── */
const Ic = {
  plus:    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  users:   <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  doc:     <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>,
  cal:     <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  check:   <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x:       <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  shield:  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  star:    <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  user:    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

const rupee  = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const initOf = (s) => (s || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

/* Category colour seeded from the Figma skill-category data */
const CAT_COLORS = {
  design: "#9b5de5", coding: "#0077b6", music: "#e76f51",
  lang: "#2a9d8f",   business: "#e9c46a", sports: "#43aa8b",
  default: "var(--c-forest-mid)",
};
const catColor = (cat) => CAT_COLORS[cat] || CAT_COLORS.default;

const TABS = [
  ["courses",      "Courses Created"],
  ["applications", "Applications"],
  ["profile",      "Expert Profile"],
  ["earnings",     "Earnings"],
];

export default function GuestExpertDashboard() {
  const { user, teacherInfo } = useAuth();
  const navigate = useNavigate();

  const isBoth = teacherInfo?.type === "BOTH";

  const [tab,          setTab]          = useState("courses");
  const [loading,      setLoading]      = useState(true);
  const [live,         setLive]         = useState(true);
  const [profile,      setProfile]      = useState(null);
  const [courses,      setCourses]      = useState([]);
  const [applications, setApplications] = useState([]);
  const [earnings,     setEarnings]     = useState({ available: 0, next_payout: "", payouts: [] });

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
        setCourses(c.courses  || []);
        setApplications(a.applications || []);
        setEarnings(e.earnings || { available: 0, next_payout: "", payouts: [] });
        setLive(Boolean(c.live && a.live && e.live));
      } catch (err) {
        console.error("Expert dashboard load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const respond = async (id, action) => {
    setApplications(prev => prev.filter(r => r.id !== id));
    try { await expertService.respondToApplication(id, action); }
    catch (err) { console.error("Respond failed:", err); }
  };

  /* ── Derived stats ── */
  const published     = courses.filter(c => c.status === "Published").length;
  const totalStudents = courses.reduce((a, c) => a + (c.students || 0), 0);
  const totalEarned   = (earnings.payouts || []).reduce((a, p) => a + (p.amt || 0), 0);
  const stats = [
    { value: published,                          label: "Published courses"   },
    { value: totalStudents,                      label: "Total students"      },
    { value: applications.length,                label: "Pending applications"},
    { value: `₹${(totalEarned/1000).toFixed(1)}k`, label: "Earned this month"},
  ];

  /* ── Display name from profile or auth ── */
  const firstName = (
    profile?.name && profile.name !== "Your profile"
      ? profile.name
      : user?.active_profile?.display_name || user?.username || "there"
  ).split(" ")[0];

  const avatarStr = initOf(
    profile?.name && profile.name !== "Your profile"
      ? profile.name
      : user?.username || "GE"
  );

  /* ── Tab label with pending count ── */
  const tabLabel = (id, base) =>
    id === "applications" && applications.length > 0
      ? `${base} (${applications.length})`
      : base;

  if (loading) {
    return (
      <div className="ge-root">
        <div className="ge-loading">Loading your expert dashboard…</div>
      </div>
    );
  }

  return (
    <div className="ge-root">

      {/* ══════════════════ BANNER ══════════════════ */}
      <div className="ge-banner">
        <div className="ge-banner__inner">

          {/* Row: avatar · greeting · optional TYPE_BOTH switcher */}
          <div className="ge-banner__top">
            <div className="ge-avatar-circle">{avatarStr}</div>
            <div style={{ flex: 1 }}>
              <div className="ge-banner__eyebrow">
                {isBoth ? "Expert teacher · Skills" : "Guest expert"}
                {!live && (
                  <span className="ge-demo">
                    <span className="ge-demo__dot" /> sample data
                  </span>
                )}
              </div>
              <div className="ge-banner__title">Hi {firstName} 👋</div>
            </div>

            {/* Dashboard switcher — only for TYPE_BOTH, lives in the banner */}
            {isBoth && (
              <div className="ge-switcher" role="group" aria-label="Switch dashboard">
                <button
                  className="ge-switcher__btn"
                  onClick={() => navigate("/teacher/dashboard")}
                  title="Academic (Faculty) dashboard"
                >
                  📚 Academic
                </button>
                <button
                  className="ge-switcher__btn ge-switcher__btn--active"
                  aria-current="page"
                  title="Skills (Expert) dashboard — currently active"
                >
                  🎯 Skills
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="ge-stats">
            {stats.map(s => (
              <div key={s.label} className="ge-stat">
                <div className="ge-stat__value">{s.value}</div>
                <div className="ge-stat__label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="ge-tabs" role="tablist">
            {TABS.map(([id, base]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`ge-tab${tab === id ? " ge-tab--on" : ""}`}
                onClick={() => setTab(id)}
              >
                {tabLabel(id, base)}
              </button>
            ))}
          </div>

        </div>
      </div>
      {/* ══════════════════ /BANNER ══════════════════ */}

      {/* ══════════════════ BODY ══════════════════ */}
      <div className="ge-body">

        {/* ── Courses Created ── */}
        {tab === "courses" && (
          <>
            <div className="ge-section">
              <h3>Courses you've created</h3>
              <button className="ge-btn ge-btn--primary">{Ic.plus} Create course</button>
            </div>
            {courses.length === 0
              ? <div className="ge-empty">No courses yet. Create your first course so learners can find and enrol with you.</div>
              : (
                <div className="ge-list">
                  {courses.map(c => {
                    const draft = c.status === "Draft";
                    const cc    = catColor(c.cat);
                    return (
                      <div key={c.id} className="ge-card">
                        <div className="ge-thumb" style={{ background: cc + "22", color: cc }}>
                          {Ic.doc}
                        </div>
                        <div className="ge-grow">
                          <div className="ge-row-title">
                            <span className="ge-name">{c.title}</span>
                            <span className={`ge-pill ${draft ? "ge-pill--draft" : "ge-pill--published"}`}>
                              {c.status}
                            </span>
                          </div>
                          <div className="ge-meta">
                            <span>{Ic.users} {c.students || 0} students</span>
                            <span>{Ic.doc} {c.lessons || 0} lessons</span>
                            <span>{rupee(c.price)}</span>
                          </div>
                        </div>
                        <div className="ge-amount">
                          <div className="ge-amount__num">{rupee(c.revenue)}</div>
                          <div className="ge-amount__cap">revenue</div>
                        </div>
                        <button className="ge-btn ge-btn--ghost">{draft ? "Publish" : "Edit"}</button>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </>
        )}

        {/* ── Applications ── */}
        {tab === "applications" && (
          <>
            <div className="ge-section"><h3>Student applications &amp; requests</h3></div>
            {applications.length === 0
              ? <div className="ge-empty">No pending applications. New course enrollments and session requests land here.</div>
              : (
                <div className="ge-list">
                  {applications.map(r => (
                    <div key={r.id} className="ge-card">
                      {r.img
                        ? <img src={r.img} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
                        : <div className="ge-face" style={{ background: "var(--c-forest)", color: "#fff" }}>{initOf(r.name)}</div>
                      }
                      <div className="ge-grow">
                        <div className="ge-row-title">
                          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--c-forest)" }}>{r.name}</span>
                          <span className={`ge-pill ${r.kind === "enroll" ? "ge-pill--enroll" : "ge-pill--session"}`}>
                            {r.kind === "enroll" ? "Course enroll" : "1:1 session"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--c-ink-soft)", marginTop: 3 }}>{r.course}</div>
                        <div style={{ fontSize: 12, color: "var(--c-ink-soft)", marginTop: 3, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          {Ic.cal} {r.when}{r.rate ? ` · ${rupee(r.rate)}/hr` : ""}
                        </div>
                      </div>
                      <button className="ge-btn ge-btn--ghost"  onClick={() => respond(r.id, "decline")}>{Ic.x}    Decline</button>
                      <button className="ge-btn ge-btn--primary" onClick={() => respond(r.id, "accept")} >{Ic.check} Accept</button>
                    </div>
                  ))}
                </div>
              )
            }
          </>
        )}

        {/* ── Expert Profile ── */}
        {tab === "profile" && profile && (
          <>
            <div className="ge-section">
              <h3>Your public expert profile</h3>
              <button className="ge-btn ge-btn--primary">{Ic.user} Edit profile</button>
            </div>
            <div className="ge-profile">
              <div className="ge-profile__top">
                {profile.img
                  ? <img src={profile.img} alt="" style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover" }} />
                  : <div className="ge-face ge-face--lg" style={{ background: "var(--c-forest)", color: "#fff" }}>{avatarStr}</div>
                }
                <div style={{ flex: 1 }}>
                  <div className="ge-row-title">
                    <span className="ge-name" style={{ fontSize: 18 }}>{profile.name !== "Your profile" ? profile.name : firstName}</span>
                    {profile.verified && <span className="ge-verified">{Ic.shield} Verified</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--c-ink-soft)", marginTop: 2 }}>{profile.title}</div>
                  {(profile.rating || profile.sessions) && (
                    <div style={{ fontSize: 12.5, color: "var(--c-ink-soft)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                      {Ic.star} {profile.rating ? `${profile.rating} · ` : ""}{profile.sessions} sessions taught
                    </div>
                  )}
                </div>
                {profile.rate && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-head)", fontWeight: 900, fontSize: 22, color: "var(--c-forest)" }}>{rupee(profile.rate)}/hr</div>
                    <div style={{ fontSize: 11, color: "var(--c-ink-soft)" }}>your rate</div>
                  </div>
                )}
              </div>

              {profile.bio
                ? <p className="ge-profile__bio">{profile.bio}</p>
                : <p className="ge-profile__bio" style={{ color: "var(--c-ink-soft)" }}>Add a short bio so learners can understand your background and teaching style.</p>
              }

              <div className="ge-block">
                <span className="ge-label">Skills you teach</span>
                <div className="ge-skills">
                  {profile.skills?.length > 0
                    ? profile.skills.map(s => <span key={s} className="ge-skill">{s}</span>)
                    : <span style={{ fontSize: 13, color: "var(--c-ink-soft)" }}>No skills listed yet — add them from "Edit profile".</span>
                  }
                </div>
              </div>

              <div className="ge-block">
                <span className="ge-label">Availability</span>
                <div style={{ fontSize: 13, color: "var(--c-ink-soft)", marginTop: 4 }}>
                  {profile.availability || "Set your weekly availability so learners can book you."}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Earnings ── */}
        {tab === "earnings" && (
          <>
            <div className="ge-section"><h3>Earnings</h3></div>
            <div className="ge-earn">
              <div className="ge-earn__card">
                <div className="ge-earn__cap">Available to withdraw</div>
                <div className="ge-earn__big">{rupee(earnings.available)}</div>
                {earnings.next_payout && (
                  <div className="ge-earn__next">Next payout · {earnings.next_payout}</div>
                )}
                <button className="ge-btn ge-btn--accent" style={{ marginTop: 16, width: "100%", justifyContent: "center" }}>
                  Withdraw to bank
                </button>
              </div>
              <div className="ge-payouts">
                {(earnings.payouts || []).length === 0
                  ? <div className="ge-empty">No payouts yet.</div>
                  : (earnings.payouts || []).map((p, i) => (
                    <div key={p.id || i} className="ge-payout">
                      <div>
                        <div className="ge-payout__label">{p.label}</div>
                        <div className="ge-payout__when">{p.when}</div>
                      </div>
                      <div className="ge-payout__amt">+{rupee(p.amt)}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </>
        )}

      </div>
      {/* ══════════════════ /BODY ══════════════════ */}

    </div>
  );
}
