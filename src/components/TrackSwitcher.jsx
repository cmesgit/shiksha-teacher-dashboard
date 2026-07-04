// src/components/TrackSwitcher.jsx  (teacher dashboard — FULL REPLACEMENT)
// ──────────────────────────────────────────────────────────────────────────
// Academy ⟷ Skill Dev toggle for the TEACHER header.
//
// WHAT CHANGED vs the previous version
// ────────────────────────────────────
// 1. Reads teacherInfo.tracks.{academy,skill} (per-track lifecycle:
//    locked / pending / approved / rejected) instead of the legacy
//    teacherInfo.type. That's what the auth-flow doc always specified —
//    the legacy check couldn't show "pending", so a teacher whose
//    application sat in review saw a live-looking pill that led to an
//    empty dashboard. Pills now render:
//        approved → selectable
//        pending  → "In review" badge, disabled
//        rejected → "Re-apply" → faculty/expert application page
//        locked   → padlock + "Apply" → application page
// 2. TOKEN-SYNCED SWITCHING. Switching used to be a bare navigate();
//    the JWT's active_track claim stayed stale, so the backend (and
//    /me/) still thought you were on the other track. The switch now
//    calls POST /accounts/context/teacher/track/ (new endpoint —
//    re-mints cookies, no password inside teacher context) and only
//    then navigates + re-bootstraps. If the endpoint isn't deployed
//    yet (404), it degrades to the old navigate-only behavior.
//
// Palette note preserved: ctx-teacher renders both active pills slate
// (#425f7f) per the Auth Flow handoff doc.
// ──────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  RiGraduationCapFill,
  RiSparkling2Fill,
  RiLockLine,
  RiTimeLine,
  RiErrorWarningLine,
} from "react-icons/ri";
import { HOME_URL } from "../config/urls";
import api from "../api/apiClient";
import "../styles/trackSwitcher.css";

const TRACKS = [
  { key: "academy", label: "Academy",   Icon: RiGraduationCapFill,
    route: "/teacher/dashboard", applyUrl: `${HOME_URL}/become-faculty` },
  { key: "skill",   label: "Skill Dev", Icon: RiSparkling2Fill,
    route: "/teacher/expert",    applyUrl: `${HOME_URL}/expert-apply`   },
];

export default function TrackSwitcher() {
  const navigate      = useNavigate();
  const { pathname }  = useLocation();
  const { teacherInfo, bootstrap } = useAuth();
  const [switching, setSwitching] = useState(false);

  // Per-track statuses; older /me/ payloads (no tracks map) fall back to
  // the legacy type so nothing renders locked that used to work.
  const legacyType = teacherInfo?.type;
  const statuses = teacherInfo?.tracks || {
    academy: legacyType === "GUEST" ? "locked" : "approved",
    skill:   legacyType === "FACULTY" ? "locked" : "approved",
  };

  const current = pathname.startsWith("/teacher/expert") ? "skill" : "academy";

  const handleClick = async (track) => {
    const status = statuses[track.key] || "locked";

    if (status === "pending") return; // disabled — nothing to do yet

    if (status === "locked" || status === "rejected") {
      window.location.href = track.applyUrl;   // application / re-apply flow
      return;
    }

    if (track.key === current || switching) return;

    // approved → sync the token's active_track, then move.
    setSwitching(true);
    try {
      await api.post("/accounts/context/teacher/track/", { track: track.key });
      await bootstrap?.();                     // refresh teacherInfo.active_track
    } catch (err) {
      // 404 = endpoint not deployed yet → legacy navigate-only fallback.
      // Anything else (pending/locked raced an admin change) → re-bootstrap
      // so the pills reflect reality, and stay put.
      if (err?.response?.status !== 404) {
        await bootstrap?.();
        if (err?.response?.data?.code) { setSwitching(false); return; }
      }
    }
    setSwitching(false);
    navigate(track.route);
  };

  return (
    <div className="trackSwitcher ctx-teacher" role="tablist" aria-label="Teaching track">
      {TRACKS.map((track) => {
        const { key, label, Icon } = track;
        const status  = statuses[key] || "locked";
        const active  = key === current && status === "approved";
        const pending = status === "pending";
        const locked  = status === "locked";
        const rejected = status === "rejected";

        const title =
          pending  ? "Application in review" :
          rejected ? "Application rejected — click to re-apply" :
          locked   ? "Not on this track yet — click to apply" :
          label;

        const LeadIcon =
          pending  ? RiTimeLine :
          rejected ? RiErrorWarningLine :
          locked   ? RiLockLine :
          Icon;

        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={pending || switching}
            disabled={pending || switching}
            className={[
              "trackSwitcher__seg",
              active               ? "is-active" : "",
              locked || rejected   ? "is-locked" : "",
              pending              ? "is-pending" : "",
            ].join(" ").trim()}
            title={title}
            onClick={() => handleClick(track)}
          >
            <LeadIcon size={13}
              className={locked ? "trackSwitcher__lock" : undefined} />
            <span>{label}</span>
            {pending && (
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.75, marginLeft: 4 }}>
                In review
              </span>
            )}
            {rejected && (
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.75, marginLeft: 4 }}>
                Re-apply
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* Optional CSS (append to src/styles/trackSwitcher.css):
.trackSwitcher__seg.is-pending { opacity: .65; cursor: default; }
*/
