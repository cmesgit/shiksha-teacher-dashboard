/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/useTour.js                 │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * useTour.js — the public hook (TOUR_SYSTEM_SPEC.md §7.1):
 *   { start, stop, replay, state, availableForRoute, setAutoplay }
 * plus `active` (the currently-running tour, if any) and `resetTours`
 * (backs the Help panel's "Reset all tours", §6.1).
 */
import { useTourContext } from "./TourProvider";

const FALLBACK = {
  start: () => false,
  stop: () => {},
  replay: () => false,
  state: null,
  active: null,
  setAutoplay: async () => {},
  resetTours: async () => {},
  availableForRoute: () => [],
  helpOpen: false,
  openHelp: () => {},
  closeHelp: () => {},
};

export function useTour() {
  const ctx = useTourContext();
  if (!ctx) {
    console.warn("useTour was called outside TourProvider.");
    return FALLBACK;
  }
  return ctx;
}
