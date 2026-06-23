/**
 * src/api/availabilityStore.js
 * ──────────────────────────────────────────────────────────────────────────
 * Shared weekly-availability store for Skill Dev, ported from the prototype's
 * availability.js. One source of truth for:
 *   · the expert's Availability grid (TeachAvailability page)
 *   · the Bookings "Accept" action (booking a slot locks it)
 *   · (future) the learner's Book-a-Tutor calendar
 *   · (future) the public expert profile page
 *
 * Backed by localStorage so it persists and stays in sync across pages.
 *
 * Slot key format: "<dayIndex>-<slotIndex>"  (e.g. "3-1")
 * State per teacher: { open: [keys], booked: [keys] }
 *   · open   = teacher is bookable in that slot
 *   · booked = a learner's request was accepted → locked, shown differently,
 *              and unavailable to others.
 *
 * ── API TODO ──────────────────────────────────────────────────────────────
 * Replace the localStorage load/save with real endpoints when the backend
 * is ready, e.g.:
 *   GET   /api/skill/teacher/availability/        → { open: [...], booked: [...] }
 *   PATCH /api/skill/teacher/availability/        body { open: [...] }
 *   POST  /api/skill/teacher/sessions/<id>/confirm/  (server marks slot booked)
 * Keep the same { open, booked } shape and the same slot-key format so the
 * UI doesn't need to change.
 */

export const DAYS  = ["Mon 23", "Tue 24", "Wed 25", "Thu 26", "Fri 27", "Sat 28"];
export const SLOTS = ["9 AM", "11 AM", "2 PM", "4 PM", "6 PM", "8 PM"];

// Deterministic default open pattern so each teacher looks different.
function defaultOpen(tid) {
  const out = [];
  DAYS.forEach((_, di) =>
    SLOTS.forEach((_, si) => {
      if (((tid * 7 + di * 3 + si * 5) % 4) !== 0) out.push(`${di}-${si}`);
    })
  );
  return out;
}

// Seed one already-booked slot per teacher (the first open one) for realism.
function defaultBooked(tid) {
  const o = defaultOpen(tid);
  return o.length ? [o[0]] : [];
}

const KEY = (tid) => `sd_avail_${tid}`;

function load(tid) {
  // API TODO: replace with GET /api/skill/teacher/availability/
  try {
    const raw = localStorage.getItem(KEY(tid));
    if (raw) {
      const o = JSON.parse(raw);
      return { open: o.open || [], booked: o.booked || [] };
    }
  } catch (e) { /* ignore */ }
  return { open: defaultOpen(tid), booked: defaultBooked(tid) };
}

function save(tid, data) {
  // API TODO: replace with PATCH /api/skill/teacher/availability/
  try { localStorage.setItem(KEY(tid), JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export function get(tid) {
  return load(tid);
}

// status of a slot: "booked" | "open" | "closed"
export function status(tid, k) {
  const d = load(tid);
  if (d.booked.includes(k)) return "booked";
  if (d.open.includes(k))   return "open";
  return "closed";
}

// teacher toggles a slot open/closed; booked slots are locked.
export function toggleOpen(tid, k) {
  const d = load(tid);
  if (d.booked.includes(k)) return d;
  d.open = d.open.includes(k) ? d.open.filter((x) => x !== k) : [...d.open, k];
  save(tid, d);
  return d;
}

// mark a slot booked (on accepted request). Ensures it's also "open".
export function book(tid, k) {
  const d = load(tid);
  if (!d.open.includes(k))   d.open = [...d.open, k];
  if (!d.booked.includes(k)) d.booked = [...d.booked, k];
  save(tid, d);
  return d;
}

export function label(k) {
  const [di, si] = k.split("-").map(Number);
  return `${DAYS[di]} · ${SLOTS[si]}`;
}

export default { DAYS, SLOTS, get, status, toggleOpen, book, label, KEY };
