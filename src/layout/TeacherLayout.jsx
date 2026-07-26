/**
 * src/layout/TeacherLayout.jsx  ·  ACADEMY / FACULTY layout
 * Skill Dev now has its own SkillDevLayout, so this layout is always the
 * Academy (maroon --side-bg #5c1515 sidebar, --page-bg body). No expert
 * branching needed.
 */
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Breadcrumbs from "../components/Breadcrumbs";
import TeacherTopSliderTabs from "../components/TeacherTopSliderTabs";
import { TeacherClassesProvider } from "../contexts/TeacherClassesContext";
import useSwipeBack from "../utils/useSwipeBack";
import "./layout.css";

export default function TeacherLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState("sessions");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const location = useLocation();
  const swipeHandlers = useSwipeBack();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isLiveSession = location.pathname.startsWith("/live/");
  const isClassesPage = location.pathname.startsWith("/teacher/classes");
  const hideTopSliderOnMobile = isMobile && isClassesPage;

  if (isLiveSession) {
    return (
      <div className="teacher-layout teacher-layout--live" data-track="academy">
        <div className="teacher-content teacher-content--live">
          <Outlet context={{ active, setActive }} />
        </div>
      </div>
    );
  }

  return (
    // The teacher's subject list is needed by the sidebar, the flattened
    // CONTENT screens' subject pills, and several dialogs — fetched once here.
    <TeacherClassesProvider>
      <div className="teacher-layout" data-track="academy">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <div className="teacher-main">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          {!hideTopSliderOnMobile && (
            <TeacherTopSliderTabs active={active} setActive={setActive} />
          )}
          <main className="teacher-content" {...swipeHandlers}>
            <Breadcrumbs />
            <Outlet context={{ active, setActive }} />
          </main>
        </div>
      </div>
    </TeacherClassesProvider>
  );
}
