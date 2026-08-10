/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                         │
 * │  Canonical source: <workspace>/shared/src/shared/settings/primitives.jsx    │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to        │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Small building blocks shared by every Settings section.
 *
 * These live here rather than in each app's component folder because the three
 * apps have no common primitive library: student has no Toggle or Toast, teacher
 * has react-hot-toast, the landing app has its own ToastContext. Anything the
 * Settings surface needs has to travel with it.
 *
 * Icons come from react-icons/ri — the only icon package present in all three
 * apps (the landing app also has lucide-react; the dashboards do not).
 */
import { RiCheckLine, RiErrorWarningLine } from "react-icons/ri";

/* ── Toggle switch — 42×24 track, 18×18 knob (design spec) ── */
export function Toggle({ on, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      className={`st-toggle ${on ? "on" : ""}`}
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="st-toggle__dot" />
    </button>
  );
}

/* ── Section title + caption ── */
export function SectionHead({ title, caption, badge }) {
  return (
    <>
      <div className="st-h1row">
        <h2 className="st-h1">{title}</h2>
        {badge}
      </div>
      {caption && <p className="st-caption">{caption}</p>}
    </>
  );
}

/* ── Uppercase group label ── */
export function GroupLabel({ children, tone }) {
  return <div className={`st-grouplabel ${tone ? `st-grouplabel--${tone}` : ""}`}>{children}</div>;
}

/* ── Labelled field wrapper ── */
export function Field({ label, hint, children, error }) {
  return (
    <div className="st-field">
      {label && <label className="st-label">{label}</label>}
      {children}
      {hint && !error && <div className="st-hint">{hint}</div>}
      {error && <div className="st-fielderr">{error}</div>}
    </div>
  );
}

/* ── Two-up field grid ── */
export function Grid2({ children }) {
  return <div className="st-grid2">{children}</div>;
}

/* ── Select built from [{value,label}] so options always come from the server ── */
export function Choice({ value, onChange, options, placeholder = "—", ...rest }) {
  return (
    <select className="st-input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/* ── A bordered card row: title + sub on the left, action on the right ── */
export function CardRow({ title, sub, children, tone }) {
  return (
    <div className={`st-cardrow ${tone ? `st-cardrow--${tone}` : ""}`}>
      <div className="st-cardrow__txt">
        <div className="st-cardrow__title">{title}</div>
        {sub && <div className="st-cardrow__sub">{sub}</div>}
      </div>
      <div className="st-cardrow__act">{children}</div>
    </div>
  );
}

/* ── A hairline toggle row (Notifications / Privacy lists) ── */
export function ToggleRow({ title, sub, on, onChange, disabled }) {
  return (
    <div className="st-togglerow">
      <div className="st-togglerow__txt">
        <div className="st-togglerow__title">{title}</div>
        {sub && <div className="st-togglerow__sub">{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}

/* ── Dashed empty-state card ── */
export function EmptyCard({ glyph, title, body, children }) {
  return (
    <div className="st-empty">
      {glyph && <div className="st-empty__glyph">{glyph}</div>}
      {title && <div className="st-empty__title">{title}</div>}
      {body && <p className="st-empty__body">{body}</p>}
      {children}
    </div>
  );
}

/* ── Status pill ── */
export function Badge({ tone = "gray", children }) {
  return <span className={`st-badge st-badge--${tone}`}>{children}</span>;
}

/* ── Inline result banner (replaces the per-app Toast the three apps don't share) ── */
export function Notice({ kind, children }) {
  if (!children) return null;
  return (
    <div className={`st-notice st-notice--${kind}`}>
      {kind === "ok" ? <RiCheckLine /> : <RiErrorWarningLine />}
      <span>{children}</span>
    </div>
  );
}

/* ── Loading / error states for the fetch-on-open sections ── */
export function Loading({ label = "Loading…" }) {
  return <div className="st-loading">{label}</div>;
}

/* ── helpers ── */
export const initials = (n) =>
  (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Readable API error text. Server errors arrive as a string, a {detail}, or a
 *  {field: [msgs]} map — flatten all three into one line rather than rendering
 *  "[object Object]" as the previous modal's Object.values(...).flat() could. */
export const errText = (e, fallback = "Something went wrong.") => {
  const d = e?.response?.data;
  if (!d) return e?.message || fallback;
  if (typeof d === "string") return d;
  if (typeof d.detail === "string") return d.detail;
  const parts = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === "code") continue;
    const text = Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : "";
    if (text) parts.push(text);
  }
  return parts.join(" ") || fallback;
};

/** "Active now" / "3 h ago" / "12 Jul 2026" — used by Sessions & devices. */
export const relTime = (iso) => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 3) return "Active now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
};

export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric", month: "short", year: "numeric",
      })
    : "";

/** ₹ with thousands separators, no trailing .00 on whole rupees. */
export const rupees = (n) => {
  const value = Number(n || 0);
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};
