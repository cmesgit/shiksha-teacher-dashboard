/**
 * TrackSwitcher.jsx — Academy ⟷ Skill-dev switch for the teacher dashboard.
 *
 * Reads the per-track status from the teacher identity (useAuth().teacherInfo):
 *   approved → selectable; switches the dashboard (Academy = Faculty,
 *              Skill Dev = Guest-expert)
 *   pending  → shown with a "review" badge, not selectable
 *   locked   → never applied for; clicking deep-links to the add-a-track
 *              signup (email/username are skipped because the account exists)
 *
 * Switching between two already-approved tracks is pure client-side routing —
 * no password re-entry, since this is already a teacher session.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { RiLockLine } from "react-icons/ri";
import { useAuth } from "../contexts/AuthContext";
import { signupAddTrackUrl } from "../config/urls";
import "../styles/trackSwitcher.css";

const TRACKS = [
  { key: "academy", label: "Academy",   path: "/teacher/dashboard" },
  { key: "skill",   label: "Skill Dev", path: "/teacher/expert" },
];

export default function TrackSwitcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { teacherInfo } = useAuth();

  if (!teacherInfo) return null;

  const tracks  = teacherInfo.tracks || {};
  const statusOf = (k) => tracks[k] || "locked";
  // Which dashboard is on screen right now (drives the highlight).
  const current = pathname.startsWith("/teacher/expert") ? "skill" : "academy";

  // Don't show a one-segment switch — nothing to switch to.
  const anyOther = TRACKS.some((t) => t.key !== current && statusOf(t.key) !== "locked");
  const hasLocked = TRACKS.some((t) => statusOf(t.key) === "locked");
  if (!anyOther && !hasLocked) return null;

  const onClick = (t) => {
    const st = statusOf(t.key);
    if (st === "approved") {
      if (t.key !== current) navigate(t.path);
      return;
    }
    if (st === "pending") return;                 // in review — not navigable
    window.location.href = signupAddTrackUrl(t.key); // locked → apply
  };

  return (
    <div className="trackSwitcher" role="tablist" aria-label="Teaching track">
      {TRACKS.map((t) => {
        const st = statusOf(t.key);
        const active = st === "approved" && t.key === current;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={[
              "trackSwitcher__seg",
              active ? "is-active" : "",
              st === "locked" ? "is-locked" : "",
              st === "pending" ? "is-pending" : "",
            ].join(" ").trim()}
            title={
              st === "pending" ? "In admin review"
                : st === "locked" ? `Apply to teach ${t.label}`
                : t.label
            }
            onClick={() => onClick(t)}
          >
            {st === "locked" && <RiLockLine className="trackSwitcher__lock" />}
            <span>{t.label}</span>
            {st === "pending" && <span className="trackSwitcher__badge">review</span>}
          </button>
        );
      })}
    </div>
  );
}
