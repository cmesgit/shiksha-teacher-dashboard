// PLACEMENT: teacher_ui/src/api/availabilityStore.js  (replace whole file)
//
// Grid layout for the expert's WEEKLY-RECURRING availability. The teacher sets
// a repeating weekly template, so the columns are plain weekday names — no
// date numbers (dates implied "this week", which showed already-past days).
// Learner-side booking rolls a chosen slot to its NEXT occurrence, so nothing
// here is ever "in the past".
//
// Slot key: "<dayIndex>-<slotIndex>"  (dayIndex 0 = Monday .. 5 = Saturday)

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Must line up with _SLOT_HOURS in skills/views.py [9,11,14,16,18,20].
export const SLOTS = ["9 AM", "11 AM", "2 PM", "4 PM", "6 PM", "8 PM"];

export function label(k) {
  const [di, si] = String(k).split("-").map(Number);
  return `${DAYS[di] ?? "?"} \u00b7 ${SLOTS[si] ?? "?"}`;
}

export default { DAYS, SLOTS, label };
