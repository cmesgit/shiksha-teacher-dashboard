/**
 * src/pages/TeacherPasswordSettings.jsx  ·  REPLACED
 * ────────────────────────────────────────────────────
 * The separate teacher password no longer exists. There is ONE password
 * per account, used for both learner login and entering teacher context.
 *
 * This component replaces the old "set teacher password" page.
 * It redirects teachers to the standard Change Password page instead,
 * and explains the change.
 *
 * The route for this page in TeacherRoutes.jsx can stay as-is
 * (settings/teacher-password) — it just now explains the model and
 * links to the regular change-password flow.
 */
import { useNavigate } from "react-router-dom";

export default function TeacherPasswordSettings() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 480, padding: 32 }}>
      <h2 style={{ fontFamily: "Montserrat, sans-serif", marginBottom: 12 }}>
        Password settings
      </h2>

      <div style={{
        background: "#eff6ff", border: "1.5px solid #bfdbfe",
        borderRadius: 10, padding: "16px 18px", marginBottom: 24,
        fontSize: 14, lineHeight: 1.6, color: "#1e3a5f",
      }}>
        <strong>One password for everything.</strong> Your account now uses a single
        password for both learning and teaching. There's no separate teacher
        password anymore — the same password you log in with is used to confirm
        when you switch to teacher mode.
      </div>

      <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 24, lineHeight: 1.6 }}>
        To change your password, use the standard Change Password page. The new
        password will work for both your learner login and entering teacher mode.
      </p>

      <button
        onClick={() => navigate("/teacher/change-password")}
        style={{
          background: "#2563eb", color: "#fff", border: "none",
          borderRadius: 8, padding: "11px 22px", fontSize: 14,
          fontWeight: 600, cursor: "pointer",
        }}
      >
        Change password →
      </button>
    </div>
  );
}
