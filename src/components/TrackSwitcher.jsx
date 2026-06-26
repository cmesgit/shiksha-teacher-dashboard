// src/components/TrackSwitcher.jsx  (teacher dashboard — full implementation)
// ──────────────────────────────────────────────────────────────────────────
// Academy ⟷ Skill Dev toggle for the teacher header.
//
// Behaviour:
//  • Pure GUEST   → always on Skill Dev; toggle shows but Academy is locked
//  • TYPE_BOTH    → can switch freely; navigates between the two routes
//  • Pure faculty → always on Academy; Skill Dev is locked
//
// Active route decides the highlighted pill:
//   /teacher/expert* → Skill Dev active
//   anything else    → Academy active
//
// NOTE: teacher context uses ctx-teacher so BOTH active pills render slate
// (#425f7f), matching the Auth Flow handoff doc's teacher palette.
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
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { teacherInfo } = useAuth();

  const isGuest   = teacherInfo?.type === "GUEST";
  const isBoth    = teacherInfo?.type === "BOTH";
  const isFaculty = !isGuest && !isBoth;

  const current = pathname.startsWith("/teacher/expert") ? "skill" : "academy";

  const canAccess = (key) => {
    if (isGuest)   return key === "skill";
    if (isFaculty) return key === "academy";
    return true; // BOTH can access both
  };

  const handleClick = (track) => {
    if (!canAccess(track.key)) {
      // A guest hasn't added the Faculty track yet — send them to the Faculty
      // intro page (on the marketing domain), which explains the track and
      // routes into the add-a-track application.
      if (track.key === "academy") window.location.href = `${HOME_URL}/become-faculty`;
      else                         window.location.href = `${HOME_URL}/expert-apply`;
      return;
    }
    if (track.key === current) return;
    navigate(track.route);
  };

  return (
    <div className="trackSwitcher ctx-teacher" role="tablist" aria-label="Learning track">
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
              active      ? "is-active" : "",
              !accessible ? "is-locked" : "",
            ].join(" ").trim()}
            title={accessible ? label : "Not available on your current plan"}
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
