/**
 * src/components/skill/SkillIcons.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * The Skill Dev pages were prototyped against a small inline-SVG icon set
 * (Icon.cap, Icon.vid, …). Re-creating it locally keeps the ported markup
 * identical and avoids guessing react-icons equivalents. Each takes a `size`.
 */
const s = (size, children, extra = {}) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    {...extra}
  >
    {children}
  </svg>
);

export const Icon = {
  cap:   ({ size = 16 }) => s(size, <><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/></>),
  vid:   ({ size = 16 }) => s(size, <><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4V8z"/></>),
  doc:   ({ size = 16 }) => s(size, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>),
  cal:   ({ size = 16 }) => s(size, <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>),
  clock: ({ size = 16 }) => s(size, <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  shield:({ size = 16 }) => s(size, <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/>),
  spark: ({ size = 16 }) => s(size, <path d="M12 2l2.4 6.4L21 11l-6.6 2.6L12 20l-2.4-6.4L3 11l6.6-2.6L12 2z"/>),
  star:  ({ size = 16 }) => s(size, <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 21.5 12 17.5 5.5 21.5 7 14.5 2 9.5 9 9 12 2"/>, { fill: "currentColor", stroke: "none" }),
  users: ({ size = 16 }) => s(size, <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>),
  user:  ({ size = 16 }) => s(size, <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  msg:   ({ size = 16 }) => s(size, <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>),
  award: ({ size = 16 }) => s(size, <><circle cx="12" cy="8" r="6"/><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5"/></>),
  check: ({ size = 16 }) => s(size, <polyline points="20 6 9 17 4 12"/>),
  plus:  ({ size = 16 }) => s(size, <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
  x:     ({ size = 16 }) => s(size, <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  arrow: ({ size = 16 }) => s(size, <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>),
  back:  ({ size = 16 }) => s(size, <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>),
  search:({ size = 16 }) => s(size, <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>),
  clipboard: ({ size = 16 }) => s(size, <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></>),
};

/* Small star-row + rating helpers reused on several pages */
export function StarRow({ n, size = 11 }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((x) => (
        <span key={x} style={{ color: x <= n ? "#f5a623" : "#dcd3c4", display: "flex" }}>
          <Icon.star size={size} />
        </span>
      ))}
    </span>
  );
}

export function Rating({ v, reviews }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "#f5a623", display: "flex" }}><Icon.star size={12} /></span>
      <span style={{ fontSize: 12, fontWeight: 800, color: "#1a2c33" }}>{v}</span>
      {reviews != null && <span style={{ fontSize: 11, color: "#999" }}>({reviews})</span>}
    </span>
  );
}

export default Icon;
