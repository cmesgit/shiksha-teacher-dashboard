/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/position.js                │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * position.js — zero-dependency tour-card placement engine (TOUR_SYSTEM_SPEC.md §8).
 *
 * Pure function, no DOM reads/writes. Every rect passed in is viewport-relative
 * (the shape getBoundingClientRect() returns), because the overlay is a
 * position:fixed portal — page scroll must never enter this math.
 *
 * Algorithm, in order:
 *   1. Place  — position the card on the requested side, centred (or
 *      start/end-aligned) on the target.
 *   2. Flip   — if the requested side doesn't have room AND the opposite side
 *      has MORE room, use the opposite side instead. (If both sides are
 *      cramped, keep the requested side — flipping between two bad options
 *      just thrashes.)
 *   3. Shift  — clamp the cross-axis position inside the viewport minus
 *      `margin`. This is what guarantees the card never renders off-screen,
 *      independent of whether a flip happened.
 *   4. Arrow  — the pointer's offset along the card's edge, clamped to
 *      [16, cardLength - 16] so it never detaches from a rounded corner. If
 *      the RAW (pre-clamp) offset already fell outside that range, the
 *      target is too far off the card's edge for the arrow to point
 *      convincingly — return `arrowOffset: null` so the caller hides it
 *      entirely, rather than drawing it lying at the clamped position.
 */

const SIDES = ["top", "bottom", "left", "right"];
const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };
const ARROW_EDGE_INSET = 16;

function parsePlacement(placement) {
  const [side, align] = String(placement || "bottom").split("-");
  return {
    side: SIDES.includes(side) ? side : "bottom",
    align: align === "start" || align === "end" ? align : "center",
  };
}

// How much room exists between the target and the viewport edge on `side`.
function spaceOn(side, targetRect, viewport) {
  if (side === "top") return targetRect.top;
  if (side === "bottom") return viewport.height - targetRect.bottom;
  if (side === "left") return targetRect.left;
  return viewport.width - targetRect.right; // "right"
}

function placeOnSide(side, align, targetRect, cardSize, margin, arrowSize) {
  const gap = margin + arrowSize;
  let top, left;

  if (side === "top" || side === "bottom") {
    top = side === "top"
      ? targetRect.top - cardSize.height - gap
      : targetRect.bottom + gap;
    if (align === "start")      left = targetRect.left;
    else if (align === "end")   left = targetRect.right - cardSize.width;
    else                        left = targetRect.left + targetRect.width / 2 - cardSize.width / 2;
  } else {
    left = side === "left"
      ? targetRect.left - cardSize.width - gap
      : targetRect.right + gap;
    if (align === "start")      top = targetRect.top;
    else if (align === "end")   top = targetRect.bottom - cardSize.height;
    else                        top = targetRect.top + targetRect.height / 2 - cardSize.height / 2;
  }

  return { top, left };
}

function clamp(value, min, max) {
  // min > max happens when the card is bigger than the viewport minus
  // margins (very small viewports) — Math.max/Math.min still resolve to
  // something on-screen-ish rather than throwing; §10 gives mobile its own
  // bottom-sheet shape specifically so this stays a rare edge case.
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {object} opts
 * @param {{top:number,left:number,right:number,bottom:number,width:number,height:number}} opts.targetRect
 * @param {{width:number,height:number}} opts.cardSize
 * @param {string} opts.placement - "top"|"bottom"|"left"|"right", optionally "-start"/"-end"
 * @param {{width:number,height:number}} opts.viewport
 * @param {number} [opts.margin=12]
 * @param {number} [opts.arrowSize=10]
 * @returns {{top:number,left:number,placement:string,arrowOffset:number|null}}
 */
export function computePosition({
  targetRect, cardSize, placement, viewport, margin = 12, arrowSize = 10,
}) {
  const { side: requestedSide, align } = parsePlacement(placement);
  const gap = margin + arrowSize;

  const requiredSpace = (requestedSide === "top" || requestedSide === "bottom")
    ? cardSize.height + gap
    : cardSize.width + gap;

  let side = requestedSide;
  if (spaceOn(side, targetRect, viewport) < requiredSpace) {
    const flipped = OPPOSITE[side];
    if (spaceOn(flipped, targetRect, viewport) > spaceOn(side, targetRect, viewport)) {
      side = flipped;
    }
  }

  let { top, left } = placeOnSide(side, align, targetRect, cardSize, margin, arrowSize);

  // Shift — the card never leaves the screen, flip or no flip.
  left = clamp(left, margin, viewport.width - cardSize.width - margin);
  top = clamp(top, margin, viewport.height - cardSize.height - margin);

  const isVertical = side === "top" || side === "bottom";
  const cardLength = isVertical ? cardSize.width : cardSize.height;
  const targetCenter = isVertical
    ? targetRect.left + targetRect.width / 2
    : targetRect.top + targetRect.height / 2;
  const cardPos = isVertical ? left : top;
  const rawArrowOffset = targetCenter - cardPos;
  const minOffset = ARROW_EDGE_INSET;
  const maxOffset = cardLength - ARROW_EDGE_INSET;
  const arrowOffset = (rawArrowOffset < minOffset || rawArrowOffset > maxOffset)
    ? null
    : rawArrowOffset;

  return {
    top,
    left,
    placement: align === "center" ? side : `${side}-${align}`,
    arrowOffset,
  };
}
