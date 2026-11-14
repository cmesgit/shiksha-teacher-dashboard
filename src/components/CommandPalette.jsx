// ⌘/Ctrl-K palette for Dashboards v2.
//
// SCOPE, deliberately: this navigates. It does NOT search your classes,
// assignments or people, even though the topbar placeholder says
// "Search classes, assignments, people".
//
// There is no cross-entity search endpoint in this backend:
//   • chat/search/            → conversations + the people directory only
//   • content/admin/search/   → the admin CMS, admin-only
//   • skill/teachers/?search= → experts only
// Nothing searches LiveSession / Assignment / Quiz / StudyMaterial. Building
// that is Phase B; until it lands, offering a box that silently returns
// nothing for "quadratic equations" would be worse than offering a box that
// is honest about jumping to pages. The empty state says so.
//
// Rendered through a portal to <body>: a v2 panel can sit inside a
// transformed ancestor, and a transform makes that ancestor the containing
// block for `position: fixed`, which would trap the overlay inside a card.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { NAV } from "../utils/academyNav";
import "../styles/commandPalette.css";

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  const destinations = useMemo(
    () => NAV.filter((n) => n.to).map((n) => ({ label: n.l, to: n.to })),
    []
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return destinations;
    return destinations.filter((d) => d.label.toLowerCase().includes(needle));
  }, [q, destinations]);

  // Reset and focus on each open.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setCursor(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const go = (d) => {
    onClose?.();
    navigate(d.to);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[cursor]) go(results[cursor]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
    }
  };

  return createPortal(
    <div
      className="cp-overlay"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="cp-sheet" role="dialog" aria-modal="true" aria-label="Jump to">
        <input
          ref={inputRef}
          className="cp-input"
          value={q}
          placeholder="Jump to a page…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Jump to a page"
        />

        <p className="cp-eyebrow">JUMP TO</p>

        {results.length === 0 ? (
          <p className="cp-empty">
            No page matches “{q.trim()}”. Searching inside your classes,
            assignments and messages isn’t available yet.
          </p>
        ) : (
          <ul className="cp-list">
            {results.map((d, i) => (
              <li key={d.to}>
                <button
                  type="button"
                  className={`cp-row${i === cursor ? " is-active" : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(d)}
                >
                  {d.label}
                  <span className="cp-row-path">{d.to}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}
