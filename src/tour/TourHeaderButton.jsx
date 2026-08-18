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
import { useTour } from "./useTour";

export default function TourHeaderButton({ pathname }) {
  const { availableForRoute, state, start, replay } = useTour();
  const entry = availableForRoute(pathname).find((e) => e.tier === "T1" || e.tier === "T2");
  if (!entry) return null;

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
