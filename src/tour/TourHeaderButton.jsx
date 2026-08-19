/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/TourHeaderButton.jsx       │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TourHeaderButton.jsx — entry point 2, the per-page "Tour" ghost button
 * (TOUR_SYSTEM_SPEC.md §6.1 item 2). Renders nothing when no T1/T2 entry
 * targets the given pathname, or outside a mounted TourProvider — safe to
 * drop into any page unconditionally, including ones with no tour yet.
 *
 * Deliberately not built on the spec's assumed `PageHeader` component:
 * neither student nor teacher's real T2 tour pages render `PageHeader` (it's
 * only used on 4 unrelated pages in the student app), and `shiksha-frontend`
 * has no such component at all. This is a small self-contained button each
 * page drops in next to its own title/toolbar instead — one insertion
 * pattern usable everywhere, rather than a component only 4 unrelated pages
 * could reach.
 */
import { useEffect, useState } from "react";
import { useTour } from "./useTour";

export default function TourHeaderButton({ pathname }) {
  const { availableForRoute, state, start, replay, canRun } = useTour();
  const entry = availableForRoute(pathname).find((e) => e.tier === "T1" || e.tier === "T2");

  // Route match is necessary but NOT sufficient — the tour's anchors have to
  // be on screen too. Tour targets commonly live inside a "has data" branch,
  // so on an empty page the button rendered, the first step resolved to
  // nothing, and the tour closed on the spot: a button that visibly does
  // nothing. Reported on Recordings, where BOTH steps anchor inside the
  // recordings grid, so a learner with no recordings could never run it.
  //
  // Re-checked after paint and whenever the route changes, because the page's
  // data usually arrives after this first renders — a render-time DOM query
  // alone would see the pre-data DOM and stay wrong.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!entry) { setReady(false); return undefined; }
    const check = () => setReady(canRun(entry));
    check();
    // One more pass on the next frame catches the common
    // "list rendered in the same commit" case.
    const id = requestAnimationFrame(check);
    return () => cancelAnimationFrame(id);
  });

  if (!entry || !ready) return null;

  const seen = entry.key in (state?.tours || {});

  return (
    <button
      type="button"
      className="tour-header-btn"
      onClick={() => (seen ? replay(entry.key) : start(entry.key, { bypassRules: true, force: true }))}
    >
      {seen ? "Replay tour" : "Tour"}
    </button>
  );
}
