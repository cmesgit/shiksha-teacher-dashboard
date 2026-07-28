// Breadcrumbs — a slim bar that makes the active teaching identity + location
// explicit on every page (audit finding #6, visible half). The leading crumb is
// the teaching identity (Faculty/Expert + track); the rest are the path
// sections. Hidden on the dashboard root.
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./breadcrumbs.css";

const isId = (s) => /^\d+$/.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s);
const titleCase = (s) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const DASH_ROOTS = new Set(["/teacher/dashboard", "/teacher/expert"]);

// CONTENT screens under /teacher/classes/:subjectId/<seg> are also mounted as
// flat top-level routes (see TeacherRoutes.jsx's "CONTENT nav items are flat"
// comment) and the sidebar now links straight to those flat routes. A teacher
// arriving that way never visited Classes, so a literal path-derived crumb
// ("Classes" → /teacher/classes) is misleading — clicking it lands on the
// unrelated Classes list instead of anything quiz/assignment/etc-related.
// Collapse "Classes" + this segment into one crumb pointing at the real flat
// list instead. `students` is deliberately excluded: the per-class list
// (StudentsList) is a genuinely different screen from the flat one
// (AllStudents), not a flattened duplicate, so its nested ancestry is real.
const FLATTENED_CONTENT = {
  assignments: { label: "Assignments", to: "/teacher/assignments" },
  quizzes: { label: "Quizzes", to: "/teacher/quizzes" },
  "study-materials": { label: "Study Materials", to: "/teacher/study-materials" },
  "session-recordings": { label: "Recordings", to: "/teacher/recordings" },
  "live-sessions": { label: "Live Sessions", to: "/teacher/live-sessions" },
};

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const { isAuthenticated, context, teacherInfo, activeProfile } = useAuth();

  if (!isAuthenticated) return null;
  if (DASH_ROOTS.has(pathname)) return null; // dashboards already show identity

  const segs = pathname.split("/").filter(Boolean);
  const crumbs = [];
  let acc = "";
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg === "classes" && isId(segs[i + 1]) && FLATTENED_CONTENT[segs[i + 2]]) {
      const flat = FLATTENED_CONTENT[segs[i + 2]];
      acc = `/teacher/classes/${segs[i + 1]}/${segs[i + 2]}`;
      crumbs.push({ label: flat.label, to: flat.to });
      i += 2; // consumed :subjectId and the content segment too
      continue;
    }
    acc += `/${seg}`;
    if (seg === "teacher" || isId(seg)) continue; // /teacher/… is the app root
    crumbs.push({ label: titleCase(seg), to: acc });
  }

  let who, kind, home;
  if (context === "teacher") {
    who = teacherInfo?.type === "GUEST" ? "Expert" : "Faculty";
    kind = teacherInfo?.active_track === "skill" ? "Skill Dev" : "Academy";
    home = teacherInfo?.active_track === "skill" ? "/teacher/expert" : "/teacher/dashboard";
  } else {
    who = activeProfile?.display_name || "Account";
    kind = "";
    home = "/teacher/dashboard";
  }

  return (
    <nav className="bc" aria-label="Breadcrumb">
      <Link to={home} className="bc__id" title="Active teaching identity">
        <span className="bc__idName">{who}</span>
        {kind && <span className="bc__idKind">{kind}</span>}
      </Link>
      {crumbs.map((c, i) => (
        <span className="bc__seg" key={c.to}>
          <span className="bc__sep" aria-hidden="true">›</span>
          {i === crumbs.length - 1 ? (
            <span className="bc__cur" aria-current="page">{c.label}</span>
          ) : (
            <Link to={c.to} className="bc__link">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
