// DocumentTitle — keeps the browser tab title in sync with the current page
// AND the active identity, so it's always unambiguous which profile/track the
// user is managing (audit finding #6). Renders nothing; mount once inside the
// Router (it uses useLocation) and AuthProvider (it uses useAuth).
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const APP_NAME = "ShikshaCom";

function pageLabel(pathname) {
  const segs = pathname.split("/").filter(Boolean);
  // Teacher routes are all under /teacher/… — use the segment after it.
  const s = segs[0] === "teacher" ? segs[1] : segs[0];
  if (!s || s === "dashboard") return "Dashboard";
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DocumentTitle() {
  const { pathname } = useLocation();
  const { isAuthenticated, context, activeProfile, teacherInfo } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      document.title = APP_NAME;
      return;
    }
    let who;
    if (context === "teacher") {
      who = teacherInfo?.type === "GUEST" ? "Expert" : "Faculty";
    } else {
      who = activeProfile?.display_name || "";
    }
    const page = pageLabel(pathname);
    document.title = who
      ? `${page} · ${who} — ${APP_NAME}`
      : `${page} — ${APP_NAME}`;
  }, [pathname, isAuthenticated, context, activeProfile?.display_name, teacherInfo?.type]);

  return null;
}
