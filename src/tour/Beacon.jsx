/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/Beacon.jsx                 │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Beacon.jsx — T3 pulsing-dot hint (TOUR_SYSTEM_SPEC.md §9.5). Deliberately
 * NOT built on TourOverlay/Spotlight: a T3 entry has exactly one target, no
 * scrim, no step counter, and stays visible indefinitely (not one auto-fire
 * per session like T1/T2) — it's a passive, self-serve affordance the user
 * finds on their own, not something the R1-R3 rate limits govern. It IS
 * still subject to R9 (tours_enabled), R4 (dismiss/click is permanent), S1
 * (open dialog, unless insideModal), S2, and S7 (mobile) — rendered by
 * TourProvider's <BeaconField>, which owns those checks so this component
 * only has to find its own target and draw the dot.
 *
 * Reuses TourCard for the click-to-reveal tooltip (§9.5's "single TourCard
 * with no scrim and no step counter") via its hideProgress/hideSkip props.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computePosition } from "./position";
import TourCard from "./TourCard";

const CARD_WIDTH = 280;
const MARGIN = 12;

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none";
}

function getOrCreatePortalRoot() {
  let root = document.getElementById("tour-overlay-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "tour-overlay-root";
    document.body.appendChild(root);
  }
  return root;
}

export default function Beacon({ entry, onDismiss }) {
  const [portalRoot] = useState(getOrCreatePortalRoot);
  const step = entry.steps[0];
  const cardRef = useRef(null);

  const [targetEl, setTargetEl] = useState(null);
  const [dotRect, setDotRect] = useState(null);
  const [open, setOpen] = useState(false);
  const [cardPos, setCardPos] = useState(null);
  // The ring's `animation-iteration-count: 3` won't restart on :hover by
  // itself (a finished CSS animation needs a remount, not just a pseudo-
  // class toggle) — bumping this key remounts the <span> to replay it.
  const [pulseKey, setPulseKey] = useState(0);

  // Deliberately NOT TourOverlay's R6/R7 two-attempt-then-give-up poll — that
  // rule exists for a step inside an already-RUNNING tour, where giving up
  // and skipping forward makes sense. A beacon has nowhere to skip to: it's
  // ambient and "stays visible indefinitely" (§9.5), so `insideModal: true`
  // entries (the Settings-sessions beacon is the spec's own example) need to
  // keep watching for their target to appear — and disappear again, e.g. the
  // modal closing — for as long as this component is mounted at all.
  useEffect(() => {
    const check = () => {
      const el = document.querySelector(step.target);
      const found = el && isVisible(el) ? el : null;
      setTargetEl((prev) => (prev === found ? prev : found));
    };
    check();
    const intervalId = setInterval(check, 400);
    return () => clearInterval(intervalId);
  }, [step.target]);

  // rAF-deferred, same as TourOverlay's own `recompute` — a setState call
  // straight in an effect body triggers cascading-render lint (and is
  // genuinely a smell); deferring one tick avoids it either way.
  const rafScheduled = useRef(false);
  const recompute = useCallback(() => {
    if (rafScheduled.current) return;
    rafScheduled.current = true;
    requestAnimationFrame(() => {
      rafScheduled.current = false;
      if (targetEl) setDotRect(targetEl.getBoundingClientRect());
    });
  }, [targetEl]);

  useEffect(() => {
    if (!targetEl) return undefined;
    recompute();
    window.addEventListener("scroll", recompute, { capture: true, passive: true });
    window.addEventListener("resize", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(targetEl);
    return () => {
      window.removeEventListener("scroll", recompute, { capture: true });
      window.removeEventListener("resize", recompute);
      ro.disconnect();
    };
  }, [targetEl, recompute]);

  useEffect(() => {
    if (!open || !dotRect) return undefined;
    const rafId = requestAnimationFrame(() => {
      const cardHeight = cardRef.current?.getBoundingClientRect().height || 120;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const cardWidth = Math.min(CARD_WIDTH, viewport.width * 0.92);
      // Anchor the card on the dot's own (near-zero-size) rect, not the
      // target's — a beacon points at a specific corner, not the whole
      // element the way a spotlight tour does.
      setCardPos(computePosition({
        targetRect: { top: dotRect.top, left: dotRect.right, right: dotRect.right, bottom: dotRect.top, width: 0, height: 0 },
        cardSize: { width: cardWidth, height: cardHeight },
        placement: step.placement || "bottom",
        viewport,
        margin: MARGIN,
      }));
    });
    return () => cancelAnimationFrame(rafId);
  }, [open, dotRect, step.placement]);

  if (!targetEl || !dotRect) return null;

  const dismiss = () => { setOpen(false); onDismiss(); };

  return createPortal(
    <>
      <button
        type="button"
        className="tour-beacon"
        style={{ top: dotRect.top - 4, left: dotRect.right - 4 }}
        aria-label={step.title}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setPulseKey((k) => k + 1)}
      >
        <span key={pulseKey} className="tour-beacon__ring" />
        <span className="tour-beacon__dot" />
      </button>
      {open && cardPos && (
        <TourCard
          ref={cardRef}
          step={step}
          stepIndex={0}
          totalSteps={1}
          placement={cardPos.placement}
          arrowOffset={cardPos.arrowOffset}
          style={{ top: cardPos.top, left: cardPos.left }}
          hideProgress
          hideSkip
          onNext={dismiss}
          onBack={() => {}}
          onSkip={dismiss}
        />
      )}
    </>,
    portalRoot
  );
}
