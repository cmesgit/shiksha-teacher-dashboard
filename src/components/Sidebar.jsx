/**
 * src/components/Sidebar.jsx  ·  ACADEMY / FACULTY sidebar
 *
 * Matches Academy Dashboard.dc.html lines 560–595:
 *   maroon (--side-bg #5c1515) chrome · brand header · "TEACHING" selector
 *   well · sectioned nav (TEACH / CONTENT / LIVE / CONNECT) · user footer.
 *
 * Styling lives in styles/academySidebar.css — same geometry as the student
 * app's sidebar, recoloured purely by --side-bg / --side-accent, which is why
 * both apps can share one stylesheet.
 *
 * Skill Dev keeps its OWN nav in SkillDevLayout — this sidebar only ever
 * renders the academy nav. Every item routes to a live page (no dead links).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { FiHome } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import NavIcon from "./NavIcon";
import { NAV, activeNavTo } from "../utils/academyNav";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { HOME_URL } from "../config/urls";
import "../styles/academySidebar.css";

/* Same chevron the student sidebar's course switcher uses (Academy
   Dashboard.dc.html line 576) — this well isn't a scope switch (there's
   nothing to filter app-wide on), just an expand affordance so a teacher
   with more than a couple of subjects can actually read the full list
   instead of the "Faculty · N subjects" summary getting ellipsis-cut. */
const ExpandCaret = () => (
  <svg
    className="acad-side__wellCaret"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="rgba(255,255,255,.6)"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
  </svg>
);

const initialsOf = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "T";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, teacherInfo } = useAuth();
  const { classes } = useTeacherClasses();
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef(null);

  useEffect(() => {
    if (!scopeOpen) return;
    const onDoc = (e) => { if (scopeRef.current && !scopeRef.current.contains(e.target)) setScopeOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setScopeOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [scopeOpen]);

  // Every distinct subject, sorted, for the expanded list — the collapsed
  // label above it only ever shows a count once there are 3+, so this is the
  // one place a teacher can actually read which subjects those are.
  const subjectRows = useMemo(() => {
    const seen = new Map();
    for (const c of classes) {
      if (!c.subjectId || seen.has(c.subjectId)) continue;
      seen.set(c.subjectId, c);
    }
    return [...seen.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [classes]);

  const userName =
    user?.name || user?.full_name || user?.username ||
    (user?.email ? user.email.split("@")[0] : "") || "Teacher";
  const userInitials = initialsOf(userName);
  // The design's footer sub-line is "{role} · {scope}" ("Faculty · Physics").
  // GUEST teachers are Experts everywhere else in this app (see Breadcrumbs).
  const userRole = teacherInfo?.type === "GUEST" ? "Expert" : "Faculty";

  // "Physics · Classes 9–10": the distinct subjects taught, then the distinct
  // classes they're taught to. Capped so a teacher with many classes doesn't
  // overflow the 240px rail.
  const teachingScope = useMemo(() => {
    if (!classes.length) return "";
    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const subjects = uniq(classes.map((c) => c.subjectName));
    const courses = uniq(classes.map((c) => c.courseTitle));
    const subjectPart =
      subjects.length <= 2 ? subjects.join(" & ") : `${subjects.length} subjects`;
    const coursePart =
      courses.length === 1 ? courses[0]
        : courses.length ? `${courses.length} classes`
        : "";
    return [subjectPart, coursePart].filter(Boolean).join(" · ");
  }, [classes]);

  // Resolve ONE winning nav item for the route, rather than letting each
  // item answer "am I a prefix of this?" independently — which lit "Classes"
  // on every per-class drill-down and could light two items at once.
  const activeTo = activeNavTo(location.pathname);
  const isActive = (to) => to === activeTo;

  const go = (to) => { navigate(to); setSidebarOpen(false); };

  return (
    <aside className={`acad-side${sidebarOpen ? " acad-side--open" : ""}`}>
      {/* Brand */}
      <div className="acad-side__brand">
        <div className="acad-side__mark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="acad-side__wordmark">
          <div className="acad-side__name">ShikshaCom</div>
          <div className="acad-side__eyebrow">Academy</div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="acad-side__close"
        >
          <IoClose />
        </button>
      </div>

      {/* Selector well — the design's "TEACHING / Physics · Classes 9–10"
          (dc.html line 573). The subject scope now comes from the shared
          my-classes context; falls back to the track label before it loads or
          if the teacher has no classes yet, rather than showing an empty slot.
          Purely informational, NOT a navigation control — it used to send a
          click through to the old classes/:subjectId hub page, which is a
          stale/superseded UI now that CONTENT screens are flat top-level
          pages. This just expands to read the full subject list; nothing in
          it is clickable. */}
      <div className="acad-side__selector" ref={scopeRef}>
        <button
          type="button"
          className={`acad-side__well${subjectRows.length > 0 ? " acad-side__well--interactive" : ""}`}
          onClick={() => subjectRows.length > 0 && setScopeOpen((o) => !o)}
          aria-haspopup={subjectRows.length > 0 ? "true" : undefined}
          aria-expanded={subjectRows.length > 0 ? scopeOpen : undefined}
        >
          <span className="acad-side__wellText">
            <span className="acad-side__wellLabel">
              {teachingScope ? "Teaching" : "Faculty Portal"}
            </span>
            <span className="acad-side__wellValue" title={teachingScope || undefined}>
              {teachingScope || "Academy Track"}
            </span>
          </span>
          {subjectRows.length > 0 && <ExpandCaret />}
        </button>

        {scopeOpen && subjectRows.length > 0 && (
          <div className="acad-side__menu acad-side__menu--scroll" aria-label="Subjects you teach">
            {subjectRows.map((c) => (
              <div key={c.subjectId} className="acad-side__menuItem acad-side__menuItem--static">
                <span className="acad-side__menuItemTitle">{c.subjectName}</span>
                {c.courseTitle && (
                  <span className="acad-side__menuItemMeta">{c.courseTitle}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="acad-side__nav">
        {NAV.map((item, idx) => {
          if (item.section) {
            return (
              <div key={`s-${idx}`} className="acad-side__section">
                {item.section}
              </div>
            );
          }
          const active = isActive(item.to);
          return (
            <button
              key={item.l}
              type="button"
              onClick={() => go(item.to)}
              className={`acad-side__item${active ? " active" : ""}`}
              data-tour={`sidebar.nav-${item.to.replace(/^\/+/, "").replace(/\//g, "-")}`}
            >
              <NavIcon name={item.i} size={14} />
              {item.l}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="acad-side__user">
        <div className="acad-side__avatar">{userInitials}</div>
        <div className="acad-side__userText">
          <div className="acad-side__userName">{userName}</div>
          <div className="acad-side__userRole">{userRole}</div>
        </div>
      </div>

      {/* Return to homepage */}
      <div className="acad-side__home">
        <a href={HOME_URL} className="acad-side__homeLink">
          <FiHome size={14} /> Return to Homepage
        </a>
      </div>
    </aside>
  );
}
