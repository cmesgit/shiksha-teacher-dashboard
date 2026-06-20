/**
 * AuthContext.jsx  ·  SHARED — copy into all 3 apps' src/contexts/
 * ─────────────────────────────────────────────────────────────────
 * Single-password model:
 *   • ONE email, ONE password — no separate teacher password
 *   • Teacher context entered with the SAME account password
 *   • Learner profiles are PIN-gated (4–6 digit numeric)
 *
 * Set VITE_APP_TYPE="landing" | "student" | "teacher" in each app's .env
 * to control post-logout redirect behaviour.
 *
 * REMOVED vs old versions:
 *   - setTeacherPassword()  ← no separate teacher password
 *   - enterTeacherMode() no longer needs a different password
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

// ── Axios client ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api",
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
    if (
      st !== 401 || orig._retry ||
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
      const home = import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com";
      window.location.href = home + "/login";
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
  const [context,     setContext]     = useState(null); // "account"|"learner"|"teacher"
  const [loading,     setLoading]     = useState(true);

  const isAuthenticated       = !!user;
  const needsProfileSelection = isAuthenticated && context === "account";
  const activeProfile         = user?.active_profile || null;
  const isTeacherContext      = context === "teacher";
  const isLearnerContext      = context === "learner";

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  const bootstrap = useCallback(async () => {
    const apply = (data) => {
      setUser(data);
      setContext(data.context || "account");
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      setTeacherInfo(data.teacher || null);
      return data;
    };
    try {
      const res = await api.get("/accounts/me/");
      return apply(res.data);
    } catch {
      try   { await api.post("/accounts/refresh/"); }
      catch { setUser(null); setLoading(false); return null; }
      try   { return apply((await api.get("/accounts/me/")).data); }
      catch { setUser(null); return null; }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // ── Step 1 — account login ─────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const res  = await api.post("/accounts/login/", { email, password });
      const data = res.data;
      setProfiles(data.profiles || []);
      setTeacherInfo(data.teacher || null);
      setContext(data.context);   // may already be "learner" if backend auto-selected

      if (data.context === "learner") {
        setLoading(true);
        await bootstrap();
      }
      return data;
    } catch (err) {
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // ── Step 2A — select / switch learner profile (PIN-gated) ─────────────────
  const selectProfile = async (profileId, pin) => {
    try {
      await api.post("/accounts/profiles/select/", { profile_id: profileId, pin });
      setLoading(true);
      return await bootstrap();
    } catch (err) {
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  const switchProfile = selectProfile; // alias

  // ── Step 2B — enter teacher context (ACCOUNT password — same as login) ─────
  /**
   * Enter teacher mode with the same password used to log in.
   *
   * Returns:
   *   { ok: true }           → switched to teacher context
   *   { needsSignup: true }  → no teacher identity on this account
   *   { notApproved: true }  → pending admin approval
   *   throws { message }     → wrong password / other error
   */
  const enterTeacherMode = async (password) => {
    try {
      await api.post("/accounts/context/teacher/", { password });
      setLoading(true);
      await bootstrap();
      return { ok: true };
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "no_teacher")   return { needsSignup: true };
      if (code === "not_approved") return { notApproved: true };
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  // ── Profile PIN helpers ────────────────────────────────────────────────────
  const setProfilePin = async (profileId, pin) => {
    try {
      const res = await api.post("/accounts/profiles/pin/", {
        profile_id: profileId,
        pin: pin || "",
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
  const logout = async () => {
    try { await api.post("/accounts/logout/"); } catch { /* ignore */ }
    setUser(null); setProfiles([]); setTeacherInfo(null); setContext(null);

    const appType = import.meta.env.VITE_APP_TYPE;
    if (appType === "landing") {
      window.location.href = "/login";
    } else {
      const home = import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com";
      window.location.href = home + "/login";
    }
  };

  // ── Role check ─────────────────────────────────────────────────────────────
  const hasRole = (role) => {
    if (!user || !Array.isArray(user.roles)) return false;
    return user.roles.some(
      (r) => String(r).toLowerCase() === String(role).toLowerCase()
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user, profiles, teacherInfo, context, activeProfile,
        isAuthenticated, needsProfileSelection, isTeacherContext, isLearnerContext,
        loading, api,
        login, selectProfile, switchProfile,
        enterTeacherMode,   // uses account password — NO separate teacher password
        setProfilePin,
        signup, lookupEmail, checkEmail, logout, hasRole, bootstrap,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    console.warn("useAuth was called outside AuthProvider.");
    return {
      user: null, profiles: [], teacherInfo: null, context: null,
      activeProfile: null, isAuthenticated: false, needsProfileSelection: false,
      isTeacherContext: false, isLearnerContext: false, loading: false, api,
      login: async () => null, selectProfile: async () => null, switchProfile: async () => null,
      enterTeacherMode: async () => ({ ok: false }), setProfilePin: async () => null,
      signup: async () => null, checkEmail: async () => ({}),
      lookupEmail: async () => ({ profiles: [], has_teacher: false }),
      logout: () => {}, hasRole: () => false, bootstrap: async () => null,
    };
  }
  return ctx;
}

export default api;
