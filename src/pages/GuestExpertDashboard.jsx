/**
 * src/pages/GuestExpertDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * The dashboard a GUEST EXPERT lands on (vs. the faculty TeacherDashboard).
 * Four tabs, matching the design:
 *   Courses Created · Applications · Expert Profile · Earnings
 *
 * Self-contained: it brings its own header + tab bar (the faculty top-slider
 * tabs are hidden on this route in TeacherLayout), and reads all data through
 * the single `expertService` seam, which uses live endpoints when present and
 * an illustrative fallback otherwise.
 */
import { useEffect, useState } from "react";
import {
  FiPlus, FiUsers, FiFileText, FiCheck, FiX, FiStar, FiShield, FiCalendar,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import expertService from "../api/expertService";
import "../styles/guestExpert.css";

const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const initialOf = (s) => (s || "?").trim().charAt(0).toUpperCase();

const TABS = [
  ["courses", "Courses Created"],
  ["applications", "Applications"],
  ["profile", "Expert Profile"],
  ["earnings", "Earnings"],
];

export default function GuestExpertDashboard() {
  const { user } = useAuth();

  const [tab, setTab] = useState("courses");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);

  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [earnings, setEarnings] = useState({ available: 0, next_payout: "", payouts: [] });

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
        setEarnings(e.earnings || { available: 0, next_payout: "", payouts: [] });
        // "live" only when every data section came from the backend.
        setLive(Boolean(c.live && a.live && e.live));
      } catch (err) {
        console.error("Guest-expert dashboard load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const respond = async (id, action) => {
    setApplications((prev) => prev.filter((r) => r.id !== id)); // optimistic
    try {
      await expertService.respondToApplication(id, action);
    } catch (err) {
      console.error("Could not update application:", err);
    }
  };

  const published = courses.filter((c) => c.status === "Published").length;
  const totalStudents = courses.reduce((a, c) => a + (c.students || 0), 0);
  const monthEarned = (earnings.payouts || []).reduce((a, p) => a + (p.amt || 0), 0);

  const greetName =
    profile?.name && profile.name !== "Your profile"
      ? profile.name
      : user?.active_profile?.display_name || user?.username || "there";

  if (loading) {
    return (
      <div className="ge-root">
        <div className="ge-loading">Loading your expert dashboard…</div>
      </div>
    );
  }

  return (
    <div className="ge-root">
      {/* ── Header ── */}
      <div className="ge-head">
        <div className="ge-eyebrow">Guest expert</div>
        <h1 className="ge-title">Welcome back, {greetName}</h1>
        <p className="ge-sub">Manage your courses, requests, public profile and payouts.</p>
        {!live && (
          <span className="ge-demo" title="Showing illustrative data until the expert endpoints are connected.">
            <span className="ge-demo__dot" /> Sample data — connect the expert API to go live
          </span>
        )}

        <div className="ge-stats">
          <div className="ge-stat">
            <div className="ge-stat__value">{published}</div>
            <div className="ge-stat__label">Published courses</div>
          </div>
          <div className="ge-stat">
            <div className="ge-stat__value">{totalStudents}</div>
            <div className="ge-stat__label">Total students</div>
          </div>
          <div className="ge-stat">
            <div className="ge-stat__value">{applications.length}</div>
            <div className="ge-stat__label">Pending requests</div>
          </div>
          <div className="ge-stat">
            <div className="ge-stat__value">{rupee(monthEarned)}</div>
            <div className="ge-stat__label">Earned this month</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="ge-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`ge-tab ${tab === id ? "ge-tab--on" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "applications" && applications.length > 0 ? ` (${applications.length})` : ""}
          </button>
        ))}
      </div>

      {/* ── Courses ── */}
      {tab === "courses" && (
        <>
          <div className="ge-section">
            <h3>Courses you've created</h3>
            <button className="ge-btn ge-btn--primary"><FiPlus size={14} /> Create course</button>
          </div>
          {courses.length === 0 ? (
            <div className="ge-empty">No courses yet. Create your first course so learners can find and enrol with you.</div>
          ) : (
            <div className="ge-list">
              {courses.map((c) => {
                const draft = c.status === "Draft";
                return (
                  <div key={c.id} className="ge-card">
                    <div className="ge-thumb">{initialOf(c.title)}</div>
                    <div className="ge-grow">
                      <div className="ge-row-title">
                        <span className="ge-name">{c.title}</span>
                        <span className={`ge-pill ${draft ? "ge-pill--draft" : "ge-pill--published"}`}>{c.status}</span>
                      </div>
                      <div className="ge-meta">
                        <span><FiUsers size={13} /> {c.students || 0} students</span>
                        <span><FiFileText size={13} /> {c.lessons || 0} lessons</span>
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
          )}
        </>
      )}

      {/* ── Applications ── */}
      {tab === "applications" && (
        <>
          <div className="ge-section"><h3>Student requests</h3></div>
          {applications.length === 0 ? (
            <div className="ge-empty">No pending requests. New course enrolments and 1:1 session requests will appear here.</div>
          ) : (
            <div className="ge-list">
              {applications.map((r) => (
                <div key={r.id} className="ge-card">
                  <div className="ge-avatar">{initialOf(r.name)}</div>
                  <div className="ge-grow">
                    <div className="ge-row-title">
                      <span className="ge-name" style={{ fontSize: 14 }}>{r.name}</span>
                      <span className={`ge-pill ${r.kind === "enroll" ? "ge-pill--enroll" : "ge-pill--session"}`}>
                        {r.kind === "enroll" ? "Course enrol" : "1:1 session"}
                      </span>
                    </div>
                    <div className="ge-meta" style={{ marginTop: 3 }}>
                      <span>{r.course}</span>
                    </div>
                    <div className="ge-meta" style={{ marginTop: 3 }}>
                      <span><FiCalendar size={12} /> {r.when}{r.rate ? ` · ${rupee(r.rate)}/hr` : ""}</span>
                    </div>
                  </div>
                  <button className="ge-btn ge-btn--ghost" onClick={() => respond(r.id, "decline")}>
                    <FiX size={13} /> Decline
                  </button>
                  <button className="ge-btn ge-btn--primary" onClick={() => respond(r.id, "accept")}>
                    <FiCheck size={13} /> Accept
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Expert Profile ── */}
      {tab === "profile" && profile && (
        <>
          <div className="ge-section">
            <h3>Your public expert profile</h3>
            <button className="ge-btn ge-btn--primary">Edit profile</button>
          </div>
          <div className="ge-profile">
            <div className="ge-profile__top">
              <div className="ge-avatar ge-avatar--lg">{initialOf(profile.name)}</div>
              <div className="ge-grow">
                <div className="ge-row-title">
                  <span className="ge-name" style={{ fontSize: 18 }}>{profile.name}</span>
                  {profile.verified && <span className="ge-verified"><FiShield size={12} /> Verified</span>}
                </div>
                <div className="ge-sub" style={{ marginTop: 2 }}>{profile.title}</div>
                {(profile.rating || profile.sessions) && (
                  <div className="ge-sub" style={{ marginTop: 4 }}>
                    <FiStar size={11} /> {profile.rating ? `${profile.rating} · ` : ""}{profile.sessions} sessions taught
                  </div>
                )}
              </div>
              {profile.rate && (
                <div className="ge-amount">
                  <div className="ge-amount__num" style={{ fontSize: 22 }}>{rupee(profile.rate)}/hr</div>
                  <div className="ge-amount__cap">your rate</div>
                </div>
              )}
            </div>

            {profile.bio
              ? <p className="ge-profile__bio">{profile.bio}</p>
              : <p className="ge-profile__bio" style={{ color: "var(--c-ink-soft)" }}>Add a short bio so learners get to know your background and teaching style.</p>}

            <div className="ge-block">
              <div className="ge-label">Skills you teach</div>
              <div className="ge-skills">
                {profile.skills.length > 0
                  ? profile.skills.map((s) => <span key={s} className="ge-skill">{s}</span>)
                  : <span className="ge-sub">No skills listed yet — add them from “Edit profile”.</span>}
              </div>
            </div>

            <div className="ge-block">
              <div className="ge-label">Availability</div>
              <div className="ge-sub" style={{ marginTop: 4 }}>{profile.availability}</div>
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
              {earnings.next_payout && <div className="ge-earn__next">Next payout · {earnings.next_payout}</div>}
              <button className="ge-btn ge-btn--accent" style={{ marginTop: 16, width: "100%", justifyContent: "center" }}>
                Withdraw to bank
              </button>
            </div>
            <div className="ge-payouts">
              {(earnings.payouts || []).length === 0 ? (
                <div className="ge-empty" style={{ border: "none", background: "none" }}>No payouts yet.</div>
              ) : (
                earnings.payouts.map((p) => (
                  <div key={p.id} className="ge-payout">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                      <div className="ge-sub" style={{ marginTop: 1, fontSize: 11 }}>{p.when}</div>
                    </div>
                    <div className="ge-payout__amt">+{rupee(p.amt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
