/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/Spotlight.jsx              │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Spotlight.jsx — the scrim + spotlight cutout (TOUR_SYSTEM_SPEC.md §9.2).
 *
 * One full-viewport <svg> with a <mask>: a white rect covering everything
 * plus a black rounded-rect cutout over the target — real rounded corners,
 * animates as a single element (beats the four-div technique).
 *
 * `interactive: true` (schema §7.3) is approximated with `pointer-events:
 * none` on the whole scrim rather than a true geometric hole — the mask
 * technique the spec calls for doesn't produce a real click-through hole
 * (masking hides pixels, it doesn't remove hit-testing), and an evenodd
 * cutout path would give that up. No registry content uses `interactive`
 * yet; revisit if a future step genuinely needs "click only inside the
 * spotlight, blocked everywhere else."
 */
import { useId, useMemo } from "react";

function resolveCutoutRadius(targetEl) {
  if (targetEl) {
    const r = parseFloat(getComputedStyle(targetEl).borderRadius);
    if (!Number.isNaN(r) && r > 0) return r;
  }
  const fallback = getComputedStyle(document.documentElement)
    .getPropertyValue("--tour-radius");
  const parsed = parseFloat(fallback);
  return Number.isNaN(parsed) ? 12 : parsed;
}

export default function Spotlight({ targetRect, targetEl, padding = 6, interactive = false }) {
  const maskId = useId();
  const radius = useMemo(() => resolveCutoutRadius(targetEl), [targetEl]);

  if (!targetRect) return null;

  const x = targetRect.left - padding;
  const y = targetRect.top - padding;
  const w = targetRect.width + padding * 2;
  const h = targetRect.height + padding * 2;

  return (
    <svg
      className="tour-scrim"
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: interactive ? "none" : "auto" }}
    >
      <mask id={maskId}>
        <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
        <rect className="tour-scrim__cutout" x={x} y={y} width={w} height={h} rx={radius} fill="#000" />
      </mask>
      <rect x="0" y="0" width="100%" height="100%" className="tour-scrim__fill" mask={`url(#${maskId})`} />
      <rect
        className="tour-scrim__cutout-stroke"
        x={x} y={y} width={w} height={h} rx={radius}
        fill="none"
      />
    </svg>
  );
}
