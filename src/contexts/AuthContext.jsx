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
 *   FIX 1: never intercept /me/ — bootstrap handles its own 401 with a manual
 *          refresh + retry.
 *   FIX 2: only redirect to LOGIN_URL when NOT already on an auth page (now
 *          lives in redirectToLogin(), shared with both apiClients).
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { API_URL, LOGIN_URL } from "../config/urls";
import { refreshSession, redirectToLogin } from "../api/refreshSession";

// ── Axios client ──────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL:         API_URL,
  withCredentials: true,
});

// This instance used to run its OWN `_isRefreshing` + `_queue` single-flight,
// as did api/apiClient.js and shared/apiClient.js. Three private flights
// against a backend that rotates AND blacklists the refresh token meant a
// cold load that 401s in several places at once got one winner and two
// "Token is blacklisted" losers, each of which redirected to login. The
// flight now lives in api/refreshSession.js and is shared tab-wide.
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    const st   = error.response?.status;
    const url  = orig?.url || "";

    // FIX 1: never intercept /me/ — bootstrap handles its 401 itself (a public
    // page such as the marketing home calls /me/ while logged OUT, and letting
    // the interceptor redirect on that would bounce every anonymous visitor to
    // /login). Public auth endpoints are surfaced to their callers as-is.
    //
    // `/notifications/` used to be excluded here too, for no reason anyone
    // recorded — it is an ordinary authenticated endpoint. The effect was that
    // the Settings modal's notification-preference toggles were the ONE section
    // that could not recover from an expired 60-minute access token: every
    // other section refreshed and retried, these just failed.
    const isMeCall           = url.includes("/me/");
    const isPublicEndpoint   = url.includes("/accounts/signup/") ||
                               url.includes("/accounts/register/") ||
                               url.includes("/accounts/oauth/google/") ||
                               url.includes("/accounts/email/check/") ||
                               url.includes("/accounts/verify-email/") ||
                               url.includes("/accounts/resend-verification/");
    if (isMeCall || isPublicEndpoint) {
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

    orig._retry = true;
    try {
      await refreshSession();
      return api(orig);
    } catch (e) {
      // FIX 2 now lives in redirectToLogin(): only redirect when we are NOT
      // already on an auth page, or arriving at /login redirects to /login,
      // forever.
      redirectToLogin();
      return Promise.reject(e);
    }
  }
);

export { api };

// ── Error extractor ───────────────────────────────────────────────────────────
// A 5xx from Django (or an nginx/gateway page) is not JSON — axios leaves the
// body as a raw string, and returning it renders the whole
// "<!doctype html> ... Server Error (500) ..." page as the user-facing error.
// Markup is never a message for a human, and with DEBUG on such a page can
// carry a stack trace. Mirrors shared/extractError.js; this copy is inline
// because AuthContext must not import from the app it is synced into.
const MAX_MESSAGE_LENGTH = 300;
function usableMessage(s) {
  const t = String(s).trim();
  if (!t) return null;
  if (t.startsWith("<")) return null;             // HTML/XML error document
  if (t.length > MAX_MESSAGE_LENGTH) return null; // page body, stack trace, dump
  return t;
}

function extractError(err) {
  const d = err?.response?.data;
  if (!d)                       return err?.message || "Something went wrong.";
  if (typeof d === "string")    return usableMessage(d) || "Something went wrong.";
  if (d.detail)                 return usableMessage(d.detail) || "Something went wrong.";
  for (const k of Object.keys(d)) {
    if (k === "code") continue; // machine token, never user-facing
    const v = d[k];
    if (Array.isArray(v) && v.length) { const m = usableMessage(v[0]); if (m) return m; }
    if (typeof v === "string")        { const m = usableMessage(v); if (m) return m; }
  }
  return "Something went wrong.";
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// design_handoff_quiz_system Phase 0 — default shape for `featureFlags` so a
// backend that predates this field (or a response that omits it) never
// crashes a consumer reading e.g. `featureFlags.quiz_v2_enabled`.
const DEFAULT_FEATURE_FLAGS = {
  quiz_v2_enabled: false,
  ai_question_drafting_enabled: false,
};

export function AuthProvider({ children }) {
  const [user,         setUser]        = useState(null);
  const [profiles,     setProfiles]    = useState([]);
  const [teacherInfo,  setTeacherInfo] = useState(null);
  const [context,      setContext]     = useState(null);
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [loading,      setLoading]     = useState(true);

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
      // Older backends won't send this key at all — fall back to both OFF
      // rather than leaving stale flags from a previous bootstrap in place.
      setFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, ...(data.feature_flags || {}) });
      return data;
    };
    const run = async () => {
      try {
        const res = await api.get("/accounts/me/");
        return apply(res.data);
      } catch (err) {
        if (!err?.response) return null;
        // /me/ failed — try refreshing the token once. Via refreshSession() so
        // this joins whatever refresh the page's other 401s already started
        // instead of firing a fourth one at a rotate-and-blacklist endpoint.
        try {
          await refreshSession();
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

  // ── Step 2B — enter a teaching track (teacher-mode PIN) ────────────────────
  // CHANGED 2026-09-06: this used to send the ACCOUNT PASSWORD. It now sends
  // the optional teacher-mode PIN, and sends nothing when none is set — most
  // teachers will never see a prompt at all. The password gate was removed
  // because it protected nothing (the caller is already signed in and typed
  // that password minutes ago at login) while being the highest-friction
  // moment on the teacher path. The PIN exists for shared family devices,
  // where a child on the same account could otherwise open a gradebook.
  //
  // `pin` may be omitted/empty. `track` is optional and one of
  // "academy" | "skill"; when omitted the backend defaults to
  // academy-if-approved, else the first approved track.
  const enterTeacherMode = async (pin, track) => {
    try {
      await api.post("/accounts/context/teacher/", { pin, track });
      setLoading(true);
      await bootstrap();
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "no_teacher")    return { needsSignup: true };
      if (code === "not_approved")  return { notApproved: true };
      if (code === "track_pending") return { trackPending: true };
      if (code === "track_locked")  return { trackLocked: true };
      if (code === "bad_pin")       return { badPin: true };
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // Whether entering teacher mode will prompt for a PIN. Lets a caller show
  // the field only when it is actually needed instead of always asking.
  const teacherPinRequired = async () => {
    try {
      const res = await api.get("/accounts/context/teacher/pin/");
      return !!res.data?.requires_pin;
    } catch {
      return false;
    }
  };

  // Set / change / clear the teacher-mode PIN. Requires the ACCOUNT PASSWORD —
  // deliberately, and unlike entering teacher mode. This is the destructive
  // operation and doubles as the forgot-PIN path (no old PIN needed). Pass an
  // empty `pin` to remove it.
  const setTeacherPin = async (pin, password) => {
    try {
      const res = await api.post("/accounts/context/teacher/pin/", { pin, password });
      return { ok: true, requiresPin: !!res.data?.requires_pin };
    } catch (err) {
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

  // ── Account-first registration ─────────────────────────────────────────────
  // Email + password + terms. No role, no teacher type, no profile name — a
  // person is a learner by default and teaching is added later from inside the
  // product (see addTeacherIdentity). Does NOT sign anyone in: the account is
  // unverified until the emailed link is clicked, and clicking it is what
  // creates the session.
  const register = async (email, password, termsAccepted) => {
    try {
      const res = await api.post("/accounts/register/", {
        email, password, terms_accepted: !!termsAccepted,
      });
      return res.data;
    } catch (err) {
      return Promise.reject({
        message: extractError(err),
        code: err?.response?.data?.code,
        raw: err,
      });
    }
  };

  // ── Google sign-in ─────────────────────────────────────────────────────────
  // `credential` is the ID token from Google Identity Services.
  //
  // Returns { needsConsent: true, email, name } when no account exists yet —
  // the caller shows a single terms checkbox and calls again with
  // termsAccepted=true. Consent stays explicit; it is never inferred from the
  // Google click.
  const signInWithGoogle = async (credential, termsAccepted) => {
    try {
      const res = await api.post("/accounts/oauth/google/", {
        credential, terms_accepted: !!termsAccepted,
      });
      const data = res.data;
      setProfiles(data.profiles || []);
      setTeacherInfo(data.teacher || null);
      setContext(data.context);
      setLoading(true);
      await bootstrap();
      return data;
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "no_account") {
        return {
          needsConsent: true,
          email: err.response.data.email,
          name:  err.response.data.name || "",
        };
      }
      if (code === "disabled") return { unavailable: true };
      return Promise.reject({ message: extractError(err), code, raw: err });
    }
  };

  // ── Teaching identity ──────────────────────────────────────────────────────
  // Reports what this account holds and may add. Replaces the old
  // "re-enter signup to add a track" path — the caller is already
  // authenticated, so no password is collected.
  const getTeacherIdentity = async () => {
    try {
      const res = await api.get("/accounts/identities/teacher/");
      return res.data;
    } catch (err) {
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // Start teaching, or add the track not yet held. `track` is
  // "academy" | "skill". Skill goes live immediately; academy lands in the
  // admin review queue (`needs_review` in the response).
  //
  // ⚠ DELIBERATELY DOES NOT BOOTSTRAP. `bootstrap()` sets loading=true, and
  // App.jsx renders `<RouteFallback />` for the whole app while loading —
  // which UNMOUNTS the route tree, destroying the calling screen's state. The
  // symptom is brutal to diagnose: the POST returns 201, the track really is
  // added, and the user is bounced back to a freshly-mounted form as though
  // nothing happened. Caught in the browser, not by any test.
  //
  // This is the same trap Content Studio hit (see the root CLAUDE.md note
  // about `load({quiet: true})` and dialogs being destroyed by a refresh).
  //
  // The caller shows its own confirmation and every exit from it is a real
  // navigation, so the next page load bootstraps with fresh teacherInfo
  // anyway. If a caller ever needs the context updated in place, it must call
  // bootstrap() itself AFTER committing whatever state it needs to survive.
  const addTeacherIdentity = async (track, payload = {}) => {
    try {
      const res = await api.post("/accounts/identities/teacher/", { track, ...payload });
      return res.data;
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "track_held") return { alreadyHeld: true, detail: extractError(err) };
      return Promise.reject({ message: extractError(err), code, raw: err });
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
    setFeatureFlags(DEFAULT_FEATURE_FLAGS);
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
        user, profiles, teacherInfo, context, activeProfile, featureFlags,
        isAuthenticated, needsProfileSelection, isTeacherContext, isLearnerContext,
        loading, api,
        login, selectProfile, switchProfile,
        enterTeacherMode, switchTrack, setProfilePin,
        teacherPinRequired, setTeacherPin,
        register, signInWithGoogle,
        getTeacherIdentity, addTeacherIdentity,
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
      activeProfile: null, featureFlags: DEFAULT_FEATURE_FLAGS,
      isAuthenticated: false, needsProfileSelection: false,
      isTeacherContext: false, isLearnerContext: false, loading: false, api,
      login: async () => null, selectProfile: async () => null, switchProfile: async () => null,
      enterTeacherMode: async () => ({ ok: false }), switchTrack: async () => ({ ok: false }),
      setProfilePin: async () => null,
      teacherPinRequired: async () => false, setTeacherPin: async () => null,
      register: async () => null, signInWithGoogle: async () => null,
      getTeacherIdentity: async () => null, addTeacherIdentity: async () => null,
      signup: async () => null, checkEmail: async () => ({}),
      lookupEmail: async () => ({ profiles: [], has_teacher: false }),
      logout: () => {}, hasRole: () => false, hasPermission: () => false,
      bootstrap: async () => null,
    };
  }
  return ctx;
}

export default api;
