/**
 * tourRegistry.js — teacher-app tour content (TOUR_SYSTEM_SPEC.md §3.2, §7.3).
 * Per-app, NOT synced by shared/sync.mjs (same reasoning as tokens.css).
 *
 * ⚠️ COPY IS A DRAFT. Every `title`/`body` string below is a placeholder the
 * spec's own guidance (§13) explicitly asks the implementer NOT to finalize
 * unprompted — it fixes structure, not words. Needs product-owner sign-off
 * before shipping. Structure (steps, targets, gating) is the reviewed part.
 *
 * Deviations from TOUR_SYSTEM_SPEC.md §3.2, found while wiring real anchors
 * (phase 7) — flagged per TOUR_BUILD_GUIDE.md §3 rather than invented around:
 *
 *   - `teacher.live.host` — spec described "Participants/admit → mute
 *     controls → screenshare → raise-hand queue → end session" (5 steps).
 *     This app's live room has NO admit/waiting-room feature (students join
 *     directly) and NO stable raise-hand UI (hands surface only as ephemeral
 *     `.rh-toasts`, which don't render most of the time and have no
 *     always-present anchor). Built as 4 steps against anchors that are
 *     always in the DOM regardless of panel state: the People tab, the Chat
 *     tab (self-serve substitute for "ask without unmuting" — same value
 *     as the raise-hand step tried to deliver), Screen share, and End call.
 *     The per-student mute button (`ppl-mic--btn`) only exists once the
 *     People tab has actually been opened, so it isn't a safe target for an
 *     unattended auto-tour — mentioned in the People-tab step's copy instead
 *     of given its own step.
 *   - `teacher.quiz.builder` — spec assumed a "question types" picker and a
 *     "publish/schedule" control. Neither exists: every question is
 *     implicitly MCQ (no type selector anywhere in `QuizBuilder.jsx`), and
 *     there's no scheduled-publish — only "Submit for review" (routes to
 *     admin review). Built as 4 real steps: Add question, Question bank,
 *     AI-generate, Submit for review.
 *   - `teacher.private.availability` — spec listed 3 steps; the page only has
 *     two distinct interactive regions (the slot grid, the save button).
 *     Built as 2 steps rather than manufacture a third step against the same
 *     target twice.
 *   - Recordings upload has no top-level `/teacher/recordings/upload` route —
 *     it's subject-scoped only (`/teacher/classes/:subjectId/session-
 *     recordings/upload`, reached via a subject-picker from the list page).
 *     Not an issue for any T1/T2 entry below, but relevant if a future T3
 *     beacon targets it (see the T3 note below).
 *
 * Track/accent: unlike the student app, this app has no CourseContext-style
 * live "current track" value — TeacherLayout/SkillDevLayout/CounselorLayout
 * each set `data-track` on their own root (`academy` / `skill` / a newly
 * added `counsellor`, see CounselorLayout.jsx — it previously set none at
 * all, a real pre-existing gap since fixed alongside this registry).
 * `App.jsx`'s `TourMount` derives the same value from the route so the
 * body-portalled overlay (C8) resolves the right accent. `tokens.css` only
 * defines `[data-track="academy"|"skill"]` blocks — `counsellor` currently
 * falls through to the base accent, matching how the console already looked
 * before `data-track` existed there at all (not a new regression).
 *
 * NOT built in this pass: the three T3 beacon entries
 * (`teacher.beacon.quiz-bank`, `teacher.beacon.batch-progress`,
 * `teacher.beacon.recording-upload`) — same reason as the student app's
 * three T3s (see that app's tourRegistry.js header): `shared/src/tour/`
 * still has no `Beacon.jsx`. Flagging rather than repurposing the spotlight
 * overlay to fake a pulsing-dot hint.
 */

const track = (name) => () =>
  document.querySelector(".teacher-layout")?.dataset.track === name;

export const tourRegistry = [
  // ── T1 — Welcome tours ────────────────────────────────────────────────
  {
    key: "teacher.welcome.academy",
    label: "Welcome tour — Academy",
    version: 1,
    tier: "T1",
    renderer: "spotlight",
    trigger: { match: "/teacher/dashboard" },
    conditions: [track("academy"), (ctx) => /^\/teacher\/dashboard$/.test(ctx.location.pathname)],
    steps: [
      {
        target: '[data-tour="sidebar.nav-teacher-classes"]',
        placement: "right",
        title: "Your classes, at a glance",
        body: "Batches you teach, and everything scoped to them, start from here.",
      },
      {
        target: '[data-tour="sidebar.nav-teacher-assignments"]',
        placement: "right",
        title: "Assignments and quizzes",
        body: "Create, publish, and grade student work from this section.",
      },
      {
        target: '[data-tour="sidebar.nav-teacher-live-sessions"]',
        placement: "right",
        title: "Host a live class",
        body: "Start or join a scheduled session — mic, screenshare, and student controls are all in the room.",
      },
      {
        target: '[data-tour="sidebar.nav-teacher-chat"]',
        placement: "right",
        title: "Stay reachable",
        body: "Students and parents can message you directly — replies land here.",
      },
      {
        target: '[data-tour="header.profile-switcher"]',
        placement: "bottom-end",
        title: "Come back to this anytime",
        body: "Open this menu and choose Help & tours to replay any of this, or manage your profile and sign out.",
      },
    ],
  },
  {
    key: "teacher.welcome.skill",
    label: "Welcome tour — Skill Dev",
    version: 1,
    tier: "T1",
    renderer: "spotlight",
    trigger: { match: "/teacher/expert" },
    conditions: [track("skill"), (ctx) => /^\/teacher\/expert$/.test(ctx.location.pathname)],
    steps: [
      {
        target: '[data-tour="sidebar-skill.nav-teacher-expert"]',
        placement: "right",
        title: "Your expert dashboard",
        body: "A quick view of requests, upcoming sessions, and how your listings are doing.",
      },
      {
        target: '[data-tour="sidebar-skill.nav-teacher-expert-bookings"]',
        placement: "right",
        title: "Requests come here first",
        body: "Accept or decline within 24 hours — unanswered requests auto-decline and refund the student.",
      },
      {
        target: '[data-tour="sidebar-skill.nav-teacher-expert-availability"]',
        placement: "right",
        title: "Set when you're bookable",
        body: "Students can only request sessions during the slots you open here.",
      },
      {
        target: '[data-tour="header.profile-switcher"]',
        placement: "bottom-end",
        title: "Come back to this anytime",
        body: "Open this menu and choose Help & tours to replay any of this, or manage your profile and sign out.",
      },
    ],
  },
  {
    key: "teacher.welcome.counsellor",
    label: "Welcome tour — Counselling",
    version: 1,
    tier: "T1",
    renderer: "spotlight",
    trigger: { match: "/teacher/counsellor" },
    conditions: [track("counsellor"), (ctx) => /^\/teacher\/counsellor$/.test(ctx.location.pathname)],
    steps: [
      {
        target: '[data-tour="sidebar-counsellor.nav-teacher-counsellor"]',
        placement: "right",
        title: "Your schedule",
        body: "Booked appointments show up here as students request them.",
      },
      {
        target: '[data-tour="sidebar-counsellor.nav-teacher-counsellor-availability"]',
        placement: "right",
        title: "Open your calendar",
        body: "Set the slots students can book you for.",
      },
      {
        target: '[data-tour="header.profile-switcher"]',
        placement: "bottom-end",
        title: "Come back to this anytime",
        body: "Open this menu and choose Help & tours to replay any of this, or manage your profile and sign out.",
      },
    ],
  },

  // ── T2 — Page tours ───────────────────────────────────────────────────
  {
    key: "teacher.live.host",
    label: "Hosting a live class",
    version: 1,
    tier: "T2",
    renderer: "spotlight",
    trigger: { match: "/teacher/live/" },
    featureFlag: "show_tour",
    steps: [
      {
        target: '[data-tour="live-host.people-tab"]',
        placement: "left",
        title: "See who's in the room",
        body: "Open this to view every participant and mute a student's mic directly from their row.",
      },
      {
        target: '[data-tour="live-host.chat-tab"]',
        placement: "left",
        title: "Questions without interrupting",
        body: "Students can type instead of unmuting — replies show up here.",
      },
      {
        target: '[data-tour="live-host.screenshare"]',
        placement: "top",
        title: "Share your screen",
        body: "Present slides or your own screen to the whole room.",
      },
      {
        target: '[data-tour="live-host.end-call"]',
        placement: "top",
        title: "Wrapping up",
        body: "This ends the session for everyone — there's no separate close step.",
      },
    ],
  },
  {
    key: "teacher.quiz.builder",
    label: "Building a quiz",
    version: 1,
    tier: "T2",
    renderer: "spotlight",
    trigger: { match: "/teacher/quizzes/create" },
    steps: [
      {
        target: '[data-tour="quiz-builder.add-question"]',
        placement: "bottom",
        title: "Start from scratch",
        body: "Add questions one at a time, or paste a batch in via Bulk import.",
      },
      {
        target: '[data-tour="quiz-builder.question-bank"]',
        placement: "bottom",
        title: "Reuse what already exists",
        body: "Pull questions from your school's question bank instead of writing new ones.",
      },
      {
        target: '[data-tour="quiz-builder.ai-generate"]',
        placement: "bottom",
        title: "Let AI draft a first pass",
        body: "Generate questions on a topic, then edit them before they go in.",
      },
      {
        target: '[data-tour="quiz-builder.submit-review"]',
        placement: "bottom",
        title: "Submit for review",
        body: "Quizzes go to admin review before students can see them.",
      },
    ],
  },
  {
    key: "teacher.assignment.create",
    label: "Creating an assignment",
    version: 1,
    tier: "T2",
    renderer: "spotlight",
    trigger: { match: "/teacher/classes/" },
    conditions: [(ctx) => /^\/teacher\/classes\/[^/]+\/assignments\/create$/.test(ctx.location.pathname)],
    steps: [
      {
        target: '[data-tour="assignment-create.batch"]',
        placement: "bottom",
        title: "Pick the batch",
        body: "Only students in this batch will see the assignment.",
      },
      {
        target: '[data-tour="assignment-create.due-date"]',
        placement: "bottom",
        title: "Set a due date",
        body: "Submissions after this date are marked late automatically.",
      },
      {
        target: '[data-tour="assignment-create.submit"]',
        placement: "top",
        title: "You're ready",
        body: "Save it and it's visible to the batch right away.",
      },
    ],
  },
  {
    key: "teacher.submissions.grade",
    label: "Grading submissions",
    version: 1,
    tier: "T2",
    renderer: "spotlight",
    trigger: { match: "/teacher/classes/" },
    conditions: [(ctx) => /^\/teacher\/classes\/[^/]+\/assignments\/[^/]+\/submissions$/.test(ctx.location.pathname)],
    steps: [
      {
        target: '[data-tour="submissions.grade-btn"]',
        placement: "left",
        title: "Grade a submission",
        body: "Open a student's row to enter marks and feedback.",
      },
      {
        target: '[data-tour="submissions.marks-input"]',
        placement: "top",
        title: "Marks and feedback",
        body: "Feedback is optional, but the student sees it alongside their grade.",
      },
      {
        target: '[data-tour="submissions.save-grade"]',
        placement: "top",
        title: "Save when you're done",
        body: "The student is notified as soon as you save.",
      },
    ],
  },
  {
    key: "teacher.private.availability",
    label: "Your private-session availability",
    version: 1,
    tier: "T2",
    renderer: "spotlight",
    trigger: { match: "/teacher/private-sessions/availability" },
    steps: [
      {
        target: '[data-tour="private-availability.grid"]',
        placement: "top",
        title: "Click a slot to open it up",
        body: "Students can only request a private session during a slot you've selected here.",
      },
      {
        target: '[data-tour="private-availability.save"]',
        placement: "top",
        title: "Save your changes",
        body: "Nothing updates for students until you save.",
      },
    ],
  },
  {
    key: "teacher.expert.listing",
    label: "Listing a new skill",
    version: 1,
    tier: "T2",
    renderer: "spotlight",
    trigger: { match: "/teacher/expert/skills/new" },
    steps: [
      {
        target: '[data-tour="expert-listing.category-price"]',
        placement: "bottom",
        title: "Category and price",
        body: "This is how students find and compare your listing.",
      },
      {
        target: '[data-tour="expert-listing.skill-tags"]',
        placement: "bottom",
        title: "Tag what you teach",
        body: "Tags improve search — add a few specific ones, not just the category name again.",
      },
      {
        target: '[data-tour="expert-listing.publish"]',
        placement: "top",
        title: "Goes live immediately",
        body: "Students can book this the moment you publish — an admin can suspend it later if needed.",
      },
    ],
  },
];
