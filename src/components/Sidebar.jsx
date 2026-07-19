/**
 * src/components/Sidebar.jsx  ·  ACADEMY / FACULTY sidebar
 *
 * Rebuilt to match the approved Academy Dashboard.html mockup:
 *   slate #425f7f chrome · brand header · sectioned nav
 *   (TEACH / CONTENT / LIVE / CONNECT) · user footer.
 *
 * Skill Dev keeps its OWN nav in SkillDevLayout — this sidebar only ever
 * renders the academy nav. Every item routes to a live page (no dead links);
 * the CONTENT items land on class-picker pages that fan out to the existing
 * per-class screens.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { FiHome } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import NavIcon from "./NavIcon";
import { HOME_URL } from "../config/urls";
import "../styles/academySidebar.css";

const NAV = [
  { section: "TEACH" },
  { l: "Dashboard", i: "home", to: "/teacher/dashboard" },
  { l: "Classes", i: "layers", to: "/teacher/classes" },
  { l: "Students", i: "users", to: "/teacher/students" },
  { l: "Batch Progress", i: "chart", to: "/teacher/batch-progress" },
  { section: "CONTENT" },
  { l: "Assignments", i: "file", to: "/teacher/assignments" },
  { l: "Quizzes", i: "help", to: "/teacher/quiz-bank" },
  { l: "Study Materials", i: "clip", to: "/teacher/study-materials" },
  { section: "LIVE" },
  { l: "Live Sessions", i: "video", to: "/teacher/live-sessions" },
  { l: "Private Sessions", i: "lock", to: "/teacher/private-sessions" },
  { l: "Group Sessions", i: "grad", to: "/teacher/group-sessions" },
  { l: "Recordings", i: "play", to: "/teacher/recordings" },
  { section: "CONNECT" },
  { l: "Messages", i: "msg", to: "/teacher/chat" },
  { l: "My Profile", i: "user", to: "/teacher/profile" },
];

const initialsOf = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "T";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const userName =
    user?.name || user?.full_name || user?.username ||
    (user?.email ? user.email.split("@")[0] : "") || "Teacher";
  const userInitials = initialsOf(userName);

  const isActive = (to) =>
    to === "/teacher/dashboard"
      ? location.pathname === to
      : location.pathname.startsWith(to);

  const go = (to) => { navigate(to); setSidebarOpen(false); };

  return (
    <aside
      className={`acad-side${sidebarOpen ? " acad-side--open" : ""}`}
      style={{
        width: 240, flexShrink: 0, background: "#425f7f",
        display: "flex", flexDirection: "column", height: "100%",
        fontFamily: '"Poppins", system-ui, sans-serif',
      }}
    >
      {/* Brand */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(255,255,255,.12)", border: "2px solid rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontFamily: '"Montserrat", sans-serif', fontWeight: 800, fontSize: 14, letterSpacing: "-.3px", lineHeight: 1.15 }}>ShikshaCom</div>
          <div style={{ color: "rgba(255,255,255,.55)", fontSize: 8.5, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", marginTop: 2 }}>Academy</div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          style={{ display: "none", background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 20 }}
          className="sidebar-close-btn"
        >
          <IoClose />
        </button>
      </div>

      {/* Track context chip */}
      <div style={{ padding: "12px 10px 4px" }}>
        <div style={{ background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10, padding: "9px 11px" }}>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: 8.5, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase" }}>Faculty Portal</div>
          <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginTop: 1 }}>Academy Track</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "6px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV.map((item, idx) => {
          if (item.section) {
            return (
              <div key={`s-${idx}`} style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.32)", letterSpacing: ".9px", textTransform: "uppercase", padding: "13px 8px 5px" }}>
                {item.section}
              </div>
            );
          }
          const active = isActive(item.to);
          return (
            <button
              key={item.l}
              type="button"
              onClick={() => go(item.to)}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,.1)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%",
                textAlign: "left", padding: "9px 10px", fontSize: 12.5, border: "none",
                cursor: "pointer", borderRadius: 8, marginBottom: 1, transition: "background .15s",
                background: active ? "rgba(255,255,255,.16)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,.62)",
                fontWeight: active ? 700 : 500,
                fontFamily: '"Poppins", system-ui, sans-serif',
              }}
            >
              <NavIcon name={item.i} size={14} />
              {item.l}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#13899b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{userInitials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName}</div>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10 }}>Teacher</div>
        </div>
      </div>

      {/* Return to homepage */}
      <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,.12)" }}>
        <a href={HOME_URL} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,.42)", fontSize: 11.5, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)" }}>
          <FiHome size={13} /> Return to Homepage
        </a>
      </div>
    </aside>
  );
}
