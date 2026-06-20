/**
 * student_dashboard/src/contexts/AuthContext.jsx
 *
 * Full multi-profile, context-aware auth for the student dashboard.
 * Replaces the old single-user version entirely.
 *
 * What changed from the old version:
 *  - Exposes `context`, `profiles`, `activeProfile`, `teacherInfo`
 *  - `selectProfile(id, pin)` to switch learner profiles (PIN-gated for kids)
 *  - `enterTeacherMode(password)` to switch to teacher mode (separate password)
 *    returns { ok } | { needsSignup } | { notApproved }
 *  - logout goes to VITE_HOME_URL/login (unchanged)
 *  - The old hooks/useAuth.jsx (which called "/me/" without /accounts prefix) is
 *    now DEAD — delete it, all imports should come from this file.
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

// ── Single shared axios client ───────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api",
  withCredentials: true,
});

let _isRefreshing = false;
let _queue = [];
const _flush = (err) => { _queue.forEach((p) => (err ? p.reject(err) : p.resolve())); _queue = []; };

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    const st = error.response?.status;
    const url = orig?.url || "";
    if (st !== 401 || orig._retry || url.includes("/accounts/refresh/") || url.includes("/accounts/login/")) {
      return Promise.reject(error);
    }
    if (_isRefreshing) {
      return new Promise((res, rej) => _queue.push({ resolve: res, reject: rej })).then(() => api(orig));
    }
    orig._retry = true;
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
    } finally { _isRefreshing = false; }
  }
);

export { api };

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractError(err) {
  const d = err?.response?.data;
  if (!d) return err?.message || "Something went wrong.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (Array.isArray(v) && v.length) return v[0];
    if (typeof v === "string") return v;
  }
  return "Something went wrong.";
}

// ── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;
  const needsProfileSelection = isAuthenticated && context === "account";
  const activeProfile = user?.active_profile || null;
  const isTeacherContext = context === "teacher";
  const isLearnerContext = context === "learner";

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
      try { await api.post("/accounts/refresh/"); } catch { setUser(null); setLoading(false); return null; }
      try { return apply((await api.get("/accounts/me/")).data); }
      catch { setUser(null); return null; }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = async (email, password) => {
    try {
      const res = await api.post("/accounts/login/", { email, password });
      setProfiles(res.data.profiles || []);
      setTeacherInfo(res.data.teacher || null);
      setContext("account");
      return res.data;
    } catch (err) { return Promise.reject({ message: extractError(err), raw: err }); }
  };

  /** Select or switch to a learner profile (step 2 of login, or inline switch). */
  const selectProfile = async (profileId, pin) => {
    try {
      await api.post("/accounts/profiles/select/", { profile_id: profileId, pin });
      setLoading(true);
      return await bootstrap();
    } catch (err) { return Promise.reject({ message: extractError(err), raw: err }); }
  };
  const switchProfile = selectProfile;

  /**
   * Enter teacher mode — requires the SEPARATE teacher password.
   * Returns:
   *   { ok: true }           → switched
   *   { needsSignup: true }  → no teacher identity → route to teacher signup
   *   { notApproved: true }  → pending approval
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
      if (code === "no_teacher") return { needsSignup: true };
      if (code === "not_approved") return { notApproved: true };
      return Promise.reject({ message: extractError(err), raw: err });
    }
  };

  /** Set / change the teacher-context password. */
  const setTeacherPassword = async (currentPassword, newPassword) => {
    try {
      await api.post("/accounts/context/teacher/password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return { ok: true };
    } catch (err) { return Promise.reject({ message: extractError(err), raw: err }); }
  };

  const checkEmail = async (email) => {
    try {
      const res = await api.post("/accounts/email/check/", { email: email.trim().toLowerCase() });
      return res.data;
    } catch { return { exists: false, has_student: false, has_teacher: false, is_verified: false }; }
  };

  const signup = async (payload) => {
    try { await api.post("/accounts/signup/", payload); }
    catch (err) { return Promise.reject({ message: extractError(err), raw: err }); }
  };

  const logout = async () => {
    try { await api.post("/accounts/logout/"); } catch { /* ignore */ }
    setUser(null); setProfiles([]); setTeacherInfo(null); setContext(null);
    window.location.href = (import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com") + "/login";
  };

  const hasRole = (role) => {
    if (!user || !Array.isArray(user.roles)) return false;
    return user.roles.some((r) => String(r).toLowerCase() === String(role).toLowerCase());
  };

  return (
    <AuthContext.Provider value={{
      user, profiles, teacherInfo, context, activeProfile,
      isAuthenticated, needsProfileSelection, isTeacherContext, isLearnerContext,
      loading,
      api,
      login, selectProfile, switchProfile, enterTeacherMode, setTeacherPassword,
      signup, checkEmail, logout, hasRole, bootstrap,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    console.warn("useAuth was called outside AuthProvider.");

    return {
      user: null,
      profiles: [],
      teacherInfo: null,
      context: null,
      activeProfile: null,

      isAuthenticated: false,
      needsProfileSelection: false,
      isTeacherContext: false,
      isLearnerContext: false,
      loading: false,

      api,

      login: async () => null,
      selectProfile: async () => null,
      switchProfile: async () => null,
      enterTeacherMode: async () => ({ ok: false }),
      setTeacherPassword: async () => ({ ok: false }),
      signup: async () => null,
      checkEmail: async () => ({
        exists: false,
        has_student: false,
        has_teacher: false,
        is_verified: false,
      }),
      logout: () => {},
      hasRole: () => false,
      bootstrap: async () => null,
    };
  }

  return ctx;
}

export default api;
