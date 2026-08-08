/**
 * src/components/Header.jsx
 *
 * The design's 60px header (Academy Dashboard.dc.html lines 598–636):
 *   left  — current page title (Montserrat 800 15px) over today's long date
 *   right — track switcher, messages, notification bell, avatar
 *
 * The title comes from the active nav label via pageTitleFor(), so every page
 * is identified in the header — previously it carried no title at all and page
 * identity came only from the breadcrumb strip.
 *
 * The design's Student/Teacher pill switcher is deliberately NOT reproduced:
 * it exists so one prototype file can demo both roles. Here the roles are two
 * separate apps behind separate logins, so that slot holds the real controls —
 * TrackSwitcher (Academy / Skill Dev / Counselling) and ProfileSwitcher.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { HiOutlineMenuAlt3 } from "react-icons/hi";
import { RiDashboardLine, RiBookOpenLine } from "react-icons/ri";
import ProfileSwitcher from "../shared/ProfileSwitcher";
import TrackSwitcher from "./TrackSwitcher";
import MessageIcon from "./MessageIcon";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../contexts/AuthContext";
import { pageTitleFor } from "../utils/academyNav";
import "../styles/header.css";
import "../shared/ProfileSwitcher.css";
import { HOME_URL, APP_URL } from "../config/urls";

// "Saturday, 25 July 2026" — en-GB, matching the design's date sub-line.
const DATE_FMT = { weekday: "long", day: "numeric", month: "long", year: "numeric" };

export default function Header({ onMenuClick, isExpertPage }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { teacherInfo } = useAuth();
  const isSkillActive = teacherInfo?.active_track === "skill";

  const title = isExpertPage ? "Skill Development" : pageTitleFor(pathname);
  const todayLong = new Date().toLocaleDateString("en-GB", DATE_FMT);

  return (
    <header className={`header${isExpertPage ? " header--expert" : ""}`}>
      <button className="hamburgerBtn" onClick={onMenuClick} type="button" aria-label="Open sidebar">
        <HiOutlineMenuAlt3 />
      </button>
      <div className="header__left">
        <h1 className="header__title">{title}</h1>
        <p className="header__subtitle">{todayLong}</p>
      </div>
      <div className="header__right">
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
            ? { label: "My skills", icon: <RiBookOpenLine />, onClick: () => navigate("/teacher/expert/skills") }
            : { label: "My classes", icon: <RiBookOpenLine />, onClick: () => navigate("/teacher/classes") },
        ]}
      />
      </div>
    </header>
  );
}
