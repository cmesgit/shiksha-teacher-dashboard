/**
 * src/pages/GuestExpertDashboard.jsx
 * ─────────────────────────────────────────────────────────────────
 * Faithful port of the AuthFlow design's TeacherDash component.
 *
 * Layout (matches screenshots exactly):
 *   .rd-body.teacher  (background: #c9d1de)
 *     .rd-head          — "Hi Eric 👋" · subtitle · Faculty/Expert pills · bell · avatar
 *     .rd-grid          — 2-col: [left col: Live Sessions + 2-col cards] [right: Calendar + list]
 *
 * The sidebar is handled by TeacherLayout / Sidebar.jsx.
 * The Faculty/Expert toggle only appears for TYPE_BOTH teachers.
 * Pure GUEST only ever sees the Expert view (no toggle).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import expertService from "../api/expertService";
import "../styles/guestExpert.css";

/* ── Inline SVG icons matching the design token set ─────────────────── */
const Ic = {
  bell: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  cap: (sz=15) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  spark: (sz=13) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
    </svg>
  ),
  check: (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
};

const initOf = (s = "") =>
  (s || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

export default function GuestExpertDashboard() {
  const { user, teacherInfo } = useAuth();
  const navigate = useNavigate();

  /* TYPE_BOTH can toggle; pure GUEST is always expert */
  const isBoth  = teacherInfo?.type === "BOTH";
  const [mode, setMode] = useState("expert"); // "expert" | "faculty"
  const isExpert = mode === "expert";

  const [loading,      setLoading]      = useState(true);
  const [profile,      setProfile]      = useState(null);
  const [courses,      setCourses]      = useState([]);
  const [applications, setApplications] = useState([]);
  const [earnings,     setEarnings]     = useState({ available: 0, payouts: [] });
  const [showNotif,    setShowNotif]    = useState(false);
  const [showMenu,     setShowMenu]     = useState(false);

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
        setEarnings(e.earnings || { available: 0, payouts: [] });
      } catch (err) {
        console.error("Expert dashboard load:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const close = () => { setShowNotif(false); setShowMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const firstName = (
    profile?.name && profile.name !== "Your profile"
      ? profile.name
      : user?.active_profile?.display_name || user?.username || "there"
  ).split(" ")[0];

  const subtitle = isExpert
    ? (profile?.title || "Guest expert")
    : (teacherInfo?.faculty_subject
        ? `${teacherInfo.faculty_subject} Faculty · CBSE`
        : "Faculty");

  const avatarStr = initOf(
    profile?.name && profile.name !== "Your profile"
      ? profile.name
      : user?.username || "TE"
  );

  /* ── Expert live sessions (from courses/bookings) ── */
  const liveSessions = isExpert
    ? courses.slice(0, 2).map(c => ({ subj: c.title, topic: "Next session", when: "Coming up" }))
    : [
        { subj: "Mathematics", topic: "Trigonometry · Class 10", when: "Thu · 9:00 AM" },
        { subj: "Mathematics", topic: "Algebra · Class 9",       when: "Fri · 10:30 AM" },
      ];

  /* ── Bottom 2-col cards content ── */
  const assignItems = isExpert
    ? courses.slice(0, 2).map(c => c.title || "Course")
    : ["Algebra set 4 · 24 submissions", "Geometry quiz · 18 submissions"];
  const assignTitle = isExpert ? "Assignments" : "Assignments to grade";

  const actItems = isExpert
    ? [["#94a0eb", "Quiz submitted by Ruati"], ["#57d982", "New enrollment · Andrew"]]
    : [["#94a0eb", "Quiz submitted by Ruati · Class 10"], ["#57d982", "Assignment graded · Class 9"]];

  /* ── Right col: calendar + bottom card ── */
  const rightListTitle  = isExpert ? "Booking Requests"  : "Today's Classes";
  const rightListItems  = isExpert
    ? applications.slice(0, 2).map(r => `${r.name} · ${r.course}`)
    : ["Class 10 · Maths · 9:00 AM", "Class 9 · Maths · 10:30 AM"];

  /* ── Notifications ── */
  const notifs = isExpert
    ? [
        { m: "New booking request · Zovi (UX Research)", t: "1h",  tag: "Expert",  c: "#ff8f01" },
        { m: "Andrew enrolled in Figma from Zero to Hire", t: "3h", tag: "Expert",  c: "#ff8f01" },
        { m: "Payout of ₹1,999 processed",               t: "1d",  tag: "Expert",  c: "#ff8f01" },
      ]
    : [
        { m: "Ruati submitted Algebra set 4 · Class 10",   t: "30m", tag: "Faculty", c: "#425f7f" },
        { m: "5 students joined your Class 9 live session", t: "2h",  tag: "Faculty", c: "#425f7f" },
        { m: "Geometry quiz auto-graded · 18 attempts",    t: "5h",  tag: "Faculty", c: "#425f7f" },
      ];

  /* Simple June 2026 calendar */
  const calDays = ["M","T","W","T","F","S","S"];
  // June 1 2026 is a Monday — day 1 starts in column 1
  const today = 21; // June 21

  if (loading) {
    return <div className="ge-loading">Loading your dashboard…</div>;
  }

  return (
    <div className="ge-body-wrap">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="ge-head">
        {/* Greeting */}
        <div>
          <div className="ge-head__title">Hi {firstName} 👋</div>
          <div className="ge-head__sub">{subtitle}</div>
        </div>

        {/* Faculty / Expert toggle — only for TYPE_BOTH */}
        {isBoth && (
          <div
            className="ge-switch"
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              className={`ge-switch__btn ${!isExpert ? "ge-switch__btn--on" : ""}`}
              onClick={() => { setMode("faculty"); navigate("/teacher/dashboard"); }}
            >
              {Ic.cap(13)} Faculty
            </button>
            <button
              className={`ge-switch__btn ${isExpert ? "ge-switch__btn--on" : ""}`}
              onClick={() => setMode("expert")}
            >
              {Ic.spark(13)} Expert
            </button>
          </div>
        )}

        {/* Right controls */}
        <div className="ge-head__right" onMouseDown={e => e.stopPropagation()}>
          {/* Notification bell */}
          <div className="ge-profwrap">
            <button
              className="ge-bell"
              onClick={() => { setShowNotif(n => !n); setShowMenu(false); }}
            >
              {Ic.bell}
              {notifs.length > 0 && (
                <span className="ge-badge">{notifs.length}</span>
              )}
            </button>
            {showNotif && (
              <div className="ge-notif" onMouseDown={e => e.stopPropagation()}>
                <div className="ge-notif__head">
                  <span className="ge-notif__title">Notifications</span>
                  <button className="ge-notif__clr" onClick={() => setShowNotif(false)}>
                    Mark all read
                  </button>
                </div>
                <div className="ge-notif__list">
                  {notifs.map((n, i) => (
                    <div key={i} className="ge-notif__item">
                      <span className="ge-notif__ic" style={{ background: n.c + "22", color: n.c }}>
                        {n.tag === "Expert" ? Ic.spark(15) : Ic.cap(15)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span className="ge-notif__tag" style={{ background: n.c + "1f", color: n.c }}>
                            {n.tag}
                          </span>
                          <span style={{ fontSize: 10.5, color: "#aaa", marginLeft: "auto" }}>{n.t}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "#333", lineHeight: 1.4 }}>{n.m}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar / profile menu */}
          <div className="ge-profwrap">
            <button
              className="ge-avatar-btn"
              onClick={() => { setShowMenu(m => !m); setShowNotif(false); }}
            >
              {avatarStr}
            </button>
            {showMenu && (
              <div className="ge-prof" onMouseDown={e => e.stopPropagation()}>
                <div className="ge-prof__head">
                  <div className="ge-prof__av">{avatarStr}</div>
                  <div>
                    <div className="ge-prof__name">{profile?.name || user?.username || "Teacher"}</div>
                    <div className="ge-prof__email">{user?.email || ""}</div>
                  </div>
                </div>
                {isBoth && (
                  <>
                    <div className="ge-prof__sec">Active dashboard</div>
                    <div
                      className={`ge-prof__item ${isExpert ? "ge-prof__item--on" : ""}`}
                      onClick={() => { setMode("expert"); setShowMenu(false); }}
                    >
                      <span className="ge-prof__pav" style={{ background: "rgba(47,157,66,.16)", color: "#2f9d42" }}>
                        {Ic.spark(13)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div>Skill Dev</div>
                        <div style={{ fontSize: 10.5, color: "#999" }}>Expert teacher</div>
                      </div>
                      {isExpert && <span className="ge-prof__tick">{Ic.check}</span>}
                    </div>
                    <div
                      className={`ge-prof__item ${!isExpert ? "ge-prof__item--on" : ""}`}
                      onClick={() => { setMode("faculty"); setShowMenu(false); navigate("/teacher/dashboard"); }}
                    >
                      <span className="ge-prof__pav" style={{ background: "rgba(66,95,127,.16)", color: "#425f7f" }}>
                        {Ic.cap(13)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div>Academy</div>
                        <div style={{ fontSize: 10.5, color: "#999" }}>Faculty</div>
                      </div>
                      {!isExpert && <span className="ge-prof__tick">{Ic.check}</span>}
                    </div>
                  </>
                )}
                <div className="ge-prof__menu">
                  <div className="ge-prof__mi">Settings</div>
                  <div className="ge-prof__mi ge-prof__mi--logout" onClick={() => { /* logout */ }}>
                    Log out
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── GRID ───────────────────────────────────────────────── */}
      <div className="ge-grid">

        {/* ── LEFT COLUMN ── */}
        <div className="ge-col-left">

          {/* Live Sessions */}
          <div className="ge-card">
            <h4>Upcoming Live Sessions</h4>
            <div className="ge-live-row">
              {liveSessions.length === 0 ? (
                <div className="ge-card-empty">No upcoming sessions</div>
              ) : liveSessions.map((s, i) => (
                <div key={i} className="ge-livecard">
                  <h5>{s.subj}</h5>
                  <p>{s.topic}</p>
                  <p style={{ marginTop: 8, fontWeight: 700 }}>{s.when}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2-col: Assignments + Recent Activity */}
          <div className="ge-two-col">
            <div className="ge-card">
              <h4>{assignTitle}</h4>
              {assignItems.length === 0
                ? <div className="ge-card-empty">None yet</div>
                : assignItems.map((t, i) => (
                  <div key={i} className="ge-assign-row">{t}</div>
                ))
              }
            </div>
            <div className="ge-card">
              <h4>Recent Activity</h4>
              {actItems.map(([c, t], i) => (
                <div key={i} className="ge-act-row">
                  <span className="ge-act-bar" style={{ background: c }} />
                  <span className="ge-act-text">{t}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="ge-col-right">

          {/* Calendar */}
          <div className="ge-card">
            <h4>June 2026</h4>
            <div className="ge-cal">
              {calDays.map((d, i) => (
                <div key={i} className="ge-cal__hd">{d}</div>
              ))}
              {/* June 2026: starts Monday (offset 0) */}
              {Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
                <div key={d} className={`ge-cal__day${d === today ? " ge-cal__day--today" : ""}`}>
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Booking Requests / Today's Classes */}
          <div className="ge-card">
            <h4>{rightListTitle}</h4>
            {rightListItems.length === 0
              ? <div className="ge-card-empty">None yet</div>
              : rightListItems.map((t, i) => (
                <div key={i} className="ge-list-item">{t}</div>
              ))
            }
          </div>

        </div>
      </div>

    </div>
  );
}
