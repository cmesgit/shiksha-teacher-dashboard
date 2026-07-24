/**
 * src/components/Header.jsx
 * Faculty mode → bg #c9d1de · Expert mode → bg #f3e2da (.header--expert).
 * TrackSwitcher always ctx-teacher (both pills slate #425f7f when active).
 */
import { useNavigate } from "react-router-dom";
import { HiOutlineMenuAlt3 } from "react-icons/hi";
import { RiDashboardLine, RiBookOpenLine } from "react-icons/ri";
import ProfileSwitcher from "../shared/ProfileSwitcher";
import TrackSwitcher from "./TrackSwitcher";
import MessageIcon from "./MessageIcon";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../contexts/AuthContext";
import "../styles/header.css";
import "../shared/ProfileSwitcher.css";
import { HOME_URL, APP_URL } from "../config/urls";

export default function Header({ onMenuClick, isExpertPage }) {
  const navigate = useNavigate();
  const { teacherInfo } = useAuth();
  const isSkillActive = teacherInfo?.active_track === "skill";
  return (
    <header className={`header${isExpertPage ? " header--expert" : ""}`}>
      <button className="hamburgerBtn" onClick={onMenuClick} type="button" aria-label="Open sidebar">
        <HiOutlineMenuAlt3 />
      </button>
      <div style={{ flex: 1 }} />
      <TrackSwitcher />
      <MessageIcon to={isSkillActive ? "/teacher/expert/inbox" : "/teacher/chat"} />
      <NotificationBell />
      <ProfileSwitcher
        teacherSignupUrl={`${HOME_URL}/signup?role=teacher`}
        learnUrl={APP_URL}
        teachUrl={window.location.origin + "/teacher/dashboard"}
        quickActions={[
          { label: "Dashboard", icon: <RiDashboardLine />, onClick: () => navigate(isSkillActive ? "/teacher/expert" : "/teacher/dashboard") },
          isSkillActive
            ? { label: "My course", icon: <RiBookOpenLine />, onClick: () => navigate("/teacher/expert/course") }
            : { label: "My classes", icon: <RiBookOpenLine />, onClick: () => navigate("/teacher/classes") },
        ]}
      />
    </header>
  );
}
