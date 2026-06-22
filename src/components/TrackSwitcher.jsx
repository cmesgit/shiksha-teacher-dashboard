/**
 * TrackSwitcher.jsx — Faculty ⟷ Expert slider for the teacher dashboard.
 * Styled to match the Auth Flow prototype (rd-switch teacher variant): the
 * active side is blue. Approved tracks switch dashboards (Faculty = academic,
 * Expert = guest); a pending track shows a "review" badge; a track never
 * applied for is locked and deep-links to the add-a-track signup.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { RiGraduationCapFill, RiSparkling2Fill, RiLockLine } from "react-icons/ri";
import { useAuth } from "../contexts/AuthContext";
import { signupAddTrackUrl } from "../config/urls";
import "../styles/trackSwitcher.css";

const TRACKS = [
  { key: "academy", label: "Faculty", path: "/teacher/dashboard", Icon: RiGraduationCapFill },
  { key: "skill",   label: "Expert",  path: "/teacher/expert",    Icon: RiSparkling2Fill },
];

export default function TrackSwitcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { teacherInfo } = useAuth();
  if (!teacherInfo) return null;

  const tracks = teacherInfo.tracks || {};
  const statusOf = (k) => tracks[k] || "locked";
  const current = pathname.startsWith("/teacher/expert") ? "skill" : "academy";

  const anyOther = TRACKS.some((t) => t.key !== current && statusOf(t.key) !== "locked");
  const hasLocked = TRACKS.some((t) => statusOf(t.key) === "locked");
  if (!anyOther && !hasLocked) return null;

  const onClick = (t) => {
    const st = statusOf(t.key);
    if (st === "approved") { if (t.key !== current) navigate(t.path); return; }
    if (st === "pending") return;                 // in review — not navigable
    window.location.href = signupAddTrackUrl(t.key); // locked → apply
  };

  return (
    <div className="trackSwitcher ctx-teacher" role="tablist" aria-label="Teaching track" title="Switch dashboard">
      {TRACKS.map(({ key, label, Icon }) => {
        const st = statusOf(key);
        const active = st === "approved" && key === current;
        return (
          <button
            key={key} type="button" role="tab" aria-selected={active}
            className={[
              "trackSwitcher__seg", active ? "is-active" : "",
              st === "locked" ? "is-locked" : "", st === "pending" ? "is-pending" : "",
            ].join(" ").trim()}
            title={st === "pending" ? "In admin review" : st === "locked" ? `Apply to teach ${label}` : label}
            onClick={() => onClick({ key })}
          >
            {st === "locked" ? <RiLockLine className="trackSwitcher__lock" /> : <Icon size={13} />}
            <span>{label}</span>
            {st === "pending" && <span className="trackSwitcher__badge">review</span>}
          </button>
        );
      })}
    </div>
  );
}
