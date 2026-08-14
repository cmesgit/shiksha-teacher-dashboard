/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                         │
 * │  Canonical source: <workspace>/shared/src/contexts/AuthContext.jsx         │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to       │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * AuthContext — single source of truth for the account / profile / track model
 * shared by shiksha-frontend, shiksha-teacher-dashboard and shiksha-student-
 * dashboard. (Admin-dashboard has its own ADMIN-only AuthContext and is NOT in
 * this set.)
 *
 * Terminology used throughout the UI (keep consistent, do not reintroduce
 * "mode" / "context" in user-facing strings):
 *   • Account  — the login + billing identity (one email → one account).
 *   • Profile  — a switchable learner identity under an account.
 *   • Track    — a teaching identity: Academy (Faculty) or Skill-Dev (Expert).
 *   • Faculty  — an Academy-track teacher.  Expert — a Skill-Dev-track teacher.
 * ("context" / "active_track" remain as internal field names from the backend
 *  token/API contract — those are data, not labels.)
 *
 * Imports ../config/urls (present in all three apps). The two interceptor bug
 * fixes below prevent the historic infinite reload loop on /login:
 *   FIX 1: never intercept /me/ or /notifications/ — bootstrap handles its own
 *          /me/ 401 with a manual refresh + retry.
 *   FIX 2: only redirect to LOGIN_URL when NOT already on an auth page.
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { API_URL, LOGIN_URL } from "../config/urls";

// ── Axios client ──────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL:         API_URL,
  withCredentials: true,
});

let _isRefreshing = false;
let _queue        = [];
const _flush = (err) => {
  _queue.forEach((p) => (err ? p.reject(err) : p.resolve()));
  _queue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    const st   = error.response?.status;
    const url  = orig?.url || "";

    // FIX 1: never intercept /me/ or /notifications/ — bootstrap handles /me/ 401
    // itself; intercepting it causes an infinite reload on the /login page.
    // Public auth endpoints are surfaced to their callers as-is (no refresh).
    const isMeCall           = url.includes("/me/");
    const isNotificationCall = url.includes("/notifications/");
    const isPublicEndpoint   = url.includes("/accounts/signup/") ||
                               url.includes("/accounts/email/check/") ||
                               url.includes("/accounts/verify-email/") ||
                               url.includes("/accounts/resend-verification/");
    if (isMeCall || isNotificationCall || isPublicEndpoint) {
      return Promise.reject(error);
    }

    if (
      st !== 401 ||
      orig._retry ||
      url.includes("/accounts/refresh/") ||
      url.includes("/accounts/login/")
    ) {
      return Promise.reject(error);
    }

    if (_isRefreshing) {
      return new Promise((res, rej) =>
        _queue.push({ resolve: res, reject: rej })
      ).then(() => api(orig));
    }

    orig._retry   = true;
    _isRefreshing = true;
    try {
      await api.post("/accounts/refresh/");
      _flush(null);
      return api(orig);
    } catch (e) {
      _flush(e);
      // FIX 2: only redirect if we are NOT already on an auth page.
      // Without this guard, arriving at /login triggers another redirect
      // to /login, which triggers another, forever.
      const p = window.location.pathname;
      const onAuthPage =
        p === "/login" ||
        p === "/signup" ||
        p.startsWith("/verify-email") ||
        p.startsWith("/forgot-password") ||
        p.startsWith("/email-verified");
      if (!onAuthPage) {
        window.location.href = LOGIN_URL;
      }
      return Promise.reject(e);
    } finally {
      _isRefreshing = false;
    }
  }
);

export { api };

// ── Error extractor ───────────────────────────────────────────────────────────
function extractError(err) {
  const d = err?.response?.data;
  if (!d)                       return err?.message || "Something went wrong.";
  if (typeof d === "string")    return d;
  if (d.detail)                 return d.detail;
  for (const k of Object.keys(d)) {
    if (k === "code") continue; // machine token, never user-facing
    const v = d[k];
    if (Array.isArray(v) && v.length) return v[0];
    if (typeof v === "string")        return v;
  }
  return "Something went wrong.";
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [profiles,    setProfiles]    = useState([]);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [context,     setContext]     = useState(null);
  const [loading,     setLoading]     = useState(true);

  const isAuthenticated       = !!user;
  const needsProfileSelection = isAuthenticated && context === "account";
  const activeProfile         = user?.active_profile || null;
  const isTeacherContext      = context === "teacher";
  const isLearnerContext      = context === "learner";

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  // The interceptor skips /me/ calls, so bootstrap handles refresh manually.
  // A network-level failure (no response reached the server — offline, a
  // timeout, the browser aborting an in-flight fetch on a backgrounded tab)
  // is not proof the session is invalid, so it never clears `user` — only a
  // real 401 response (from /me/ AND the refresh retry) does. Without this
  // distinction, a transient blip on the focus-triggered recheck below would
  // force a fully-authenticated user into a logged-out redirect.
  const bootstrapInFlight = useRef(null);
  const bootstrap = useCallback(async () => {
    if (bootstrapInFlight.current) return bootstrapInFlight.current;
    const apply = (data) => {
      setUser(data);
      setContext(data.context || "account");
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      setTeacherInfo(data.teacher || null);
      return data;
    };
    const run = async () => {
      try {
        const res = await api.get("/accounts/me/");
        return apply(res.data);
      } catch (err) {
        if (!err?.response) return null;
        // /me/ failed — try refreshing the token once
        try {
          await api.post("/accounts/refresh/");
        } catch (refreshErr) {
          if (!refreshErr?.response) return null;
          // Refresh also failed — user is not logged in
          setUser(null);
          return null;
        }
        // Refresh succeeded — retry /me/
        try {
          return apply((await api.get("/accounts/me/")).data);
        } catch (retryErr) {
          if (!retryErr?.response) return null;
          setUser(null);
          return null;
        }
      } finally {
        setLoading(false);
      }
    };
    bootstrapInFlight.current = run().finally(() => {
      bootstrapInFlight.current = null;
    });
    return bootstrapInFlight.current;
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // Auth context lives in a cookie shared across every app on this domain
  // (teacher-dashboard, admin-dashboard, another tab of this same app).
  // Entering teacher mode in one of those elsewhere rewrites that cookie
  // to context=teacher — this tab's React state has no way to know, so it
  // keeps rendering the student UI while every subsequent API call now
  // authenticates as a teacher, surfacing as scattered, hard-to-diagnose
  // 403s ("Not authorized for this quiz.", "Not assigned to this subject.")
  // instead of one clear "you're in a different context now" signal.
  // Re-bootstrapping when the tab regains focus/visibility catches that
  // drift immediately — RequireProfile's isLearnerContext check then
  // redirects to /pick-profile instead of leaving the stale UI up. `focus`
  // and `visibilitychange` both fire on a single tab-switch; bootstrap()'s
  // in-flight guard above collapses that into one request.
  useEffect(() => {
    const recheck = () => { if (!document.hidden) bootstrap(); };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [bootstrap]);

  // ── Step 1 — account login ─────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const res  = await api.post("/accounts/login/", { email, password });
      const data = res.data;
      // Stash what the login response told us so the picker has profiles/teacher
      // available immediately after bootstrap, even if /me/ returns slightly
      // different shape data.
      setProfiles(data.profiles || []);
      setTeacherInfo(data.teacher || null);
      setContext(data.context);
      // ALWAYS bootstrap — this populates `user` (isAuthenticated) regardless
      // of context. Without it, "account" context navigated to /pick-profile
      // while user was still null, causing ProtectedRoute to kick back to /login.
      setLoading(true);
      await bootstrap();
      return data;
    } catch (err) {
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // ── Step 2A — select / switch learner profile ──────────────────────────────
  const selectProfile = async (profileId, pin) => {
    try {
      await api.post("/accounts/profiles/select/", { profile_id: profileId, pin });
      setLoading(true);
      return await bootstrap();
    } catch (err) {
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  const switchProfile = selectProfile;

  // ── Step 2B — enter a teaching track (account password) ────────────────────
  // `track` is optional and one of "academy" | "skill" (backend contract). When
  // omitted the backend defaults to academy-if-approved, else the first approved
  // track. Error codes map to the switcher's inline messages.
  const enterTeacherMode = async (password, track) => {
    try {
      await api.post("/accounts/context/teacher/", { password, track });
      setLoading(true);
      await bootstrap();
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "no_teacher")    return { needsSignup: true };
      if (code === "not_approved")  return { notApproved: true };
      if (code === "track_pending") return { trackPending: true };
      if (code === "track_locked")  return { trackLocked: true };
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // ── Switch between already-held teaching tracks (no password) ──────────────
  // Moves an in-track teacher between Academy/Skill-Dev without re-confirming the
  // account password (POST /accounts/context/teacher/track/). Same per-track
  // gates as enterTeacherMode.
  const switchTrack = async (track) => {
    try {
      await api.post("/accounts/context/teacher/track/", { track });
      setLoading(true);
      await bootstrap();
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "track_pending") return { trackPending: true };
      if (code === "track_locked")  return { trackLocked: true };
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // ── Profile PIN ────────────────────────────────────────────────────────────
  // Setting / changing / resetting / removing a PIN requires the ACCOUNT
  // password (server-enforced). This is also the "forgot PIN" path: pass the
  // account password + a new pin (or "" to remove) — no old PIN needed.
  const setProfilePin = async (profileId, pin, password) => {
    try {
      const res = await api.post("/accounts/profiles/pin/", {
        profile_id: profileId,
        pin: pin || "",
        password: password || "",
      });
      const refreshed = await api.get("/accounts/profiles/");
      setProfiles(refreshed.data);
      return res.data;
    } catch (err) {
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // ── Email helpers ──────────────────────────────────────────────────────────
  const lookupEmail = async (email) => {
    try {
      const res = await api.post("/accounts/profiles/lookup/", {
        email: email.trim().toLowerCase(),
      });
      return res.data;
    } catch {
      return { profiles: [], has_teacher: false };
    }
  };

  const checkEmail = async (email) => {
    try {
      const res = await api.post("/accounts/email/check/", {
        email: email.trim().toLowerCase(),
      });
      return res.data;
    } catch {
      return { exists: false, has_student: false, has_teacher: false, is_verified: false };
    }
  };

  // ── Signup ─────────────────────────────────────────────────────────────────
  const signup = async (payload) => {
    try {
      await api.post("/accounts/signup/", payload);
    } catch (err) {
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  // Clears state, then by default hard-redirects to LOGIN_URL — the dashboard
  // apps have no in-app /login route, so they rely on this. Callers that want to
  // keep React Router in control (e.g. the public frontend forum, which stays on
  // a public page) pass { redirect: false } and navigate themselves.
  const logout = async ({ redirect = true } = {}) => {
    try { await api.post("/accounts/logout/"); } catch { /* ignore */ }
    setUser(null);
    setProfiles([]);
    setTeacherInfo(null);
    setContext(null);
    if (redirect) window.location.href = LOGIN_URL;
  };

  // ── Role check ─────────────────────────────────────────────────────────────
  const hasRole = (role) => {
    if (!user || !Array.isArray(user.roles)) return false;
    return user.roles.some(
      (r) => String(r).toLowerCase() === String(role).toLowerCase()
    );
  };

  // ── Permission check ─────────────────────────────────────────────────────────
  // Mirrors the backend authority: /accounts/me/ returns `permissions` (RBAC
  // codenames from get_permissions()), and staff/superusers implicitly hold all.
  // Gate moderator UI on this — NOT on hasRole alone — so a staff- or
  // permission-based moderator (who passes the server IsForumModerator check)
  // isn't hidden by a role-name-only frontend gate. Codenames are exact
  // (case-sensitive), e.g. "forum.moderate", "documents.moderate".
  const hasPermission = (codename) => {
    if (!user) return false;
    if (user.is_staff || user.is_superuser) return true;
    return Array.isArray(user.permissions) && user.permissions.includes(codename);
  };

  return (
    <AuthContext.Provider
      value={{
        user, profiles, teacherInfo, context, activeProfile,
        isAuthenticated, needsProfileSelection, isTeacherContext, isLearnerContext,
        loading, api,
        login, selectProfile, switchProfile,
        enterTeacherMode, switchTrack, setProfilePin,
        signup, lookupEmail, checkEmail, logout, hasRole, hasPermission, bootstrap,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  // Defensive fallback: returning a null-shaped context (instead of throwing)
  // keeps shared components from crashing if they ever render outside the
  // provider (e.g. inside an error boundary or a not-yet-mounted shell).
  if (!ctx) {
    console.warn("useAuth was called outside AuthProvider.");
    return {
      user: null, profiles: [], teacherInfo: null, context: null,
      activeProfile: null, isAuthenticated: false, needsProfileSelection: false,
      isTeacherContext: false, isLearnerContext: false, loading: false, api,
      login: async () => null, selectProfile: async () => null, switchProfile: async () => null,
      enterTeacherMode: async () => ({ ok: false }), switchTrack: async () => ({ ok: false }),
      setProfilePin: async () => null,
      signup: async () => null, checkEmail: async () => ({}),
      lookupEmail: async () => ({ profiles: [], has_teacher: false }),
      logout: () => {}, hasRole: () => false, hasPermission: () => false,
      bootstrap: async () => null,
    };
  }
  return ctx;
}

export default api;
