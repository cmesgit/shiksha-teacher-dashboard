import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import TeacherTopSliderTabs from "../components/TeacherTopSliderTabs";
import useSwipeBack from "../utils/useSwipeBack";
import "./layout.css";

export default function TeacherLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState("sessions");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const location = useLocation();
  const swipeHandlers = useSwipeBack();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isLiveSession  = location.pathname.startsWith("/live/");
  const isClassesPage  = location.pathname.startsWith("/teacher/classes");
  const hideTopSliderOnMobile = isMobile && isClassesPage;

  // Expert / Skill Dev route — drives sidebar + body bg colour change
  const isExpertPage = location.pathname.startsWith("/teacher/expert");

  // ── LIVE SESSION FULLSCREEN ──────────────────────────────
  if (isLiveSession) {
    return (
      <div className="teacher-layout teacher-layout--live">
        <div className="teacher-content teacher-content--live">
          <Outlet context={{ active, setActive }} />
        </div>
      </div>
    );
  }

  // ── NORMAL LAYOUT ────────────────────────────────────────
  return (
    <div className="teacher-layout">
      {/* Sidebar: --expert modifier switches bg from #425f7f → #b3402e */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isExpertPage={isExpertPage}
      />

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="teacher-main">
        {/* Header: --expert modifier switches bg from #c9d1de → #f3e2da */}
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          isExpertPage={isExpertPage}
        />

        {/* Top slider tabs: only on faculty routes (not expert, not classes-mobile) */}
        {!hideTopSliderOnMobile && !isExpertPage && (
          <TeacherTopSliderTabs active={active} setActive={setActive} />
        )}

        {/* Content area: --expert modifier switches bg from #c9d1de → #f3e2da */}
        <main
          className={`teacher-content${isExpertPage ? " teacher-content--expert" : ""}`}
          {...swipeHandlers}
        >
          <Outlet context={{ active, setActive }} />
        </main>
      </div>
    </div>
  );
}
