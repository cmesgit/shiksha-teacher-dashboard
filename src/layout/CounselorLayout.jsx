// PLACEMENT: src/layout/CounselorLayout.jsx   (NEW FILE — teacher dashboard app)
//
// The Counselling track's layout — mirrors SkillDevLayout (own sidebar,
// same Header) mounted at /teacher/counsellor/*. It is also the
// ONBOARDING GATE, driven by GET /counseling/counselor/me/:
//
//   404          → apply screen (any signed-in teacher can apply)
//   pending      → "under review" status screen
//   rejected     → status screen with the admin's note + re-apply hint
//   suspended    → status screen (console blocked, backend enforces too)
//   approved     → the real console (Outlet)
//
// The backend's IsApprovedCounselor permission enforces all of this
// server-side; the gate just gives each state a proper screen.

import React, { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import Header from "../components/Header";
import logo from "../assets/Shiksha.svg";
import { HOME_URL } from "../config/urls";
import { getMe } from "../api/counselorService";
import CounselorApply from "../pages/counsellor/CounselorApply";
import "./layout.css";
import "../styles/skillSidebar.css";
import "../styles/counsellor.css";

const NAV = [
  { to: "/teacher/counsellor", label: "Schedule", end: true, icon: "🗓" },
  { to: "/teacher/counsellor/availability", label: "Availability", icon: "⏰" },
  { to: "/teacher/counsellor/profile", label: "My Profile", icon: "👤" },
];

const CounselorCtx = createContext(null);
export const useCounselor = () => useContext(CounselorCtx);

export default function CounselorLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [me, setMe] = useState(undefined);      // undefined=loading, null=no profile

  const refresh = () =>
    getMe().then(setMe).catch((e) => {
      if (e?.response?.status === 404) setMe(null);
      else setMe({ error: true });
    });
  useEffect(() => { refresh(); }, []);

  const isActive = (to, end) =>
    end ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const shell = (content, showNav) => (
    <div className="teacher-layout">
      <aside className={`sk-side${sidebarOpen ? " sk-side--open" : ""}`}>
        <div className="sk-side__top">
          <div className="sk-side__brand">
            <img src={logo} alt="ShikshaCom" />
            <div>
              <h3>ShikshaCom</h3>
              <p>Career Counsellor</p>
            </div>
          </div>
          <button className="sk-side__close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <IoClose />
          </button>
        </div>

        {showNav && (
          <nav className="sk-side__nav">
            {NAV.map((item) => (
              <button
                key={item.to}
                className={`sk-link${isActive(item.to, item.end) ? " active" : ""}`}
                onClick={() => { navigate(item.to); setSidebarOpen(false); }}
              >
                <span className="sk-link__i">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <a href={HOME_URL} className="sk-side__home">← Return to Homepage</a>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="teacher-main">
        <Header onMenuClick={() => setSidebarOpen(true)} isExpertPage />
        <main className="teacher-content teacher-content--expert">{content}</main>
      </div>
    </div>
  );

  if (me === undefined) return shell(<div className="co-skel" style={{ height: 220 }} />, false);
  if (me && me.error) return shell(<div className="co-error">Couldn't load your counsellor profile — please refresh.</div>, false);

  // no profile yet → apply
  if (me === null) return shell(<CounselorApply onApplied={refresh} />, false);

  // pending / rejected / suspended → status screen
  if (me.status !== "approved") return shell(<StatusScreen me={me} onReload={refresh} />, false);

  // approved → the console, with the profile in context for child pages
  return shell(
    <CounselorCtx.Provider value={{ me, refreshMe: refresh }}>
      <Outlet />
    </CounselorCtx.Provider>,
    true
  );
}

function StatusScreen({ me, onReload }) {
  const META = {
    pending: ["#b45309", "#fef3c7", "Application under review",
      "Our team is reviewing your counsellor profile. You'll get a notification and an email the moment it's decided — usually within a few days."],
    rejected: ["#b91c1c", "#fee2e2", "Application not approved",
      "Your application wasn't approved this time. You can update your profile details below and our team can take another look — or contact support for details."],
    suspended: ["#b91c1c", "#fee2e2", "Profile suspended",
      "Your counsellor profile is currently suspended and hidden from the directory. Contact the ShikshaCom team to resolve this."],
  };
  const [color, bg, title, body] = META[me.status] || META.pending;
  return (
    <div className="co-gate">
      <div className="co-card" style={{ textAlign: "center" }}>
        <span className="co-badge-status" style={{ color, background: bg }}>{me.status}</span>
        <h2 className="co-title" style={{ margin: "14px 0 8px" }}>{title}</h2>
        <p className="co-sub" style={{ maxWidth: 440, margin: "0 auto 6px" }}>{body}</p>
        {me.review_note && (
          <p className="co-sub" style={{ fontStyle: "italic" }}>Reviewer note: "{me.review_note}"</p>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="co-btn co-btn--outline" onClick={onReload}>Check again</button>
        </div>
      </div>
    </div>
  );
}
