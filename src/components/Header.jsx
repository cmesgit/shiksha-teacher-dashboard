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
import MessagesPopover from "../shared/MessagesPopover";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../contexts/AuthContext";
import { pageTitleFor } from "../utils/academyNav";
import "../styles/header.css";
import "../shared/ProfileSwitcher.css";
import "../shared/ChatPanel.css";
import "../shared/MessagesPopover.css";
import { HOME_URL, APP_URL } from "../config/urls";

// "Saturday, 25 July 2026" — en-GB, matching the design's date sub-line.
const DATE_FMT = { weekday: "long", day: "numeric", month: "long", year: "numeric" };

export default function Header({ onMenuClick, isExpertPage, titleOverride }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { teacherInfo, hasRole } = useAuth();
  const isSkillActive = teacherInfo?.active_track === "skill";

  // A PURE counsellor — COUNSELOR role and no teacher identity at all — now
  // reaches this header, because /teacher/counsellor is gated on
  // ProtectedCounsellorRoute rather than ProtectedTeacherRoute. Everything
  // else under /teacher still sits behind the teacher gate, so the controls
  // below would hand them links that bounce straight to the profile picker.
  //
  // Scoped narrowly on purpose: `teacherInfo` is non-null for ANY account with
  // a teacher identity, including a counsellor who also teaches, so every
  // existing user keeps exactly today's header.
  const pureCounsellor = hasRole("COUNSELOR") && !teacherInfo;

  const title = titleOverride || (isExpertPage ? "Skill Development" : pageTitleFor(pathname));
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
      {/* Every destination this popover can navigate to is a /teacher route
          behind the teacher gate — `viewAllHref` is its ONLY navigation — so
          for a pure counsellor it is a control that cannot work. Hidden
          rather than pointed somewhere unrelated: counselling has no messages
          surface, and sending "View all messages" to notifications would be a
          different thing wearing the same label. */}
      {!pureCounsellor && (
        <MessagesPopover viewAllHref={isSkillActive ? "/teacher/expert/inbox" : "/teacher/chat"} />
      )}
      <NotificationBell />
      <ProfileSwitcher
        compact
        teacherSignupUrl={`${HOME_URL}/signup?role=teacher`}
        learnUrl={APP_URL}
        teachUrl={window.location.origin + (pureCounsellor ? "/teacher/counsellor" : "/teacher/dashboard")}
        quickActions={pureCounsellor ? [
          { label: "Counselling", icon: <RiDashboardLine />, onClick: () => navigate("/teacher/counsellor") },
          { label: "Requests", icon: <RiBookOpenLine />, onClick: () => navigate("/teacher/counsellor/requests") },
        ] : [
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
