// DocumentTitle — keeps the browser tab title in sync with the current page
// AND the active identity, so it's always unambiguous which profile/track the
// user is managing (audit finding #6). Renders nothing; mount once inside the
// Router (it uses useLocation) and AuthProvider (it uses useAuth).
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { pageTitleFor } from "../utils/academyNav";

const APP_NAME = "ShikshaCom";

// The tab title comes from the SAME table as the in-app header
// (academyNav.js's NAV + EXTRA_TITLES) rather than a second, private copy.
//
// This file used to carry its own `pageLabel()` that just humanised the path
// segment. That silently diverged from the header the moment a route needed
// an explicit title: /teacher/v2 rendered "Dashboard" in the header — because
// academyNav has an EXTRA_TITLES entry for it — while the browser tab said
// "V2", since this function had never heard of that table. Any future
// off-nav route would have had the same split-brain.
//
// pageTitleFor falls back to the same humanise() this used to do, so every
// path that was already correct stays correct.

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
    const page = pageTitleFor(pathname);
    document.title = who
      ? `${page} · ${who} — ${APP_NAME}`
      : `${page} — ${APP_NAME}`;
  }, [pathname, isAuthenticated, context, activeProfile?.display_name, teacherInfo?.type]);

  return null;
}
