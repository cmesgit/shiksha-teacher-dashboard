// src/components/CalendarWidget.jsx
//
// Matches the design's rail calendar exactly (Academy Dashboard.dc.html,
// Teacher view lines 111-132): a "‹ Month Year ›" header (no month/year
// dropdowns), a 7-column day grid, and per-day dots for events — no legend.
import { useState } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Matches TYPE_META in TeacherDashboard.jsx (same categories, same colours).
const EVENT_COLORS = {
  "assignment":         "#2f9d42",
  "assignment-overdue": "#dc2626",
  "quiz":               "#7c3aed",
  "quiz-overdue":       "#dc2626",
  "private-session":    "#c2701c",
  "live-session":       "#13899b",
};

const now = new Date();

export default function CalendarWidget({ events = {}, selectedDate = null, onDateSelect }) {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const changeMonth = (dir) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  const isSelected = (day) =>
    selectedDate &&
    day === selectedDate.getDate() &&
    month === selectedDate.getMonth() &&
    year === selectedDate.getFullYear();

  return (
    <section className="dash-card dash-cal">
      <div className="dash-cal__head">
        <button type="button" className="dash-cal__nav" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
        <span className="dash-cal__label">{MONTHS[month]} {year}</span>
        <button type="button" className="dash-cal__nav" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
      </div>

      <div className="dash-cal__grid">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="dash-cal__dayName">{d}</span>
        ))}

        {[...Array((firstDay + 6) % 7)].map((_, i) => (
          <span key={`empty-${i}`} />
        ))}

        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday =
            day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const selected = isSelected(day);
          const eventTypes = events[dateKey] || null;

          return (
            <button
              type="button"
              key={day}
              className={
                "dash-cal__cell" +
                (isToday ? " dash-cal__cell--today" : "") +
                (selected ? " dash-cal__cell--selected" : "")
              }
              onClick={() => onDateSelect?.(new Date(year, month, day))}
            >
              <span>{day}</span>
              {eventTypes?.length > 0 && (
                <span className="dash-cal__dots">
                  {eventTypes.map((type) => (
                    <span key={type} className="dash-cal__dot" style={{ background: EVENT_COLORS[type] || "#ccc" }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
