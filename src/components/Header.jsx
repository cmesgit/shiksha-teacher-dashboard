/**
 * teacher_dashboard/src/components/Header.jsx  (FULL REPLACEMENT)
 *
 * Adds ProfileSwitcher so teachers can:
 *   - Switch to their learner profile (go to student dashboard)
 *   - See their teacher identity
 * Removes the old localStorage-based avatar logic.
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
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="header">
      <button className="hamburgerBtn" onClick={onMenuClick} type="button" aria-label="Open sidebar">
        <HiOutlineMenuAlt3 />
      </button>

      <div style={{ flex: 1 }} />

      {/* Academy ⟷ Skill-dev switch (locked tracks deep-link to signup) */}
      <TrackSwitcher />

      <NotificationBell />

      {/* ProfileSwitcher replaces the old profile image + dropdown */}
      <ProfileSwitcher
        teacherSignupUrl={`${HOME_URL}/signup?role=teacher`}
        learnUrl={APP_URL}
        teachUrl={window.location.origin + "/teacher/dashboard"}
      />
    </header>
  );
}
