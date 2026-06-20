/* shared/guards.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Context-aware route guards for all three apps. They build on the shared
 * AuthContext (which exposes context/roles/profiles).
 *
 *   <RequireAuth>            — must be logged in (any context)
 *   <RequireProfile>         — must be in a LEARNER context (profile selected)
 *   <RequireTeacherContext>  — must be in TEACHER context
 *   <RequireProfileComplete> — active learner profile's is_complete === true
 *   <AdminOnly>              — must hold the ADMIN role (skill reviewer route)
 *
 * Each redirects sensibly: unauthenticated → marketplace login; wrong context
 * → the profile picker; incomplete profile → the form-fillup page.
 */
import { useAuth } from "./AuthContext";

const HOME = import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com";
const PICKER_PATH = "/pick-profile";
const FILLUP_PATH = "/form-fillup";

function hardRedirect(url) { window.location.href = url; return null; }

export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) {
    try {
      const here = window.location.pathname + window.location.search;
      if (here.startsWith("/") && !here.startsWith("//"))
        sessionStorage.setItem("post_auth_redirect", here);
    } catch { /* */ }
    return hardRedirect(HOME + "/login");
  }
  return children;
}

export function RequireProfile({ children }) {
  const { isAuthenticated, isLearnerContext, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return hardRedirect(HOME + "/login");
  if (!isLearnerContext) return hardRedirect(HOME + PICKER_PATH);
  return children;
}

export function RequireTeacherContext({ children }) {
  const { isAuthenticated, isTeacherContext, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return hardRedirect(HOME + "/login");
  if (!isTeacherContext) return hardRedirect(HOME + PICKER_PATH);
  return children;
}

export function RequireProfileComplete({ children }) {
  const { isAuthenticated, isLearnerContext, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return hardRedirect(HOME + "/login");
  if (!isLearnerContext) return hardRedirect(HOME + PICKER_PATH);
  // Reads completeness off the ACTIVE profile (new LearnerProfile.is_complete),
  // surfaced via /me/ as profile_complete + active_profile.profile_complete.
  const complete =
    user?.profile_complete ?? user?.active_profile?.profile_complete ?? false;
  if (!complete) return hardRedirect(FILLUP_PATH);
  return children;
}

export function AdminOnly({ children, fallback = "/" }) {
  const { hasRole, loading } = useAuth();
  if (loading) return null;
  if (!hasRole("ADMIN")) return hardRedirect(fallback);
  return children;
}
