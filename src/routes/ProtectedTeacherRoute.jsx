/**
 * teacher_dashboard/src/routes/ProtectedTeacherRoute.jsx  (FULL REPLACEMENT)
 *
 * Requires the JWT to be in TEACHER context (not just authenticated).
 * If the user is authenticated but in learner/account context, redirects them
 * to the marketplace pick-profile page where they can enter teacher mode.
 */
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const HOME_URL = import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com";

export default function ProtectedTeacherRoute({ children }) {
  const { isAuthenticated, isTeacherContext, loading, context } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      window.location.href = HOME_URL + "/login";
      return;
    }
    if (!isTeacherContext) {
      // In account or learner context — go to the picker to enter teacher mode
      window.location.href = HOME_URL + "/pick-profile";
    }
  }, [loading, isAuthenticated, isTeacherContext, context]);

  if (loading) return null;
  if (!isAuthenticated || !isTeacherContext) return null;
  return children;
}
