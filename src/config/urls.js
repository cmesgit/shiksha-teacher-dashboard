/**
 * src/config/urls.js  ·  SINGLE SOURCE OF TRUTH
 * ─────────────────────────────────────────────────
 * Copy this file into all three apps:
 *   landing_page/src/config/urls.js       ← replaces existing
 *   student_dashboard/src/config/urls.js  ← create new
 *   teacher_dashboard/src/config/urls.js  ← create new
 *
 * Then replace every inline fallback like:
 *   import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com"
 * with:
 *   import { HOME_URL } from "../config/urls"   (adjust path depth)
 *
 * HOW IT WORKS
 * ────────────
 * Priority 1: explicit VITE_* env var (set in .env on each droplet — always wins)
 * Priority 2: runtime hostname detection — no env var needed on dev server
 * Priority 3: production URLs (only reached if running on an unknown host
 *             AND no env vars are set — i.e. local dev machine)
 *
 * Dev detection covers:
 *   dev.shikshacom.com
 *   *.dev.shikshacom.com   (app.dev, teacher.dev, api.dev …)
 *   localhost / 127.0.0.1 / local network IPs
 */

const host   = typeof window !== "undefined" ? window.location.hostname : "";
const isDev  =
  host === "dev.shikshacom.com" ||
  host.endsWith(".dev.shikshacom.com") ||
  host === "localhost" ||
  host === "127.0.0.1" ||
  /^192\.168\.\d+\.\d+$/.test(host) ||
  /^10\.\d+\.\d+\.\d+$/.test(host);

const PROD = {
  HOME:    "https://www.shikshacom.com",
  APP:     "https://app.shikshacom.com",
  TEACHER: "https://teacher.shikshacom.com",
  API:     "https://api.shikshacom.com",
  WS:      "api.shikshacom.com",
};

const DEV = {
  HOME:    "https://dev.shikshacom.com",
  APP:     "https://app.dev.shikshacom.com",
  TEACHER: "https://teacher.dev.shikshacom.com",
  API:     "https://api.dev.shikshacom.com",
  WS:      "api.dev.shikshacom.com",
};

const ENV = isDev ? DEV : PROD;

// ── Exported URLs ─────────────────────────────────────────────────────────────
// Each one: VITE var wins → runtime auto-detect → fallback

export const HOME_URL    = import.meta.env.VITE_HOME_URL    || ENV.HOME;
export const APP_URL     = import.meta.env.VITE_APP_URL     || ENV.APP;
// TEACHER_URL — normalise: strip any /teacher/dashboard suffix the env var
// may already include (old convention), so TEACHER_DASHBOARD_URL is never doubled.
const _teacherRaw  = import.meta.env.VITE_TEACHER_URL || ENV.TEACHER;
export const TEACHER_URL          = _teacherRaw.replace(/\/teacher\/dashboard\/?$/, "");
export const TEACHER_DASHBOARD_URL = TEACHER_URL + "/teacher/dashboard";
export const API_URL     = import.meta.env.VITE_API_URL     || ENV.API + "/api";
export const WS_HOST     = import.meta.env.VITE_WS_HOST     || ENV.WS;

// Bunny Stream library ID — genuinely different per real environment (no
// hostname-based default makes sense here, unlike the URLs above). Must
// come from VITE_BUNNY_LIBRARY_ID; deliberately no hardcoded fallback —
// call sites should treat an empty string as "playback not configured"
// rather than silently embedding from the wrong library.
export const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID || "";

// Convenience composites
export const LOGIN_URL        = HOME_URL + "/login";
export const PICK_PROFILE_URL = HOME_URL + "/pick-profile";
export const SIGNUP_URL       = HOME_URL + "/signup";
export const FORM_FILLUP_URL  = HOME_URL + "/form-fillup";

// Teacher dashboard entry point (with path)

// Student dashboard entry point
export const APP_DASHBOARD_URL     = APP_URL;

// ── Academy / Skill-dev track destinations (added for the track switcher) ──
// "academy" maps to the Faculty dashboard, "skill" to the Guest-expert one.
export const TEACHER_ACADEMY_URL = TEACHER_URL + "/teacher/dashboard";
export const TEACHER_SKILL_URL   = TEACHER_URL + "/teacher/expert";

// Where a student is sent to enroll in a track they are not in yet.
export const ACADEMY_BROWSE_URL = HOME_URL + "/courses";
export const SKILL_BROWSE_URL   = HOME_URL + "/skill-development";

// Signup deep-link for adding a teaching track to an already-signed-in account
// (skips the email / username step). track = "academy" | "skill".
export const signupAddTrackUrl = (track) =>
  `${HOME_URL}/signup?role=teacher&add_track=${encodeURIComponent(track)}`;
