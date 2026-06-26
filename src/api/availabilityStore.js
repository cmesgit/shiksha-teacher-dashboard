// PLACEMENT: teacher_ui/src/api/availabilityStore.js  (replace whole file)
//
// The old localStorage "availabilityStore" (defaultOpen/defaultBooked/get/
// save/book/toggleOpen + per-teacher seeded mock state) is GONE. Availability
// is now persisted server-side via:
//   GET   /skill/teacher/availability/   → { open, booked }
//   PATCH /skill/teacher/availability/   body { open: [...] }
// This module only describes the weekly grid layout + a label helper, shared
// with the learner-side Book-a-Tutor calendar.
//
// Slot key: "<dayIndex>-<slotIndex>"  (dayIndex 0 = Monday .. 5 = Saturday)

function mondayOfThisWeek() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;          // 0 = Monday
  const m = new Date(now);
  m.setDate(now.getDate() - dow);
  m.setHours(0, 0, 0, 0);
  return m;
}

// Mon–Sat of the CURRENT week with real date numbers, e.g. ["Mon 23", ...].
export const DAYS = (() => {
  const m = mondayOfThisWeek();
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names.map((n, i) => {
    const d = new Date(m);
    d.setDate(m.getDate() + i);
    return `${n} ${d.getDate()}`;
  });
})();

// Must line up with _SLOT_HOURS in skills/views.py [9,11,14,16,18,20].
export const SLOTS = ["9 AM", "11 AM", "2 PM", "4 PM", "6 PM", "8 PM"];

export function label(k) {
  const [di, si] = String(k).split("-").map(Number);
  return `${DAYS[di] ?? "?"} \u00b7 ${SLOTS[si] ?? "?"}`;
}

export default { DAYS, SLOTS, label };
