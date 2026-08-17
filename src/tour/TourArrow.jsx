/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/TourArrow.jsx              │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TourArrow.jsx — two distinct things, per TOUR_SYSTEM_SPEC.md §9.4. Do not
 * conflate them:
 *
 *   1. Card pointer  — the 10px triangle joining the card to its target.
 *      Positioned from position.js's `arrowOffset`; renders nothing when
 *      that's null (the clamp saturated — see position.js's docstring).
 *   2. Emphasis arrow — a curved line from the card toward the target,
 *      only when the step sets `pointer: true`. Draws on over 420ms via the
 *      pathLength="1" trick (normalizes stroke-dasharray to 0..1 regardless
 *      of actual path length, so the draw-on works without measuring the
 *      rendered path in JS).
 */

const SIDE_TRANSFORM = {
  // Base triangle path points "up" (pointing away from the card, toward a
  // target above it — i.e. for placement="bottom", where the card sits
  // below the target and the pointer must point up at it). Rotate for the
  // other three sides.
  top:    "rotate(180deg)",
  bottom: "rotate(0deg)",
  left:   "rotate(90deg)",
  right:  "rotate(-90deg)",
};

export function CardPointer({ placement, arrowOffset, size = 10 }) {
  if (arrowOffset == null) return null;
  const side = String(placement).split("-")[0];
  const isVertical = side === "top" || side === "bottom";

  const style = {
    position: "absolute",
    width: size * 1.6,
    height: size,
    pointerEvents: "none",
    ...(isVertical
      ? { left: arrowOffset - (size * 1.6) / 2, [side === "top" ? "bottom" : "top"]: -size }
      : { top: arrowOffset - (size * 1.6) / 2, [side === "left" ? "right" : "left"]: -size }),
  };

  return (
    <svg
      className="tour-card__pointer"
      style={{ ...style, transform: SIDE_TRANSFORM[side] }}
      viewBox="0 0 16 10"
      aria-hidden="true"
    >
      <path d="M8 0 L16 10 L0 10 Z" />
    </svg>
  );
}

/** The single-per-tour emphasis arrow (step.pointer: true). Card and target
 * rects are viewport-relative; the SVG is a full-viewport overlay sibling so
 * its own coordinate space matches. */
export default function TourArrow({ cardRect, targetRect }) {
  if (!cardRect || !targetRect) return null;

  const startX = cardRect.left + cardRect.width / 2;
  const startY = cardRect.top + cardRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;
  // Gentle curve via a control point offset perpendicular to the straight line.
  const midX = (startX + endX) / 2 + (endY - startY) * 0.15;
  const midY = (startY + endY) / 2 - (endX - startX) * 0.15;

  return (
    <svg
      className="tour-emphasis-arrow"
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <marker id="tour-arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--tour-accent)" />
        </marker>
      </defs>
      <path
        d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
        fill="none"
        stroke="var(--tour-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        markerEnd="url(#tour-arrowhead)"
        pathLength="1"
        className="tour-emphasis-arrow__path"
      />
    </svg>
  );
}
