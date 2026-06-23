/**
 * ProtectedTeacherRoute  ·  imports from config/urls
 * ──────────────────────────────────────────────────
 * Renders a visible "loading / taking you to the right place" state instead of
 * a bare `null`. A null return during the bootstrap window (or just before a
 * redirect fires) is a blank white screen — which is exactly what made the
 * teacher dashboard look broken. This makes that window legible.
 */
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LOGIN_URL, PICK_PROFILE_URL } from "../config/urls";

function Centered({ children }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: 16,
      fontFamily: "system-ui, sans-serif", color: "#555",
    }}>
      <div style={{
        width: 34, height: 34, border: "3px solid #e5e7eb",
        borderTopColor: "#2563eb", borderRadius: "50%",
        animation: "ptrSpin .8s linear infinite",
      }} />
      <p style={{ margin: 0, fontSize: 14 }}>{children}</p>
      <style>{`@keyframes ptrSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function ProtectedTeacherRoute({ children }) {
  const { isAuthenticated, isTeacherContext, loading, context } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      window.location.href = LOGIN_URL;
      return;
    }
    if (!isTeacherContext) {
      // Authenticated but not in teacher context (e.g. landed here in learner
      // or account context). Send to the picker to choose "Teaching".
      window.location.href = PICK_PROFILE_URL;
    }
  }, [loading, isAuthenticated, isTeacherContext, context]);

  if (loading) return <Centered>Loading your dashboard…</Centered>;
  if (!isAuthenticated) return <Centered>Redirecting to sign in…</Centered>;
  if (!isTeacherContext) return <Centered>Taking you to the profile picker…</Centered>;
  return children;
}
