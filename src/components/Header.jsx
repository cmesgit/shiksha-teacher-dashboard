/**
 * teacher_dashboard/src/components/Header.jsx  (REDESIGNED)
 *
 * Dark forest-green header (#041f09 → #0b2e12 gradient) matching the
 * Auth Flow student-side design. Right-aligns:
 *   TrackSwitcher · [divider] · NotificationBell · ProfileSwitcher
 */
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineMenuAlt3 } from "react-icons/hi";
import { useAuth } from "../contexts/AuthContext";
import ProfileSwitcher from "../shared/ProfileSwitcher";
import TrackSwitcher from "./TrackSwitcher";
import NotificationBell from "./NotificationBell";
import "../styles/header.css";
import "../shared/ProfileSwitcher.css";

import { HOME_URL, APP_URL } from "../config/urls";

export default function Header({ onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="header">
      {/* Hamburger — mobile only, shown via CSS */}
      <button
        className="hamburgerBtn"
        onClick={onMenuClick}
        type="button"
        aria-label="Open sidebar"
      >
        <HiOutlineMenuAlt3 />
      </button>

      {/* Push everything to the right on desktop */}
      <div style={{ flex: 1 }} />

      {/* Academy ⟷ Skill Dev switch */}
      <TrackSwitcher />

      {/* Visual divider */}
      <div className="header__spacer" aria-hidden="true" />

      <NotificationBell />

      {/* ProfileSwitcher avatar */}
      <ProfileSwitcher
        teacherSignupUrl={`${HOME_URL}/signup?role=teacher`}
        learnUrl={APP_URL}
        teachUrl={window.location.origin + "/teacher/dashboard"}
      />
    </header>
  );
}
