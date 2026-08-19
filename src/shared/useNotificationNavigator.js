// APP-LOCAL (not a shared/sync.mjs file — the student app has its own
// copy with different route rules).
//
// One definition of "where does clicking a notification take me", used by
// BOTH the bell dropdown (components/NotificationBell.jsx) and the
// Communication Center list (shared/comm/NotificationsView.jsx). Those two
// surfaces read different endpoints — /activity/feed/ and /notifications/
// respectively — and used to disagree: the bell routed and the Comm Center
// silently did nothing, because ChatPanel passed
// `onNavigate={() => setView("inbox")}` and threw the link_url away.
//
// Teacher-side specifics:
//  · Everything is mounted under /teacher. A path without that prefix
//    falls through to the root RedirectToMainLogin and the user lands on a
//    blank page, so an unrecognised link must never be navigated to raw.
//  · There is no track to persist. This app mounts two route-scoped
//    layouts (TeacherLayout / SkillDevLayout behind RequireTrack), so the
//    URL *is* the track and navigating re-scopes everything on its own.
//  · The backend's counsellor paths are /counselor/... (app-agnostic, one
//    l, no /teacher prefix); this app mounts them at /teacher/counsellor
//    (two l). One letter and one prefix apart — hence the explicit map.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Kept in sync with the same mapping in
// shiksha-frontend/src/utils/notificationRouting.js, which applies it when
// hopping into this app from the public site.
function toAppPath(path) {
  return path
    .replace(/^\/counselor\/appointments/, "/teacher/counsellor/appointments")
    .replace(/^\/counselor\/availability/, "/teacher/counsellor/availability")
    .replace(/^\/counselor\/apply/, "/teacher/counsellor")
    .replace(/^\/counselor(?=$|[/?])/, "/teacher/counsellor");
}

export default function useNotificationNavigator() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The route IS the track here (see the header note), so this is a
  // derivation rather than state. Deliberately NOT teacherInfo
  // .active_track: that server field lags in-app navigation, which is
  // how the bell's "See all" used to open the wrong inbox.
  const activeTrack = pathname.startsWith("/teacher/expert") ? "skill" : "academy";

  // No track bookkeeping needed here — see the header note.
  const goTracked = useCallback((path) => {
    if (path) navigate(path);
  }, [navigate]);

  const openLink = useCallback((linkUrl) => {
    if (typeof linkUrl !== "string" || !linkUrl.startsWith("/")) return false;
    if (linkUrl.startsWith("//")) return false;   // protocol-relative junk

    // Chat links are a bare /chat/<id> that matches no route here, and
    // don't start with /teacher, so they would otherwise be swallowed by
    // the counsellor fallback below. ChatPanel opens a conversation from
    // router state, not a URL param.
    const chatMatch = linkUrl.match(/^\/chat\/([^/?]+)/);
    if (chatMatch) {
      navigate("/teacher/chat", { state: { conversationId: chatMatch[1] } });
      return true;
    }

    const mapped = toAppPath(linkUrl);
    // Anything that still isn't a real in-app path goes to the counsellor
    // schedule rather than a blank page. Preserves the existing bell
    // behaviour exactly.
    navigate(mapped.startsWith("/teacher") ? mapped : "/teacher/counsellor");
    return true;
  }, [navigate]);

  return { goTracked, openLink, activeTrack };
}
