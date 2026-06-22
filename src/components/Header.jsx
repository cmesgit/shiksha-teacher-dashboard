/**
 * teacher_dashboard/src/components/Header.jsx  (REDESIGNED)
 *
 * Colours per Auth Flow handoff doc:
 *   Faculty mode  → bg #c9d1de  (cool blue-grey — isExpertPage=false)
 *   Expert mode   → bg #f3e2da  (warm blush    — isExpertPage=true)
 * The .header--expert CSS class handles the switch.
 *
 * TrackSwitcher always uses ctx-teacher so both pills use #425f7f when active.
 */
import { useNavigate } from "react-router-dom";
import { HiOutlineMenuAlt3 } from "react-icons/hi";
import { useAuth } from "../contexts/AuthContext";
import ProfileSwitcher from "../shared/ProfileSwitcher";
import TrackSwitcher from "./TrackSwitcher";
import NotificationBell from "./NotificationBell";
import "../styles/header.css";
import "../shared/ProfileSwitcher.css";

import { HOME_URL, APP_URL } from "../config/urls";

export default function Header({ onMenuClick, isExpertPage }) {
  return (
    <header className={`header${isExpertPage ? " header--expert" : ""}`}>
      <button
        className="hamburgerBtn"
        onClick={onMenuClick}
        type="button"
        aria-label="Open sidebar"
      >
        <HiOutlineMenuAlt3 />
      </button>

      <div style={{ flex: 1 }} />

      {/* Academy ⟷ Skill Dev switch — always ctx-teacher on the teacher app */}
      <TrackSwitcher />

      <NotificationBell />

      <ProfileSwitcher
        teacherSignupUrl={`${HOME_URL}/signup?role=teacher`}
        learnUrl={APP_URL}
        teachUrl={window.location.origin + "/teacher/dashboard"}
      />
    </header>
  );
}
