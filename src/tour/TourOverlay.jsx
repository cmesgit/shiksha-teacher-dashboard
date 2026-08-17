/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/TourOverlay.jsx            │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TourOverlay.jsx — portal root; composes scrim + spotlight + card + arrow
 * (TOUR_SYSTEM_SPEC.md §7.1/§8). Owns everything DOM-lifecycle related for
 * the CURRENT step: resolving + polling for the target (§5.3 R6/R7),
 * scrolling it into view, recomputing position on scroll/resize/target
 * resize, and detecting a mid-tour dialog interrupt (§5.2 S1). Step
 * NAVIGATION (which step, when to skip, when to close) stays in
 * TourProvider — this component only reports target-resolution and
 * interrupt events upward.
 *
 * Portalled to document.body (C2 — never rendered inside the app's own
 * header subtree, which clips position:fixed descendants via
 * backdrop-filter). Mirrors `data-track` on the portal root (C8) so a
 * body-portalled overlay still resolves the right per-track accent.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computePosition } from "./position";
import Spotlight from "./Spotlight";
import TourCard from "./TourCard";
import TourArrow from "./TourArrow";

const S1_SELECTOR = '[role="dialog"], .st-overlay, .cd__overlay, .tcd__overlay, .ps-modal-overlay, .confirm-overlay';
const CARD_WIDTH = 300;
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

export default function TourOverlay({
  entry, step, stepIndex, totalSteps, track,
  onNext, onBack, onClose, onTargetMissing, onInterrupted,
}) {
  const portalRoot = useRef(getOrCreatePortalRoot()).current;
  const cardRef = useRef(null);
  const restoreFocusEl = useRef(document.activeElement);

  const [targetEl, setTargetEl] = useState(null);
  const [pos, setPos] = useState(null); // { top, left, placement, arrowOffset }
  const [targetRect, setTargetRect] = useState(null);

  // ── Target resolution — R6/R7: at most 2 attempts (rAF + 300ms), then
  // give up and let the provider decide (skip this step, or abort if it's
  // the first). ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let timeoutId;
    setTargetEl(null);

    const attempt = () => {
      const el = document.querySelector(step.target);
      if (el && isVisible(el)) {
        if (!cancelled) setTargetEl(el);
        return true;
      }
      return false;
    };

    const rafId = requestAnimationFrame(() => {
      if (attempt() || cancelled) return;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        if (!attempt()) {
          if (import.meta.env?.DEV) {
            console.warn(`[tour] target not found, skipping step: ${step.target}`);
          }
          onTargetMissing();
        }
      }, 300);
    });

    return () => { cancelled = true; cancelAnimationFrame(rafId); clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.target]);

  // ── Scroll the target into view before first paint of this step, then
  // wait for scrollend (fallback 250ms) — §8. ────────────────────────────
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!targetEl) return;
    setScrolled(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targetEl.scrollIntoView({ block: "center", inline: "nearest", behavior: reduced ? "auto" : "smooth" });

    let settled = false;
    const settle = () => { if (!settled) { settled = true; setScrolled(true); } };
    const fallback = setTimeout(settle, 250);
    window.addEventListener("scrollend", settle, true);
    return () => { clearTimeout(fallback); window.removeEventListener("scrollend", settle, true); };
  }, [targetEl]);

  // ── Position recompute — rAF-throttled, on scroll (capture — catches
  // nested scroll containers), resize, and a ResizeObserver on the target. ─
  const rafScheduled = useRef(false);
  const recompute = useCallback(() => {
    if (rafScheduled.current) return;
    rafScheduled.current = true;
    requestAnimationFrame(() => {
      rafScheduled.current = false;
      if (!targetEl) return;
      const tRect = targetEl.getBoundingClientRect();
      setTargetRect(tRect);
      const cardHeight = cardRef.current?.getBoundingClientRect().height || 160;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const cardWidth = Math.min(CARD_WIDTH, viewport.width * 0.92);
      setPos(computePosition({
        targetRect: tRect,
        cardSize: { width: cardWidth, height: cardHeight },
        placement: step.placement || "bottom",
        viewport,
        margin: MARGIN,
      }));
    });
  }, [targetEl, step.placement]);

  useLayoutEffect(() => {
    if (!targetEl || !scrolled) return;
    recompute();
  }, [targetEl, scrolled, recompute]);

  // `hasCard` is a deliberate re-trigger: the first time this effect runs,
  // the card hasn't rendered yet (pos is still null, nothing to observe),
  // so cardRef.current is null. Once pos is first set and TourCard mounts,
  // this flips true and the effect re-subscribes — this time picking up
  // the now-real card element too, so its own size changes (e.g. a late
  // web-font swap reflowing the body text) also trigger a recompute.
  const hasCard = pos != null;
  useEffect(() => {
    if (!targetEl) return undefined;
    window.addEventListener("scroll", recompute, { capture: true, passive: true });
    window.addEventListener("resize", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(targetEl);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => {
      window.removeEventListener("scroll", recompute, { capture: true });
      window.removeEventListener("resize", recompute);
      ro.disconnect();
    };
  }, [targetEl, recompute, hasCard]);

  // ── S1 — a dialog opening mid-tour closes it (progress kept as
  // in-progress, not dismissed). Exempt when the entry declares
  // insideModal: true (e.g. a beacon meant to render inside a modal).
  // Only watches for FUTURE opens — a dialog already open before the tour
  // started is the trigger engine's job to have blocked (§5.2), not this
  // component's; re-checking that here would also incorrectly cancel a
  // manual replay, which bypasses that pre-check on purpose. ─────────────
  useEffect(() => {
    if (entry.insideModal) return undefined;
    const check = () => {
      const found = Array.from(document.querySelectorAll(S1_SELECTOR))
        .some((el) => !portalRoot.contains(el));
      if (found) onInterrupted();
    };
    const obs = new MutationObserver(() => requestAnimationFrame(check));
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [entry.insideModal, onInterrupted, portalRoot]);

  // ── Focus restore on close ───────────────────────────────────────────
  useEffect(() => () => {
    restoreFocusEl.current?.focus?.();
  }, []);

  if (!targetEl || !pos) return null;

  return createPortal(
    <div className="tour-overlay-root" data-track={track}>
      <Spotlight targetRect={targetRect} targetEl={targetEl} interactive={!!step.interactive} />
      <TourArrow
        cardRect={cardRef.current ? { ...pos, width: CARD_WIDTH, height: cardRef.current.getBoundingClientRect().height } : null}
        targetRect={step.pointer ? targetRect : null}
      />
      <TourCard
        ref={cardRef}
        step={step}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        placement={pos.placement}
        arrowOffset={pos.arrowOffset}
        style={{ top: pos.top, left: pos.left }}
        onNext={onNext}
        onBack={onBack}
        onSkip={() => onClose("dismissed")}
      />
    </div>,
    portalRoot
  );
}
