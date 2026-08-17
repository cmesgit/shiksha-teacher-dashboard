/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/TourCard.jsx               │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TourCard.jsx — the popover (TOUR_SYSTEM_SPEC.md §9.3) and its accessibility
 * contract (§11): role="dialog", focus moved in on mount/step-change, Tab
 * trapped inside, Esc = skip, ←/→ = back/next, Enter = next, focus restored
 * to whatever was focused before the tour started (handled by the caller —
 * TourCard only owns focus WHILE it's mounted).
 */
import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react";
import { CardPointer } from "./TourArrow";

function focusableIn(root) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.disabled && el.offsetParent !== null);
}

// forwardRef so TourOverlay can measure the actual card box (position:fixed,
// so a plain wrapper div around it would collapse to zero size — it must
// contribute nothing to normal flow) for position.js's cardSize input.
const TourCard = forwardRef(function TourCard({
  step, stepIndex, totalSteps, placement, arrowOffset, style,
  onNext, onBack, onSkip,
}, forwardedRef) {
  const cardRef = useRef(null);
  useImperativeHandle(forwardedRef, () => cardRef.current, []);
  const titleId = useId();
  const bodyId = useId();
  const isLast = stepIndex === totalSteps - 1;

  // Move focus onto the card every time the step changes, and trap Tab
  // inside it — §11. The overlay/provider is responsible for restoring
  // focus to whatever was focused before the tour started, once this
  // component unmounts (that happens above where "before" is still known).
  useEffect(() => {
    const focusables = focusableIn(cardRef.current);
    (focusables[0] || cardRef.current)?.focus();
  }, [stepIndex]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onSkip();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "Enter") {
      // Enter shouldn't double-fire when it's already activating a focused
      // button (Skip/Back) — only treat it as "next" when nothing more
      // specific is focused.
      if (e.key === "Enter" && document.activeElement?.tagName === "BUTTON") return;
      e.preventDefault();
      onNext();
      return;
    }
    if (e.key === "ArrowLeft" && stepIndex > 0) {
      e.preventDefault();
      onBack();
      return;
    }
    if (e.key === "Tab") {
      const focusables = focusableIn(cardRef.current);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      ref={cardRef}
      className="tour-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      tabIndex={-1}
      style={{ position: "fixed", top: style.top, left: style.left }}
      onKeyDown={handleKeyDown}
    >
      <CardPointer placement={placement} arrowOffset={arrowOffset} />

      {totalSteps <= 6 && (
        <div className="tour-card__eyebrow">STEP {stepIndex + 1} OF {totalSteps}</div>
      )}
      <h3 id={titleId} className="tour-card__title">{step.title}</h3>
      <p id={bodyId} className="tour-card__body">{step.body}</p>

      {totalSteps <= 6 && (
        <div className="tour-card__dots" aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={`tour-card__dot${i === stepIndex ? " tour-card__dot--on" : ""}`} />
          ))}
        </div>
      )}

      <div className="tour-card__footer">
        <button type="button" className="tour-card__skip" onClick={onSkip}>
          Skip tour
        </button>
        <div className="tour-card__footer-right">
          {stepIndex > 0 && (
            <button type="button" className="tour-card__back" onClick={onBack}>Back</button>
          )}
          <button type="button" className="tour-card__next" onClick={onNext}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="tour-visually-hidden">
        Step {stepIndex + 1} of {totalSteps}. {step.title}.
      </div>
    </div>
  );
});

export default TourCard;
