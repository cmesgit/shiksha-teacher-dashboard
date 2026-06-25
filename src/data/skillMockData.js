// PLACEMENT: teacher_ui/src/data/skillMockData.js  (replace whole file)
//
// Every mock array (STUDENTS, EARNINGS, NEXT_UP, ACTIVITY, MY_COURSES,
// BOOK_REQUESTS, T_BOOKINGS, HOURLY_RATE), the EXPERT_ID persona, the IMG()
// helper, and the hardcoded COURSE_CATEGORIES list have all been removed —
// every Expert screen now reads real data from the backend. The only export
// kept is the pure pricing helper used by ExpertBookings.

export const packs = (rate) => [
  { n: 1,  label: "Single session", total: rate,                         per: rate,                    save: null },
  { n: 5,  label: "5-session pack",  total: Math.round(rate * 5 * 0.9),   per: Math.round(rate * 0.9),  save: "Save 10%" },
  { n: 10, label: "10-session pack", total: Math.round(rate * 10 * 0.82), per: Math.round(rate * 0.82), save: "Save 18%" },
];
