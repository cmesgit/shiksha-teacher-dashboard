// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/common.jsx
//   teacher_ui/src/shared/comm/common.jsx
//
// Small, shared, stateless bits used across every Communication Center
// view (ConversationList, ConversationThread, MessageBubble, CourseHub,
// NotificationsView, PeopleDirectory, ProfileView, SettingsView,
// SupportView) — kept in one file so a label or a date format only ever
// has to change in one place.
import {
  FiUsers, FiUser, FiBookOpen, FiHeadphones, FiRadio, FiMessageCircle,
} from "react-icons/fi";

export function initials(name) {
  if (!name) return "?";
  return (
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?"
  );
}

// Small, deterministic hash -> one of a fixed palette, so the same person
// always gets the same "no photo" avatar color instead of a random one
// re-rolling on every render.
const AV_COLORS = ["#b3402e", "#1dcaab", "#ff8f01", "#6b2410", "#2c6e8f", "#7a4fb5"];
export function avatarColor(seed) {
  let h = 0;
  for (let i = 0; i < (seed || "").length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function Avatar({ src, name, identity, size = 36, online }) {
  const dim = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  return (
    <span className="cc-avatar-wrap" style={{ width: size, height: size }}>
      {src ? (
        <img className="cc-avatar" style={dim} src={src} alt="" />
      ) : (
        <span className="cc-avatar cc-avatar-fallback" style={{ ...dim, background: avatarColor(identity || name || "?") }}>
          {initials(name)}
        </span>
      )}
      {online === true && <span className="cc-avatar-dot cc-avatar-dot-on" />}
      {online === false && <span className="cc-avatar-dot cc-avatar-dot-off" />}
    </span>
  );
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function formatClock(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export function lastSeenLabel(iso) {
  if (!iso) return "Offline";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 120) return "Active just now";
  if (diff < 3600) return `Active ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Active ${Math.floor(diff / 3600)}h ago`;
  return `Active ${dayLabel(iso)}`;
}

// CC-004 category taxonomy, in the order they appear in the hub sidebar.
export const CATEGORY_META = {
  all:            { label: "Inbox",         Icon: FiMessageCircle },
  courses:        { label: "Courses",       Icon: FiBookOpen },
  faculty:        { label: "Faculty",       Icon: FiUser },
  guest_experts:  { label: "Guest Experts", Icon: FiUsers },
  students:       { label: "Students",      Icon: FiUsers },
  announcements:  { label: "Announcements", Icon: FiRadio },
  support:        { label: "Support",       Icon: FiHeadphones },
  other:          { label: "Other",         Icon: FiMessageCircle },
};

export function categoryLabel(cat) {
  return CATEGORY_META[cat]?.label || "Chat";
}

export const ROLE_LABEL = {
  faculty: "Faculty",
  guest: "Guest expert",
  academy: "Academy student",
  skilldev: "Skill Dev student",
  staff: "Support Team",
};

export function rolesLabel(roles) {
  if (!roles || !roles.length) return "";
  if (roles.includes("faculty") && roles.includes("guest")) return "Faculty · Guest expert";
  return roles.map((r) => ROLE_LABEL[r] || r).join(" · ");
}

// "L:<uuid>" -> { kind:"LEARNER", id:"<uuid>" } ; "T:<id>" -> TEACHER ; "S:<id>" -> STAFF
export function parseIdentity(identity) {
  if (!identity || identity === "me") return null;
  const idx = identity.indexOf(":");
  if (idx < 0) return null;
  const p = identity.slice(0, idx);
  const id = identity.slice(idx + 1);
  if (p === "L") return { kind: "LEARNER", id };
  if (p === "T") return { kind: "TEACHER", id };
  if (p === "S") return { kind: "STAFF", id };
  return null;
}

export function EmptyState({ icon, title, hint, action }) {
  return (
    <div className="cc-empty-state">
      {icon && <div className="cc-empty-icon">{icon}</div>}
      <div className="cc-empty-title">{title}</div>
      {hint && <div className="cc-empty-hint">{hint}</div>}
      {action}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="cc-spinner-wrap">
      <span className="cc-spinner" />
      {label && <span className="cc-spinner-label">{label}</span>}
    </div>
  );
}

export function SkeletonRows({ n = 5 }) {
  return (
    <div className="cc-skel-list">
      {Array.from({ length: n }).map((_, i) => (
        <div className="cc-skel-row" key={i}>
          <span className="cc-skel-avatar" />
          <span className="cc-skel-lines">
            <span className="cc-skel-line cc-skel-line-w60" />
            <span className="cc-skel-line cc-skel-line-w40" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function OfflineBanner({ show }) {
  if (!show) return null;
  return (
    <div className="cc-offline-banner">
      You're offline — reconnecting… messages you send now will go out once you're back.
    </div>
  );
}
