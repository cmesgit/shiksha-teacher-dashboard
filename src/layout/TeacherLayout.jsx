import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import TeacherTopSliderTabs from "../components/TeacherTopSliderTabs";
import useSwipeBack from "../utils/useSwipeBack";
import { useAuth } from "../contexts/AuthContext";
import "./layout.css";

export default function TeacherLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState("sessions");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const location = useLocation();
  const navigate = useNavigate();
  const swipeHandlers = useSwipeBack();
  const { teacherInfo } = useAuth();

  // Show the switch banner only for TYPE_BOTH users
  const isBoth = teacherInfo?.type === "BOTH";

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Hide sidebar + header + top tabs in live session view
  const isLiveSession = location.pathname.startsWith("/live/");

  const isClassesPage = location.pathname.startsWith("/teacher/classes");
  const hideTopSliderOnMobile = isMobile && isClassesPage;

  // The guest-expert dashboard has its own tab bar, so suppress the faculty
  // top-slider tabs on that route.
  const isExpertPage = location.pathname.startsWith("/teacher/expert");

  // ───── LIVE SESSION FULLSCREEN MODE ─────
  if (isLiveSession) {
    return (
      <div className="teacher-layout teacher-layout--live">
        <div className="teacher-content teacher-content--live">
          <Outlet context={{ active, setActive }} />
        </div>
      </div>
    );
  }

  // ───── NORMAL LAYOUT ─────
  return (
    <div className="teacher-layout">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="teacher-main">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* ── Dashboard switch banner — only shown to TYPE_BOTH teachers ── */}
        {isBoth && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderBottom: "1px solid #e5e7eb",
            background: "#f9fafb", fontSize: 13,
          }}>
            <span style={{ color: "#6b7280", marginRight: 4 }}>Switch dashboard:</span>
            <button
              onClick={() => navigate("/teacher/dashboard")}
              style={{
                padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "1.5px solid",
                cursor: "pointer",
                background: isExpertPage ? "transparent" : "#125027",
                color:      isExpertPage ? "#125027"     : "#fff",
                borderColor: "#125027",
                transition: ".15s",
              }}
            >
              📚 Faculty (Academic)
            </button>
            <button
              onClick={() => navigate("/teacher/expert")}
              style={{
                padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "1.5px solid",
                cursor: "pointer",
                background: isExpertPage ? "#125027"     : "transparent",
                color:      isExpertPage ? "#fff"        : "#125027",
                borderColor: "#125027",
                transition: ".15s",
              }}
            >
              🎯 Skills (Expert)
            </button>
          </div>
        )}

        {!hideTopSliderOnMobile && !isExpertPage && (
          <TeacherTopSliderTabs
            active={active}
            setActive={setActive}
          />
        )}

        <main className="teacher-content" {...swipeHandlers}>
          <Outlet context={{ active, setActive }} />
        </main>
      </div>
    </div>
  );
}
