// src/components/TrackSwitcher.jsx  (teacher dashboard — full implementation)
// ──────────────────────────────────────────────────────────────────────────
// Academy ⟷ Skill Dev toggle for the teacher header.
//
// Behaviour:
//  • Pure GUEST   → always on Skill Dev; toggle shows but Academy is locked
//    (links to the homepage to buy an academy subscription)
//  • TYPE_BOTH    → can switch freely; navigates between the two routes
//  • Pure faculty → always on Academy; Skill Dev is locked
//    (links to the homepage expert application)
//
// Active route decides the highlighted pill:
//   /teacher/expert* → Skill Dev active
//   anything else    → Academy active
// ──────────────────────────────────────────────────────────────────────────

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { RiGraduationCapFill, RiSparkling2Fill, RiLockLine } from "react-icons/ri";
import { HOME_URL } from "../config/urls";
import "../styles/trackSwitcher.css";

const TRACKS = [
  { key: "academy", label: "Academy",   Icon: RiGraduationCapFill, route: "/teacher/dashboard" },
  { key: "skill",   label: "Skill Dev", Icon: RiSparkling2Fill,    route: "/teacher/expert"    },
];

export default function TrackSwitcher() {
  const navigate   = useNavigate();
  const { pathname } = useLocation();
  const { teacherInfo } = useAuth();

  const isGuest  = teacherInfo?.type === "GUEST";
  const isBoth   = teacherInfo?.type === "BOTH";
  const isFaculty = !isGuest && !isBoth;

  // Which pill is active based on the current URL
  const current = pathname.startsWith("/teacher/expert") ? "skill" : "academy";

  const canAccess = (key) => {
    if (isGuest)    return key === "skill";
    if (isFaculty)  return key === "academy";
    return true; // BOTH can access both
  };

  const handleClick = (track) => {
    if (!canAccess(track.key)) {
      // Locked — send them to the homepage to upgrade/apply
      if (track.key === "academy") window.location.href = `${HOME_URL}?ref=upgrade-academy`;
      else                         window.location.href = `${HOME_URL}/expert-apply`;
      return;
    }
    if (track.key === current) return; // already here
    navigate(track.route);
  };

  // Accent class mirrors the student switcher: ctx-skill on Skill Dev active
  const ctx = current === "skill" ? "ctx-skill" : "";

  return (
    <div className={`trackSwitcher ${ctx}`} role="tablist" aria-label="Learning track">
      {TRACKS.map(({ key, label, Icon, route }) => {
        const accessible = canAccess(key);
        const active     = key === current;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            className={[
              "trackSwitcher__seg",
              active       ? "is-active" : "",
              !accessible  ? "is-locked" : "",
            ].join(" ").trim()}
            title={accessible ? label : `Not available on your current plan`}
            onClick={() => handleClick({ key, route })}
          >
            {!accessible ? <RiLockLine className="trackSwitcher__lock" /> : <Icon size={13} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
