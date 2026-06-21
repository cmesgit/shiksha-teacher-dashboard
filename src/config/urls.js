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
export const TEACHER_URL = import.meta.env.VITE_TEACHER_URL || ENV.TEACHER;
export const API_URL     = import.meta.env.VITE_API_URL     || ENV.API + "/api";
export const WS_HOST     = import.meta.env.VITE_WS_HOST     || ENV.WS;

// Convenience composites
export const LOGIN_URL        = HOME_URL + "/login";
export const PICK_PROFILE_URL = HOME_URL + "/pick-profile";
export const SIGNUP_URL       = HOME_URL + "/signup";
export const FORM_FILLUP_URL  = HOME_URL + "/form-fillup";

// Teacher dashboard entry point (with path)
export const TEACHER_DASHBOARD_URL = TEACHER_URL + "/teacher/dashboard";
// Student dashboard entry point
export const APP_DASHBOARD_URL     = APP_URL;
