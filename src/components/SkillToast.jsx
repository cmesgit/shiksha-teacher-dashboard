// components/SkillToast.jsx
//
// Every mutation in the Skill Dev design toasts (bottom-centre, ~2s); no
// shared toast exists in this app. Scoped to Skill Dev's layout: mount
// <SkillToastProvider> once at SkillDevLayout's root and call
// useSkillToast() from any descendant. Byte-identical to the student copy.
import { useCallback, useRef, useState } from "react";
import { SkillToastContext } from "./SkillToastContext.js";

export function SkillToastProvider({ children }) {
  const [msg, setMsg] = useState("");
  const timer = useRef(null);

  const showToast = useCallback((text, ms = 2000) => {
    clearTimeout(timer.current);
    setMsg(text);
    timer.current = setTimeout(() => setMsg(""), ms);
  }, []);

  return (
    <SkillToastContext.Provider value={showToast}>
      {children}
      {msg && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink)", color: "#fff", padding: "10px 18px",
          borderRadius: "var(--r-md)", fontSize: 12.5, fontWeight: 600,
          boxShadow: "var(--sh-dropdown)", zIndex: 1200, animation: "toastIn .25s ease both",
        }}>{msg}</div>
      )}
    </SkillToastContext.Provider>
  );
}
