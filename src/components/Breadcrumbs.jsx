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

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const { isAuthenticated, context, teacherInfo, activeProfile } = useAuth();

  if (!isAuthenticated) return null;
  if (DASH_ROOTS.has(pathname)) return null; // dashboards already show identity

  const segs = pathname.split("/").filter(Boolean);
  const crumbs = [];
  let acc = "";
  for (const seg of segs) {
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
