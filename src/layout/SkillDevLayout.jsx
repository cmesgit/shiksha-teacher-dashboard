/**
 * PLACEMENT: src/layout/SkillDevLayout.jsx
 * ACTION:    Replace the entire file.
 *
 * Two changes from the original:
 *
 * 1) Messages nav fix (unchanged from prior edit): the Messages item points to
 *    "/teacher/expert/inbox" (the SkillInbox inside this layout) instead of the
 *    academy "/teacher/chat", so expert teachers never drop out of their layout.
 *
 * 2) NEW — profile-completeness gate. A guest expert's ExpertProfile starts
 *    incomplete (and therefore unlisted). This gate fetches the profile status
 *    once on mount and, until the profile is complete, redirects every expert
 *    page to the profile editor and shows a "finish your profile" banner. This
 *    is what stops a guest from "directly accessing" an empty dashboard.
 *
 *    The editor receives `refreshGate` through the Outlet context, so saving a
 *    now-complete profile lifts the gate without a page reload. If the status
 *    fetch fails (e.g. a faculty-only teacher who has no ExpertProfile and gets
 *    a 403), we treat the gate as satisfied to avoid a redirect loop.
 */
import { useEffect, useState, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { HiOutlineMenuAlt3 } from "react-icons/hi";
import Header from "../components/Header";
import { Icon } from "../components/SkillIcons";
import api from "../shared/apiClient";
import logo from "../assets/Shiksha.svg";
import { HOME_URL } from "../config/urls";
import "./layout.css";
import "../styles/skillDev.css";
import "../styles/skillSidebar.css";

const PROFILE_PATH = "/teacher/expert/profile";

const NAV = [
  { to: "/teacher/expert",              label: "My Dashboard", icon: <Icon.cap size={15} />,   end: true },

  { group: "Live 1-on-1" },
  { to: "/teacher/expert/bookings",     label: "Bookings",     icon: <Icon.cal size={15} /> },
  { to: "/teacher/expert/availability", label: "Availability", icon: <Icon.clock size={15} /> },
  { group: "Money" },
  { to: "/teacher/expert/earnings",     label: "Earnings",     icon: <Icon.shield size={15} /> },
  { other: true },
  // FIXED: was "/teacher/chat" which broke out of SkillDevLayout into TeacherLayout
  { to: "/teacher/expert/inbox",        label: "Messages",     icon: <Icon.msg size={15} /> },
];

export default function SkillDevLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Profile-completeness gate state ──
  const [gateLoading, setGateLoading] = useState(true);
  const [complete, setComplete]       = useState(true); // optimistic; corrected on load
  const [profile, setProfile]         = useState(null);

  // Apply a (possibly fresh) profile payload to the gate. Called on mount and
  // by the editor via Outlet context after a save.
  const applyStatus = useCallback((d) => {
    if (!d) return;
    setProfile(d);
    setComplete(!!d.is_complete);
  }, []);

  const refreshGate = useCallback((d) => {
    if (d && typeof d.is_complete !== "undefined") {
      applyStatus(d);
      return Promise.resolve(d);
    }
    // No payload passed — re-fetch.
    return api.get("/skill/teacher/profile/")
      .then((r) => { applyStatus(r.data); return r.data; })
      .catch(() => null);
  }, [applyStatus]);

  // Fetch the profile status once on mount.
  useEffect(() => {
    let alive = true;
    api.get("/skill/teacher/profile/")
      .then((r) => { if (alive) applyStatus(r.data); })
      .catch(() => { if (alive) setComplete(true); /* faculty-only / no expert profile → don't trap */ })
      .finally(() => { if (alive) setGateLoading(false); });
    return () => { alive = false; };
  }, [applyStatus]);

  // While incomplete, force the expert onto the profile editor.
  useEffect(() => {
    if (gateLoading) return;
    if (!complete && pathname !== PROFILE_PATH) {
      navigate(PROFILE_PATH, { replace: true });
    }
  }, [gateLoading, complete, pathname, navigate]);

  const isActive = (to, end) =>
    end ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const goTo = (to) => { navigate(to); setSidebarOpen(false); };

  return (
    <div className="teacher-layout">
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

        {/* Finish-your-profile banner — shown until the profile is complete. */}
        {!gateLoading && !complete && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#fbf4dd", borderBottom: "1px solid #ecdca4",
            color: "#8a6d1f", fontSize: 13, fontWeight: 600,
            padding: "10px 18px",
          }}>
            <Icon.user size={15} />
            <span>Complete your profile to get listed so learners can find and book you.</span>
            {pathname !== PROFILE_PATH && (
              <button
                onClick={() => navigate(PROFILE_PATH)}
                style={{
                  marginLeft: "auto", border: "none", cursor: "pointer",
                  background: "#c9a227", color: "#fff", fontWeight: 700,
                  fontSize: 12, borderRadius: 8, padding: "6px 12px",
                }}
              >
                Finish now
              </button>
            )}
          </div>
        )}

        <main className="teacher-content teacher-content--expert">
          <Outlet context={{ profile, refreshGate }} />
        </main>
      </div>
    </div>
  );
}
