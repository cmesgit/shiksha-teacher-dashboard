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
//  · MOST link_url values the backend writes are STUDENT routes
//    (/subjects/..., /study-material/..., /live/...), because the student
//    app is root-mounted and those paths were authored for it. They need
//    translating to this app's equivalent screen, NOT treating as unknown.
//    Getting this wrong is how every non-chat notification used to dump the
//    teacher into the "Become a career counsellor" application form: the old
//    fallback was `navigate(mapped.startsWith("/teacher") ? mapped :
//    "/teacher/counsellor")`, and /teacher/counsellor's layout gates on a
//    counsellor profile the faculty member doesn't have.

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Kept in sync with the same mapping in
// shiksha-frontend/src/utils/notificationRouting.js, which applies it when
// hopping into this app from the public site.
function toAppPath(path) {
  return path
    .replace(/^\/counselor\/appointments\/([^/?]+)/, "/teacher/counsellor/appointments/$1")
    // Bare /counselor/appointments has no teacher route (only
    // appointments/:id is mounted) — send it to the schedule index.
    .replace(/^\/counselor\/appointments(?=$|[/?])/, "/teacher/counsellor")
    .replace(/^\/counselor\/availability/, "/teacher/counsellor/availability")
    .replace(/^\/counselor\/apply/, "/teacher/counsellor")
    .replace(/^\/counselor(?=$|[/?])/, "/teacher/counsellor")
    // The counselling app also emits /counseling/... (gerund) for its own
    // list screens — /counseling/appointments, /counseling/reports. Neither
    // has a teacher route, so the TAIL IS DISCARDED and the whole path
    // collapses to the counsellor index. Preserving it (the obvious
    // `/^\/counseling/` prefix swap) produces /teacher/counsellor/reports,
    // which matches no child route and renders a blank panel.
    .replace(/^\/counseling(?:$|[/?].*)/, "/teacher/counsellor");
}

// Student-app link_url → the faculty screen showing the SAME object.
// Ordered most-specific-first; the first match wins. Anything not listed
// has no faculty equivalent and must fall through to type-based routing
// rather than being forced somewhere arbitrary.
const STUDENT_TO_TEACHER = [
  // /subjects/quiz/:subjectId — note "quiz" sits where a subject id would,
  // so this must be tested before the generic /subjects/:id rules below.
  [/^\/subjects\/quiz\/([^/?]+)/, (m) => `/teacher/classes/${m[1]}/quizzes`],
  [/^\/subjects\/([^/?]+)\/assignments\/([^/?]+)/, (m) => `/teacher/classes/${m[1]}/assignments/${m[2]}`],
  [/^\/subjects\/([^/?]+)\/assignments/, (m) => `/teacher/classes/${m[1]}/assignments`],
  [/^\/study-material\/list\/([^/?]+)/, (m) => `/teacher/classes/${m[1]}/study-materials`],
  [/^\/subjects\/([^/?]+)(?=$|[/?])/, (m) => `/teacher/classes/${m[1]}`],
  [/^\/live\/([^/?]+)/, (m) => `/teacher/live-sessions/${m[1]}/detail`],
  [/^\/sessions\/group\/([^/?]+)/, () => "/teacher/group-sessions"],
];

function fromStudentPath(path) {
  for (const [re, build] of STUDENT_TO_TEACHER) {
    const m = path.match(re);
    if (m) return build(m);
  }
  return null;
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
    //
    // Land in the inbox for the track the user is ALREADY IN. The inbox
    // itself is shared — /teacher/chat and /teacher/expert/inbox render the
    // same ChatPanel over the same conversation list, differing only in
    // theme and chrome — so this never hides a message. It just stops a
    // message notification from yanking someone out of Skill Dev and into
    // the Academy layout mid-task, which is what hardcoding /teacher/chat
    // did.
    const chatMatch = linkUrl.match(/^\/chat\/([^/?]+)/);
    if (chatMatch) {
      const inbox = activeTrack === "skill" ? "/teacher/expert/inbox" : "/teacher/chat";
      navigate(inbox, { state: { conversationId: chatMatch[1] } });
      return true;
    }

    const mapped = toAppPath(linkUrl);
    if (mapped.startsWith("/teacher")) {
      navigate(mapped);
      return true;
    }

    // Student-app path for an object that also has a faculty screen.
    const teacherPath = fromStudentPath(mapped);
    if (teacherPath) {
      navigate(teacherPath);
      return true;
    }

    // Genuinely no faculty destination (/forum/..., /explore, /my-courses/...
    // — none of which this app mounts). Report failure so the caller can
    // fall back: NotificationBell then uses the notification's own
    // type/subject_id to route, and the Comm Center leaves the panel open
    // instead of navigating. Never invent a destination here — that is what
    // produced the career-counsellor-form bug.
    return false;
    // activeTrack is a real dependency: without it this callback would be
    // created once and capture the track the user happened to load on, so a
    // chat notification would keep opening the Academy inbox even after they
    // moved into Skill Dev.
  }, [navigate, activeTrack]);

  return { goTracked, openLink, activeTrack };
}
