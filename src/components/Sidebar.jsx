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
import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { FiHome } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import NavIcon from "./NavIcon";
import { NAV } from "../utils/academyNav";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { HOME_URL } from "../config/urls";
import "../styles/academySidebar.css";

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

  const isActive = (to) =>
    to === "/teacher/dashboard"
      ? location.pathname === to
      : location.pathname.startsWith(to);

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
          if the teacher has no classes yet, rather than showing an empty slot. */}
      <div className="acad-side__selector">
        <div className="acad-side__well">
          <span className="acad-side__wellText">
            <span className="acad-side__wellLabel">
              {teachingScope ? "Teaching" : "Faculty Portal"}
            </span>
            <span className="acad-side__wellValue" title={teachingScope || undefined}>
              {teachingScope || "Academy Track"}
            </span>
          </span>
        </div>
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
          <FiHome size={13} /> Return to Homepage
        </a>
      </div>
    </aside>
  );
}
