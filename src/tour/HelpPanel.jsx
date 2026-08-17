/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/HelpPanel.jsx              │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * HelpPanel.jsx — the "button to activate them again" (TOUR_SYSTEM_SPEC.md
 * §6.1). Right-side sheet, portalled like TourOverlay but on its own root so
 * the two never fight over `#tour-overlay-root`. Rendered by TourProvider
 * whenever `helpOpen` is true — never imported directly by app code; reach
 * it via `useTour().openHelp()`.
 *
 * Grouping: spec doesn't specify how rows should be labelled/grouped, only
 * that they should be ("grouped by area"). Derives both from the registry
 * key's own `<app>.<area>.<name>` convention (§7.3) plus an optional
 * `entry.label` for the row's display text — falls back to a title-cased
 * last key segment if a registry entry doesn't set one, so this never
 * renders a blank row even for entries authored before this convention
 * existed.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function getOrCreatePortalRoot() {
  let root = document.getElementById("tour-help-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "tour-help-root";
    document.body.appendChild(root);
  }
  return root;
}

function titleCase(s) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function areaOf(entry) {
  // §7.3 documents keys as "<app>.<area>.<name>", but not every real key
  // follows it (e.g. "student.recordings" is 2 segments, not 3) — for those,
  // group by the last segment rather than the app prefix, so an outlier key
  // never gets silently dumped into a generic app-wide bucket.
  const parts = entry.key.split(".");
  return titleCase(parts.length > 2 ? parts[1] : parts[parts.length - 1]);
}

function labelOf(entry) {
  if (entry.label) return entry.label;
  const parts = entry.key.split(".");
  return titleCase(parts[parts.length - 1]);
}

function statusOf(record) {
  if (!record) return { text: "Not started", started: false };
  const date = record.at
    ? new Date(record.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : "";
  if (record.status === "completed") return { text: `Completed ${date}`, started: true };
  if (record.status === "dismissed") return { text: `Skipped ${date}`, started: true };
  return { text: "Not started", started: false };
}

// A Start/Replay click only works if the entry's anchors actually exist on
// the CURRENT page — most entries are scoped to a route with a dynamic id
// (":courseId", ":subjectId"...) that this panel has no way to navigate to
// on the user's behalf. Reusing the entry's own `conditions` (if any) is the
// precise check; falling back to a plain route-prefix test otherwise mirrors
// TourProvider's own `matchesRoute` closely enough for this purpose.
function reachableHere(entry, pathname) {
  if (Array.isArray(entry.conditions) && entry.conditions.length) {
    try { return entry.conditions.every((fn) => fn({ location: { pathname } })); } catch { return false; }
  }
  const match = entry.trigger?.match;
  if (!match) return false;
  return match === pathname || (match !== "/" && pathname.startsWith(match));
}

export default function HelpPanel({ registry, state, track, pathname, onClose, onStart, onReplay, onSetAutoplay, onResetAll }) {
  const portalRoot = getOrCreatePortalRoot(); // idempotent (getElementById-or-create) — no ref needed
  const sheetRef = useRef(null);

  useEffect(() => {
    const focusables = sheetRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusables?.[0]?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusables = Array.from(
        sheetRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toursEnabled = state?.features?.tours_enabled !== false;

  const groups = new Map();
  for (const entry of registry) {
    const area = areaOf(entry);
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(entry);
  }

  return createPortal(
    <div className="tour-help-root" data-track={track}>
      <div className="tour-help__scrim" onClick={onClose} />
      <div
        ref={sheetRef}
        className="tour-help__sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Help and tours"
      >
        <div className="tour-help__header">
          <h2 className="tour-help__title">Help &amp; tours</h2>
          <button type="button" className="tour-help__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!toursEnabled ? (
          <div className="tour-help__empty">
            <p>Guided tours are turned off for your account right now.</p>
          </div>
        ) : (
          <>
            <label className="tour-help__autoplay">
              <input
                type="checkbox"
                checked={state?.autoplay_enabled !== false}
                onChange={(e) => onSetAutoplay(e.target.checked)}
              />
              Show tips automatically
            </label>

            <div className="tour-help__list">
              {Array.from(groups.entries()).map(([area, entries]) => (
                <div key={area} className="tour-help__group">
                  <div className="tour-help__groupLabel">{area}</div>
                  {entries.map((entry) => {
                    const record = state?.tours?.[entry.key];
                    const { text, started } = statusOf(record);
                    const here = reachableHere(entry, pathname);
                    return (
                      <div key={entry.key} className="tour-help__row">
                        <div className="tour-help__rowText">
                          <div className="tour-help__rowLabel">{labelOf(entry)}</div>
                          <div className="tour-help__rowStatus">
                            {text}
                            {!here && " · visit this page to " + (started ? "replay" : "start")}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="tour-help__rowBtn"
                          disabled={!here}
                          onClick={() => (started ? onReplay(entry.key) : onStart(entry.key))}
                        >
                          {started ? "Replay" : "Start"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="tour-help__resetAll"
              onClick={() => {
                // Irreversible from the user's side (clears every tour's
                // progress) — a native confirm is the simplest dependency-
                // free guard that still works identically across all three
                // apps' differing dialog components.
                if (window.confirm("Reset all tours? This clears what you've seen and can't be undone.")) {
                  onResetAll();
                }
              }}
            >
              Reset all tours
            </button>
          </>
        )}
      </div>
    </div>,
    portalRoot
  );
}
