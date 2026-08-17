/**
 * PLACEMENT: src/layout/SkillDevLayout.jsx
 * ACTION:    Replace the entire file.
 *
 * Change from original:
 *   The Messages nav item previously pointed to "/teacher/chat" — the
 *   academy chat page inside TeacherLayout. Expert teachers live entirely
 *   inside SkillDevLayout, so navigating there dropped them out of the
 *   Expert layout entirely and into the academy sidebar.
 *
 *   Fixed: Messages now points to "/teacher/expert/inbox", which is
 *   the SkillInbox page registered inside the SkillDevLayout route tree.
 *   Expert teachers stay inside their own layout at all times.
 */
import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { HiOutlineMenuAlt3 } from "react-icons/hi";
import Header from "../components/Header";
import Breadcrumbs from "../components/Breadcrumbs";
import { Icon } from "../components/SkillIcons";
import logo from "../assets/Shiksha.svg";
import { HOME_URL } from "../config/urls";
import { SkillToastProvider } from "../components/SkillToast";
import "./layout.css";
import "../styles/skillDev.css";
import "../styles/skillSidebar.css";

// Matches design_handoff_skilldev's own flat nav order exactly: Dashboard,
// Bookings, Students, Availability, My skills, Profile, Inbox, Promote.
// The prior "My Profile" merged item (profile+availability combined) has
// been split back apart — Availability and Profile were always separately
// routed pages underneath it; My skills is new (see ExpertSkills.jsx).
const NAV = [
  { to: "/teacher/expert",              label: "Dashboard",     icon: <Icon.cap size={15} />,   end: true },

  { group: "Live 1-on-1" },
  { to: "/teacher/expert/bookings",     label: "Bookings",      icon: <Icon.cal size={15} /> },
  { to: "/teacher/expert/students",     label: "Students",      icon: <Icon.users size={15} /> },
  { to: "/teacher/expert/availability", label: "Availability",  icon: <Icon.clock size={15} /> },
  { to: "/teacher/expert/skills",       label: "My skills",     icon: <Icon.spark size={15} /> },
  { to: "/teacher/expert/profile",      label: "Profile",       icon: <Icon.user size={15} /> },
  // Earnings + Courses scrapped for launch — booking is free (toggled globally
  // from admin via GlobalSettings), so there is no earnings bar or rate UI.
  { other: true },
  { to: "/teacher/expert/inbox",        label: "Messages",      icon: <Icon.msg size={15} /> },
  { to: "/teacher/expert/promote",      label: "Promote",       icon: <Icon.award size={15} /> },
];

export default function SkillDevLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (to, end) =>
    end ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const goTo = (to) => { navigate(to); setSidebarOpen(false); };

  return (
    <div className="teacher-layout" data-track="skill">
      {/* Expert sidebar */}
      <aside className={`sk-side${sidebarOpen ? " sk-side--open" : ""}`}>
        <div className="sk-side__top">
          <div className="sk-side__brand">
            <img src={logo} alt="ShikshaCom" />
            <div>
              <h3>ShikshaCom</h3>
              <p>Expert Teacher</p>
            </div>
          </div>
          <button className="sk-side__close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <IoClose />
          </button>
        </div>

        <nav className="sk-side__nav">
          {NAV.map((item, i) => {
            if (item.group) return <div key={`g${i}`} className="sk-navgroup">{item.group}</div>;
            if (item.other) return <div key={`o${i}`} className="sk-navspacer" />;
            const active = isActive(item.to, item.end);
            return (
              <button
                key={item.to}
                className={`sk-link${active ? " active" : ""}`}
                onClick={() => goTo(item.to)}
                data-tour={`sidebar-skill.nav-${item.to.replace(/^\/+/, "").replace(/\//g, "-")}`}
              >
                <span className="sk-link__i">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <a href={HOME_URL} className="sk-side__home">
          <Icon.back size={13} /> Return to Homepage
        </a>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="teacher-main">
        <Header onMenuClick={() => setSidebarOpen(true)} isExpertPage />
        <main className="teacher-content teacher-content--expert page-fade" key={pathname}>
          <Breadcrumbs />
          <SkillToastProvider>
            <Outlet />
          </SkillToastProvider>
        </main>
      </div>
    </div>
  );
}
