// Shared session time-display helpers so "Today/Tmrw/Wed", "3:00PM", and
// "in 25 min" read identically to the student dashboard's Live Sessions rows.
// Ported verbatim from the student app's utils/sessionTime.js.

export function fmtClockTime(dt) {
  return dt
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase()
    .replace(" ", "");
}

export function dayLabel(dt) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const d0 = new Date(dt);
  d0.setHours(0, 0, 0, 0);
  const diff = Math.round((d0 - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tmrw";
  if (diff === -1) return "Yday";
  return dt.toLocaleDateString("en-GB", { weekday: "short" });
}

export function startsInText(dt) {
  const mins = Math.round((dt.getTime() - Date.now()) / 60000);
  if (mins < 0) return "in progress";
  if (mins < 60) return `in ${mins} min`;
  if (mins < 1440) return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  const days = Math.round(mins / 1440);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
