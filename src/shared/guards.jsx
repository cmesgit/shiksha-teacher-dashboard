/* shared/guards.jsx  ·  UPDATED — imports from config/urls.js
 * ─────────────────────────────────────────────────────────────
 * Context-aware route guards. All URL fallbacks now come from
 * config/urls.js instead of being inlined.
 */
import { useAuth } from "../contexts/AuthContext";
import { HOME_URL, LOGIN_URL, PICK_PROFILE_URL, FORM_FILLUP_URL } from "../config/urls";

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
    return hardRedirect(LOGIN_URL);
  }
  return children;
}

export function RequireProfile({ children }) {
  const { isAuthenticated, isLearnerContext, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated)  return hardRedirect(LOGIN_URL);
  if (!isLearnerContext) return hardRedirect(PICK_PROFILE_URL);
  return children;
}

export function RequireTeacherContext({ children }) {
  const { isAuthenticated, isTeacherContext, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated)  return hardRedirect(LOGIN_URL);
  if (!isTeacherContext) return hardRedirect(PICK_PROFILE_URL);
  return children;
}

export function RequireProfileComplete({ children }) {
  const { isAuthenticated, isLearnerContext, user, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated)  return hardRedirect(LOGIN_URL);
  if (!isLearnerContext) return hardRedirect(PICK_PROFILE_URL);
  const complete =
    user?.profile_complete ?? user?.active_profile?.profile_complete ?? false;
  if (!complete) return hardRedirect(FORM_FILLUP_URL);
  return children;
}

export function AdminOnly({ children, fallback = "/" }) {
  const { hasRole, loading } = useAuth();
  if (loading) return null;
  if (!hasRole("ADMIN")) return hardRedirect(fallback);
  return children;
}
