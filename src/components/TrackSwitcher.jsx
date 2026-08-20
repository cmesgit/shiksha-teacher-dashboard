// src/components/TrackSwitcher.jsx  (teacher dashboard — full implementation)
// ──────────────────────────────────────────────────────────────────────────
// Academy ⟷ Skill Dev toggle for the teacher header.
//
// Behaviour:
//  • Access is gated on the REAL per-track approval status
//    (teacherInfo.tracks.{academy,skill} === "approved"), not the legacy
//    `teacherInfo.type` (GUEST/FACULTY/BOTH) field, which goes stale once a
//    teacher's approval changes after their initial track was set.
//  • Only an "approved" track is switchable; locked/pending/rejected tracks
//    render as locked pills with status-specific messaging.
//
// Active route decides the highlighted pill:
//   /teacher/expert* → Skill Dev active
//   anything else    → Academy active
//
// NOTE: teacher context uses ctx-teacher so BOTH active pills render slate
// (#425f7f), matching the Auth Flow handoff doc's teacher palette.
// ──────────────────────────────────────────────────────────────────────────

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { RiGraduationCapFill, RiSparkling2Fill, RiLockLine, RiUserHeartLine } from "react-icons/ri";
import { HOME_URL } from "../config/urls";
import "../styles/trackSwitcher.css";

// Per-track locked-state copy, keyed by the real `teacherInfo.tracks.<key>`
// status (locked | pending | approved | rejected) — see serialize_teacher()
// in shiksha-backend/accounts/auth_flow.py. NOT `teacherInfo.type`, which is
// a legacy display field that isn't kept in sync with real approval status
// (a teacher approved for Academy after starting as a GUEST would otherwise
// stay locked out forever — see TeacherDashboard.jsx's AcademyGate for the
// in-app rendering of these same states).
const LOCK_COPY = {
  locked:   "Not added yet — tap to apply",
  pending:  "Application under review",
  rejected: "Application wasn't approved — tap for details",
};

const TRACKS = [
  { key: "academy", label: "Academy",   Icon: RiGraduationCapFill, route: "/teacher/dashboard" },
  { key: "skill",   label: "Skill Dev", Icon: RiSparkling2Fill,    route: "/teacher/expert"    },
];

// Counselling only ever appears for accounts holding the COUNSELOR role —
// regular teachers never see a locked pill they can't use. The apply form
// itself lives at /teacher/counsellor for whenever the programme is
// announced; it isn't reachable through this switcher until approved.
const COUNSELLOR_TRACK = {
  key: "counsellor", label: "Counselling", Icon: RiUserHeartLine, route: "/teacher/counsellor",
};

export default function TrackSwitcher() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { teacherInfo, hasRole, switchTrack } = useAuth();

  // Real per-track approval status (see serialize_teacher() on the backend).
  // `type` (GUEST/FACULTY/BOTH) is a legacy display field only — it's not
  // kept in sync with actual approval, so it must never gate access.
  const academyStatus = teacherInfo?.tracks?.academy ?? "locked";
  const skillStatus   = teacherInfo?.tracks?.skill   ?? "locked";

  const showCounsellor = hasRole("COUNSELOR");
  const TRACKS_WITH_COUNSELLOR = showCounsellor ? [...TRACKS, COUNSELLOR_TRACK] : TRACKS;

  const current = pathname.startsWith("/teacher/counsellor") ? "counsellor"
                : pathname.startsWith("/teacher/expert")     ? "skill"
                : "academy";

  const canAccess = (key) => {
    if (key === "counsellor") return showCounsellor;
    if (key === "academy")    return academyStatus === "approved";
    if (key === "skill")      return skillStatus === "approved";
    return false;
  };

  const handleClick = (track) => {
    if (!canAccess(track.key)) {
      // Counselling pill is never rendered when inaccessible (see
      // TRACKS_WITH_COUNSELLOR above), so this branch is unreachable for it.
      if (track.key === "academy") {
        // Navigate in-app instead of silently bouncing to the marketing
        // domain: TeacherDashboard's AcademyGate already renders the real
        // locked/pending/rejected state with an explicit, visible CTA
        // (including the /become-faculty link when nothing's been applied
        // for yet), so the teacher always sees *why* they can't switch.
        navigate("/teacher/dashboard");
        return;
      }
      // Skill Dev has no in-app gate page yet. A "locked"/"rejected" teacher
      // hasn't applied (or needs to re-apply) — send them to the apply flow.
      // A "pending" teacher already applied; redirecting them into another
      // application is confusing, so surface that in-app instead.
      if (skillStatus === "pending") {
        window.alert("Your Skill Dev application is still under review.");
        return;
      }
      window.location.href = `${HOME_URL}/expert-apply`;
      return;
    }
    if (track.key === current) return;

    // Tell the SERVER, not just the router.
    //
    // This used to be `navigate(track.route)` alone, which left
    // teacherInfo.active_track pointing at the old track. Everything that
    // reads that field then disagreed with the URL: inside the Skill Dev
    // layout the header's message icon and quick actions pointed at Academy
    // routes, the breadcrumb chip read "Faculty · Academy", and the profile
    // switcher showed the wrong track's label and accent. That is precisely
    // "track A's chrome around track B's data".
    //
    // Navigate FIRST so the switch feels instant — the route is the real
    // source of truth for which layout mounts — then reconcile the server in
    // the background. A failure here is non-fatal: the UI is already correct,
    // only the persisted preference lags, so it must not block or throw.
    navigate(track.route);
    Promise.resolve(switchTrack(track.key)).catch(() => {
      /* preference only; the route already switched the UI */
    });
  };

  return (
    <div className="trackSwitcher ctx-teacher" role="tablist" aria-label="Learning track">
      {TRACKS_WITH_COUNSELLOR.map(({ key, label, Icon, route }) => {
        const accessible = canAccess(key);
        const active     = key === current;
        const status     = key === "academy" ? academyStatus : key === "skill" ? skillStatus : null;
        const lockTitle  = (status && LOCK_COPY[status]) || "Not available on your current plan";
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            className={[
              "trackSwitcher__seg",
              active      ? "is-active" : "",
              !accessible ? "is-locked" : "",
            ].join(" ").trim()}
            title={accessible ? label : lockTitle}
            onClick={() => handleClick({ key, route })}
          >
            {!accessible ? <RiLockLine className="trackSwitcher__lock" /> : <Icon size={13} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
