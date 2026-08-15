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
import "../styles/teacherPasswordSettings.css";

export default function TeacherPasswordSettings() {
  const navigate = useNavigate();

  return (
    <div className="tps-settings-page">
      <h2 className="tps-settings-title">Password settings</h2>

      <div className="tps-settings-notice">
        <strong>One password for everything.</strong> Your account now uses a single
        password for both learning and teaching. There's no separate teacher
        password anymore — the same password you log in with is used to confirm
        when you switch to teacher mode.
      </div>

      <p className="tps-settings-body">
        To change your password, use the standard Change Password page. The new
        password will work for both your learner login and entering teacher mode.
      </p>

      <button className="tps-settings-btn" onClick={() => navigate("/teacher/change-password")}>
        Change password →
      </button>
    </div>
  );
}
