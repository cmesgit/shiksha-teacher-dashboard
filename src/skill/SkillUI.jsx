/* shared/skill/SkillUI.jsx — canonical, cross-app Skill Dev presentational primitives.
 *
 * Translated from design_handoff_skilldev/components/SkillDevComponents.jsx into this
 * codebase's own conventions: CSS custom properties (var(--…), never raw hex — see
 * shared/tokens.css's own header comment) instead of the reference file's inline hex,
 * and zero imports outside React so this file is safe to sync verbatim into both
 * shiksha-teacher-dashboard and shiksha-student-dashboard (see shared/sync.mjs) even
 * though their icon/asset files live at different paths. Presentational only — all
 * data and callbacks come in as props, same rule as the reference file.
 *
 * These are the pieces genuinely identical between the Student and Expert dashboards.
 * Anything shaped by per-app data (ExpertCard, FreeSlotPicker, the Sidebar itself…)
 * stays in each app's own src/skill/ or src/pages/skill/ — compose it from these.
 */

const initials = (name = "") =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const AVATAR_VARS = [
  "var(--sk-avatar-1)", "var(--sk-avatar-2)", "var(--sk-avatar-3)",
  "var(--sk-avatar-4)", "var(--sk-avatar-5)", "var(--sk-avatar-6)",
];

/** Deterministic per-name colour, one of the 6 palette slots in tokens.css. */
export const avatarColor = (name = "") =>
  AVATAR_VARS[((name.charCodeAt(0) || 0) + name.length) % AVATAR_VARS.length];

export const inr = (n) => Number(n ?? 0).toLocaleString("en-IN");

/** Initials avatar — no photo upload yet, per the handoff's known gap. */
export function Avatar({ name = "", img, size = 44, radius, circle = true, color }) {
  const r = circle ? "50%" : (radius ?? Math.round(size * 0.24));
  if (img) {
    return (
      <img src={img} alt="" style={{
        width: size, height: size, borderRadius: r, objectFit: "cover", flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: r, background: color || avatarColor(name),
      color: "#fff", display: "grid", placeItems: "center", flexShrink: 0,
      fontFamily: "var(--font-display)", fontWeight: 800,
      fontSize: Math.round(size * 0.34),
    }}>{initials(name)}</div>
  );
}

function StarIcon({ size = 11, filled }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={filled ? 0 : 1.6}>
      <path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.8 1.5 6.9L12 17.9l-6.1 3.4 1.5-6.9-5.2-4.8 6.9-.7z" />
    </svg>
  );
}

export function StarRow({ n = 0, size = 11 }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "var(--acc-ink)" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= n ? "var(--acc-ink)" : "var(--border)", display: "flex" }}>
          <StarIcon size={size} filled={s <= n} />
        </span>
      ))}
    </span>
  );
}

export function Rating({ v, reviews, size = 12 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "var(--acc-ink)", display: "flex" }}><StarIcon size={size} filled /></span>
      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>{v}</span>
      {reviews != null && <span style={{ fontSize: 11, color: "var(--sk-meta)" }}>({reviews})</span>}
    </span>
  );
}

export function Eyebrow({ children, tone = "var(--acc-ink)" }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: tone,
    }}>{children}</div>
  );
}

const CHIP_TONES = {
  neutral: { background: "var(--surface-muted)", color: "var(--ink-muted)", border: "1px solid var(--divider)" },
  amber:   { background: "var(--acc-soft)", color: "var(--sk-accent-text-on-tint)", border: "1px solid var(--acc-border)" },
  success: { background: "var(--success-soft)", color: "var(--sk-success-deep)", border: "1px solid var(--success-border)" },
  danger:  { background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger-border)" },
};

export function Chip({ children, tone = "neutral" }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 800, letterSpacing: ".4px", textTransform: "uppercase",
      borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap", ...CHIP_TONES[tone],
    }}>{children}</span>
  );
}

const BUTTON_VARIANTS = {
  primary:   { background: "var(--acc)", border: "none", color: "#fff" },
  success:   { background: "var(--success)", border: "none", color: "#fff" },
  secondary: { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-2)", fontWeight: 600 },
  danger:    { background: "var(--surface)", border: "1px solid var(--danger-border)", color: "var(--danger)" },
  link:      { background: "none", border: "none", padding: 0, color: "var(--ink-muted)", fontWeight: 600 },
};

/** Only use when a page has no existing button class to reach for — prefer the
 *  app's own `.btn`/`.sk-btn` classes where one already exists on that screen. */
export function Button({ variant = "primary", full, children, style, ...rest }) {
  return (
    <button
      style={{
        fontFamily: "var(--font-body)", fontSize: 12.5,
        fontWeight: 700, borderRadius: 10, padding: "10px 16px", cursor: "pointer",
        transition: "all .15s ease", width: full ? "100%" : undefined,
        ...BUTTON_VARIANTS[variant], ...style,
      }}
      {...rest}
    >{children}</button>
  );
}

/**
 * The product's central widget. Amber while in progress, green once mastered.
 * completed / target drive every label — never store the label itself.
 */
export function MasteryBlock({ completed, target, teacherFirstName, skill, onContinue }) {
  const mastered = completed >= target;
  const left = Math.max(0, target - completed);
  return (
    <div style={{
      background: mastered ? "var(--success-soft)" : "var(--acc-soft)",
      border: `1px solid ${mastered ? "var(--success-border)" : "var(--acc-border)"}`,
      borderRadius: 12, padding: "11px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          flex: 1, height: 6, borderRadius: 100, overflow: "hidden",
          background: mastered ? "var(--success-border)" : "var(--acc-border)",
        }}>
          <div style={{
            width: `${Math.min(100, Math.round((completed / target) * 100))}%`,
            height: "100%", borderRadius: 100,
            background: mastered ? "var(--success)" : "var(--acc-ink)",
          }} />
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
          color: mastered ? "var(--sk-success-deep)" : "var(--sk-accent-text-on-tint)",
        }}>{completed}/{target} sessions</span>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600, marginTop: 7, lineHeight: 1.45,
        color: mastered ? "var(--sk-success-deep)" : "var(--sk-accent-text-on-tint)",
      }}>
        {mastered
          ? `Mastery unlocked — you're an expert in ${skill}`
          : `${left} more session${left === 1 ? "" : "s"} with ${teacherFirstName} to become an expert`}
      </div>
      {onContinue && (
        <div style={{ marginTop: 11 }}>
          <Button variant={mastered ? "success" : "primary"} full onClick={onContinue}>
            {mastered ? "Book a refresher session" : "Continue → book a session"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** 16/9 intro-video placeholder. Swap the gradient for a real player/poster later. */
export function IntroVideoThumb({ accentColor = "#ff8f01", duration, onPlay, size = 46 }) {
  return (
    <div onClick={onPlay} style={{
      position: "relative", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden",
      background: "var(--ink)", display: "grid", placeItems: "center", cursor: "pointer",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(135deg, ${accentColor}cc, var(--ink))`,
      }} />
      <div style={{
        position: "relative", width: size, height: size, borderRadius: "50%",
        background: "rgba(255,143,1,.95)", display: "grid", placeItems: "center",
        color: "#fff", fontSize: size * 0.33,
      }}>▶</div>
      <span style={{
        position: "absolute", top: 9, left: 9, fontSize: 9, fontWeight: 800,
        letterSpacing: ".5px", textTransform: "uppercase",
        background: "rgba(0,0,0,.5)", color: "var(--sk-accent-light)", borderRadius: 999, padding: "3px 8px",
      }}>Intro video</span>
      {duration && (
        <span style={{
          position: "absolute", bottom: 9, right: 9, fontSize: 10, fontWeight: 700,
          background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: 6, padding: "3px 7px",
        }}>{duration}</span>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, description, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      gap: 24, flexWrap: "wrap", paddingBottom: 16,
      borderBottom: "1px solid var(--divider)", marginBottom: 20,
    }}>
      <div style={{ maxWidth: 620 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.65, marginTop: 6, textWrap: "pretty" }}>
          {description}
        </div>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div style={{
      border: "1px dashed var(--border)", borderRadius: 14, padding: 26,
      textAlign: "center", fontSize: 12.5, color: "var(--sk-meta)",
    }}>{children}</div>
  );
}
