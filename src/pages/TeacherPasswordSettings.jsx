/**
 * teacher_dashboard/src/pages/TeacherPasswordSettings.jsx
 *
 * Lets teachers set or change their SEPARATE teacher-context password.
 * Add this route in TeacherRoutes.jsx:
 *   <Route path="settings/teacher-password" element={<TeacherPasswordSettings />} />
 * and add a link in the sidebar or profile settings page.
 */
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function TeacherPasswordSettings() {
  const { setTeacherPassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg(null);
    if (next !== confirm) {
      setMsg({ type: "err", text: "New passwords don't match." });
      return;
    }
    if (next.length < 8) {
      setMsg({ type: "err", text: "Password must be at least 8 characters." });
      return;
    }
    setBusy(true);
    try {
      await setTeacherPassword(current, next);
      setMsg({ type: "ok", text: "Teacher password updated successfully." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      setMsg({ type: "err", text: e?.message || "Could not update password." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, padding: 24 }}>
      <h2 style={{ fontFamily: "Montserrat, sans-serif", marginBottom: 8 }}>
        Teacher password
      </h2>
      <p style={{ opacity: 0.65, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        This password gates entering <strong>teaching mode</strong>. It is
        separate from your learner login password, so your teaching identity
        is independently secured.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={labelStyle}>
          Current teacher password
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
        </label>

        <label style={labelStyle}>
          New teacher password
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
          />
        </label>

        <label style={labelStyle}>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
          />
        </label>

        <button
          onClick={submit}
          disabled={busy || !current || !next || !confirm}
          style={btnStyle}
        >
          {busy ? "Updating…" : "Update teacher password"}
        </button>

        {msg && (
          <p style={{ color: msg.type === "ok" ? "#1b9c85" : "#b23b3b", fontSize: 14, margin: 0 }}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 13.5, fontWeight: 600, color: "#333",
};
const inputStyle = {
  padding: "10px 12px", border: "1px solid #dcdcdc", borderRadius: 8,
  fontSize: 14, fontFamily: "inherit",
};
const btnStyle = {
  padding: "11px 0", background: "linear-gradient(135deg,#425f7f,#5a7fa0)",
  color: "#fff", border: "none", borderRadius: 9, fontSize: 14,
  fontWeight: 700, cursor: "pointer", opacity: 1,
};
