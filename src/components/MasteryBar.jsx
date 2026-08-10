// components/MasteryBar.jsx
//
// The mastery progress bar + sentence, reused verbatim across the Expert
// Students (mastery tracker) screen and anywhere else progress-toward-target
// is shown (design_handoff_skilldev/README.md). Byte-identical to the
// student app's copy — port both together if the design changes.
//
// Two variants:
//   "hero" — track --skill-border, fill --skill (flat brand orange).
//   "card" — amber (fill --skill-ink) while in progress, green (fill
//            --success) once mastered.
export default function MasteryBar({
  progress, target, mastered, variant = "card", sentence, height = 7,
}) {
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  const track = variant === "hero" ? "var(--skill-border)"
    : mastered ? "var(--success-border)" : "var(--skill-border)";
  const fill = variant === "hero" ? "var(--skill)"
    : mastered ? "var(--success)" : "var(--skill-ink)";

  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 6, fontSize: 11.5, fontWeight: 700, color: "var(--ink-muted)",
      }}>
        <span>{progress} of {target}</span>
      </div>
      <div style={{
        height, borderRadius: "var(--r-pill)", background: track, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: "var(--r-pill)",
          background: fill, transition: "width .3s ease",
        }} />
      </div>
      {sentence && (
        <p style={{
          margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)",
          textWrap: "pretty",
        }}>{sentence}</p>
      )}
    </div>
  );
}
