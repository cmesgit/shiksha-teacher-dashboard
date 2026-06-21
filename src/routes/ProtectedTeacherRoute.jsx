/**
 * src/routes/ProtectedTeacherRoute.jsx  ·  UPDATED — imports from config/urls.js
 */
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LOGIN_URL, PICK_PROFILE_URL } from "../config/urls";

export default function ProtectedTeacherRoute({ children }) {
  const { isAuthenticated, isTeacherContext, loading, context } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      window.location.href = LOGIN_URL;
      return;
    }
    if (!isTeacherContext) {
      window.location.href = PICK_PROFILE_URL;
    }
  }, [loading, isAuthenticated, isTeacherContext, context]);

  if (loading) return null;
  if (!isAuthenticated || !isTeacherContext) return null;
  return children;
}
