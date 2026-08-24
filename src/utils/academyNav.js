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
  { l: "Tests & Quizzes", i: "help", to: "/teacher/quizzes" },
  // Phase 6 item 4. `badgeKey` binds the live pill resolved by the sidebar —
  // it counts what needs the TEACHER's attention (suggested + changes
  // requested), not the whole bank, which would be a number that never moves.
  { l: "My Question Bank", i: "clip", to: "/teacher/quiz-bank", badgeKey: "bank" },
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
  { to: "/teacher/bank-status", l: "ShikshaCom Bank Status" },
];

// `to` maps each per-class drill-down back to the sidebar item that owns it.
// Without it the sidebar's prefix match lit "Classes" while the teacher was
// looking at Assignments, because /teacher/classes/:id/assignments starts
// with /teacher/classes and never with /teacher/assignments.
const CLASS_SUBSCREENS = [
  { seg: "assignments", l: "Assignments", to: "/teacher/assignments" },
  { seg: "quizzes", l: "Tests & Quizzes", to: "/teacher/quizzes" },
  { seg: "study-materials", l: "Study Materials", to: "/teacher/study-materials" },
  { seg: "session-recordings", l: "Recordings", to: "/teacher/recordings" },
  { seg: "students", l: "Students", to: "/teacher/students" },
  { seg: "live-sessions", l: "Live Sessions", to: "/teacher/live-sessions" },
];

/** The /teacher/classes/:id/<seg> screen this pathname is on, if any. */
function classSubscreen(pathname) {
  const m = pathname.match(/^\/teacher\/classes\/[^/]+\/([^/]+)/);
  return m ? CLASS_SUBSCREENS.find((s) => s.seg === m[1]) : undefined;
}

// Longest path first so deeper routes win over their prefixes.
const MATCHERS = [...NAV.filter((n) => n.l), ...EXTRA_TITLES]
  .slice()
  .sort((a, b) => b.to.length - a.to.length);

// Sidebar highlighting: only NAV items (never EXTRA_TITLES, which aren't
// rendered there), most-specific sibling wins, and exactly ONE item active.
const NAV_MATCHERS = NAV.filter((n) => n.l).slice().sort((a, b) => b.to.length - a.to.length);

/** Which NAV item's `to` should be highlighted for this pathname. */
export function activeNavTo(pathname) {
  // Checked first, or /teacher/classes swallows every drill-down.
  const sub = classSubscreen(pathname);
  if (sub) return sub.to;

  // The trailing "/" boundary matters: a bare startsWith(to) would also
  // light "Classes" for a sibling route like /teacher/classes-archive.
  const hit = NAV_MATCHERS.find(
    (n) => pathname === n.to || pathname.startsWith(`${n.to}/`)
  );
  return hit ? hit.to : null;
}

function humanise(pathname) {
  const segs = pathname.split("/").filter(Boolean);
  const seg = segs[0] === "teacher" ? segs[1] : segs[0];
  if (!seg) return "Dashboard";
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The header/tab title for a pathname, taken from the active nav item. */
export function pageTitleFor(pathname) {
  // /teacher/classes/:subjectId/<sub> — name the sub-screen, not "Classes".
  // Same table activeNavTo uses, so the highlight and the title agree.
  const cls = classSubscreen(pathname);
  if (cls) return cls.l;

  const hit = MATCHERS.find(
    (n) => pathname === n.to || pathname.startsWith(`${n.to}/`)
  );
  return hit ? hit.l : humanise(pathname);
}
