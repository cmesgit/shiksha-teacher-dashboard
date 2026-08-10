// The Academy (faculty) sidebar's nav structure, and the page title derived
// from it.
//
// The design's header shows "the current page title" on the left, and its
// routing section derives that title from the active nav label — so the nav
// array is the single source of truth for both the sidebar and the header
// (previously this app's header had no title at all; page identity came only
// from the breadcrumb strip).

export const NAV = [
  { section: "TEACH" },
  { l: "Dashboard", i: "home", to: "/teacher/dashboard" },
  { l: "Classes", i: "layers", to: "/teacher/classes" },
  { l: "Students", i: "users", to: "/teacher/students" },
  { l: "Batch Progress", i: "chart", to: "/teacher/batch-progress" },
  { section: "CONTENT" },
  { l: "Assignments", i: "file", to: "/teacher/assignments" },
  { l: "Quizzes", i: "help", to: "/teacher/quizzes" },
  { l: "Study Materials", i: "clip", to: "/teacher/study-materials" },
  { section: "LIVE" },
  { l: "Live Sessions", i: "video", to: "/teacher/live-sessions" },
  { l: "Private Sessions", i: "lock", to: "/teacher/private-sessions" },
  { l: "Group Sessions", i: "grad", to: "/teacher/group-sessions" },
  { l: "Recordings", i: "play", to: "/teacher/recordings" },
  { section: "CONNECT" },
  { l: "Messages", i: "msg", to: "/teacher/chat" },
];

// Screens reachable outside the sidebar (profile menu, per-class drill-downs,
// notification deep links) still need a header title. Per-class content lives
// under /teacher/classes/:subjectId/... — title those by what they show, not
// as "Classes", so the header tracks the actual screen.
const EXTRA_TITLES = [
  { to: "/teacher/profile", l: "Profile" },
  { to: "/teacher/change-password", l: "Change Password" },
  { to: "/teacher/settings", l: "Settings" },
  { to: "/teacher/quiz-bank", l: "Question Bank" },
];

const CLASS_SUBSCREENS = [
  { seg: "assignments", l: "Assignments" },
  { seg: "quizzes", l: "Quizzes" },
  { seg: "study-materials", l: "Study Materials" },
  { seg: "session-recordings", l: "Recordings" },
  { seg: "students", l: "Students" },
  { seg: "live-sessions", l: "Live Sessions" },
];

// Longest path first so deeper routes win over their prefixes.
const MATCHERS = [...NAV.filter((n) => n.l), ...EXTRA_TITLES]
  .slice()
  .sort((a, b) => b.to.length - a.to.length);

function humanise(pathname) {
  const segs = pathname.split("/").filter(Boolean);
  const seg = segs[0] === "teacher" ? segs[1] : segs[0];
  if (!seg) return "Dashboard";
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The header/tab title for a pathname, taken from the active nav item. */
export function pageTitleFor(pathname) {
  // /teacher/classes/:subjectId/<sub> — name the sub-screen, not "Classes".
  const cls = pathname.match(/^\/teacher\/classes\/[^/]+\/([^/]+)/);
  if (cls) {
    const hit = CLASS_SUBSCREENS.find((s) => s.seg === cls[1]);
    if (hit) return hit.l;
  }
  const hit = MATCHERS.find(
    (n) => pathname === n.to || pathname.startsWith(`${n.to}/`)
  );
  return hit ? hit.l : humanise(pathname);
}
