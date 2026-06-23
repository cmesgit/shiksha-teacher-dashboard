/**
 * src/data/skillMockData.js
 * ──────────────────────────────────────────────────────────────────────────
 * Mock data for the Skill Dev (Expert) teacher dashboard, ported verbatim
 * from the prototype (SkillDashViews.jsx + AuthFlow.jsx TeacherDash).
 *
 * Each export is annotated with the real endpoint that should replace it.
 * The shapes here are what the UI expects — keep them stable so swapping in
 * the API is a one-line change per page.
 *
 * Teacher avatar images: the prototype used /assets/teacherN.jpeg. Point
 * IMG() at wherever your teacher images live, or return a real URL from the API.
 */

// The expert-dashboard persona id used by the availability store.
export const EXPERT_ID = 3;

// API TODO: resolve real image URLs (from the course/teacher serializer).
export const IMG = (n) => `/assets/teacher${n}.jpeg`;

/* ── pricing helper — packages derived from an hourly rate ── */
export const packs = (rate) => [
  { n: 1,  label: "Single session", total: rate,                          per: rate,                       save: null },
  { n: 5,  label: "5-session pack",  total: Math.round(rate * 5 * 0.9),    per: Math.round(rate * 0.9),     save: "Save 10%" },
  { n: 10, label: "10-session pack", total: Math.round(rate * 10 * 0.82),  per: Math.round(rate * 0.82),    save: "Save 18%" },
];

/* ════════════════════════════════════════════════════════════════
   EXPERT DASHBOARD — overview stats + next-up + earnings + activity
   API TODO: GET /api/skill/teacher/dashboard/  (or assemble from the
   profile, sessions and earnings endpoints already in expertService).
════════════════════════════════════════════════════════════════ */
export const STUDENTS = { taught: 64, active: 12, pending: 3, completed: 49 };

export const EARNINGS = {
  available: 6480,
  pending:   1440,
  lifetime:  184200,
  month_earned:   17200,
  month_sessions: 12,
  month_goal:     25000,
  // API TODO: GET /api/skill/teacher/earnings/  → transactions grouped by day
  rows: [
    { day: "Today · 22 Jun", items: [
      { who: "Zovi R.",        what: "Intro session · Python foundations", amt: 480,   status: "paid",     img: IMG(2) },
      { who: "Andrew K.",      what: "pandas merge & groupby",             amt: 360,   status: "pending",  img: IMG(7) },
    ]},
    { day: "Yesterday · 21 Jun", items: [
      { who: "Ruati",          what: "Capstone planning",                  amt: 480,   status: "paid",     img: IMG(6) },
      { who: "Payout to bank", what: "HDFC ••4821",                        amt: -5000, status: "withdraw" },
    ]},
    { day: "19 Jun", items: [
      { who: "Lala H.",        what: "Visualising data",                   amt: 480,   status: "paid",     img: IMG(4) },
      { who: "Sangi",          what: "Data wrangling Q&A",                 amt: 240,   status: "paid",     img: IMG(2) },
    ]},
  ],
};

// Next-up bookings shown on the dashboard overview (each = a student's next session).
// API TODO: GET /api/skill/teacher/sessions/?status=confirmed&upcoming=true
export const NEXT_UP = [
  { name: "Zovi R.",   topic: "Session 9 of 12 · Data wrangling with pandas", time: "6:00 PM", dur: "60 min", live: true,       img: IMG(2) },
  { name: "Andrew K.", topic: "Session 3 of 12 · Working with data",          time: "8:30 PM", dur: "60 min", soon: "in 2h",    img: IMG(7) },
];

// Activity feed on the dashboard overview.
// API TODO: GET /api/skill/teacher/activity/  (or reuse useNotificationSocket).
export const ACTIVITY = [
  { text: "New booking request · Zovi (UX Research)",      color: "#ff8f01" },
  { text: "Andrew enrolled in Figma from Zero to Hire",    color: "#c0492f" },
  { text: "Payout of ₹1,999 processed",                    color: "#13899b" },
];

/* ════════════════════════════════════════════════════════════════
   MY COURSES — self-paced creator (Udemy-style)
   API TODO:
     GET    /api/skill/teacher/courses/                 → list
     POST   /api/skill/teacher/courses/                 → create
     PATCH  /api/skill/teacher/courses/<id>/            → edit
     POST   /api/skill/teacher/courses/<id>/sections/   → add module/section
════════════════════════════════════════════════════════════════ */
export const MY_COURSES = [
  {
    title: "Python & Data Science — from scratch", cat: "Coding & Web", status: "Published",
    students: 64, lessons: 20, modules: 5, hrs: "6h 20m", price: 5400, revenue: 184200, rating: 4.8, reviews: 128,
    syllabus: [
      { t: "Python foundations",          n: 5, d: "1h 10m" },
      { t: "Working with data",           n: 4, d: "55m"    },
      { t: "Data wrangling with pandas",  n: 6, d: "1h 40m" },
      { t: "Visualising data",            n: 3, d: "50m"    },
      { t: "Capstone notebook",           n: 2, d: "1h 45m" },
    ],
  },
  {
    title: "Intro to pandas for Analysts", cat: "Coding & Web", status: "Published",
    students: 31, lessons: 12, modules: 4, hrs: "3h 40m", price: 2999, revenue: 62979, rating: 4.7, reviews: 54,
    syllabus: [
      { t: "Why pandas",          n: 2, d: "22m"    },
      { t: "Series & DataFrames", n: 4, d: "1h 05m" },
      { t: "Cleaning & joining",  n: 4, d: "1h 10m" },
      { t: "Group & pivot",       n: 2, d: "1h 03m" },
    ],
  },
  {
    title: "Data Viz with Matplotlib", cat: "Coding & Web", status: "Draft",
    students: 0, lessons: 8, modules: 3, hrs: "2h 10m", price: 1999, revenue: 0, rating: null, reviews: 0,
    syllabus: [
      { t: "Figure & axes",     n: 3, d: "40m" },
      { t: "Chart types",       n: 3, d: "50m" },
      { t: "Styling & export",  n: 2, d: "40m" },
    ],
  },
];

export const COURSE_CATEGORIES = [
  "Coding & Web", "Design & Art", "Music & Audio", "Languages",
  "Business", "Exam Prep", "Photography", "Cooking",
];

/* ════════════════════════════════════════════════════════════════
   BOOKINGS — live 1-on-1 (requests + schedule)
   API TODO:
     GET   /api/skill/teacher/sessions/?status=requested  → pending requests
     POST  /api/skill/teacher/sessions/<id>/confirm/       → accept (locks slot)
     POST  /api/skill/teacher/sessions/<id>/decline/       → decline
════════════════════════════════════════════════════════════════ */
// slot keys reference the availability grid (dayIndex-slotIndex)
export const BOOK_REQUESTS = [
  { name: "Zovi R.", topic: "1:1 on UX research methods",          slot: "3-1", rate: 480, img: IMG(2) },
  { name: "Lala H.", topic: "Design critique — portfolio review",  slot: "4-1", rate: 480, img: IMG(4) },
  { name: "Sangi",   topic: "Wireframing help in Figma",           slot: "2-2", rate: 480, img: IMG(3) },
];

export const T_BOOKINGS = [
  { day: "Today · Sun 22 Jun", items: [
    { name: "Zovi R.",   topic: "Pandas merge & groupby — 1:1", time: "6:00 PM", dur: "60 min", live: true },
    { name: "Andrew K.", topic: "Intro to Python — 1:1",        time: "8:30 PM", dur: "60 min", soon: "in 2h" },
  ]},
  { day: "Tue 24 Jun", items: [
    { name: "Ruati",     topic: "Portfolio review — 1:1",       time: "6:00 PM", dur: "45 min" },
    { name: "Lala H.",   topic: "Visualising data Q&A — 1:1",   time: "7:30 PM", dur: "60 min" },
  ]},
  { day: "Fri 27 Jun", items: [
    { name: "Sangi",     topic: "Data wrangling help — 1:1",    time: "6:00 PM", dur: "60 min" },
  ]},
];

// Base hourly rate for the expert (drives package pricing).
// API TODO: comes from the expert profile (hourly_rate, in rupees).
export const HOURLY_RATE = 480;
