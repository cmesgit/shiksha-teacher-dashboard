// src/contexts/ToastContext.jsx — minimal app-wide toast, for the many
// screens that used a blocking native alert() for errors/notices instead
// (SkillToastContext.js already covers this for Skill Dev's own layout;
// this is the app-wide equivalent every other screen was missing).
import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

const COLORS = {
  success: { bg: "var(--success)", fg: "#fff" },
  error: { bg: "var(--danger)", fg: "#fff" },
  info: { bg: "var(--ink, #0f172a)", fg: "#fff" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ message, type = "info", duration = 3500 }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", gap: 8, zIndex: 2000,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const c = COLORS[t.type] || COLORS.info;
          return (
            <div
              key={t.id}
              role="status"
              style={{
                background: c.bg, color: c.fg, padding: "10px 18px",
                borderRadius: 10, fontSize: 13.5, fontWeight: 600,
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)", maxWidth: "80vw",
                textAlign: "center",
              }}
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
