/**
 * FILE: TEACHER_DASHBOARD/src/components/ConfirmDialog.jsx
 *
 * Centered confirmation modal — teacher-side counterpart of the
 * student dashboard's ConfirmDialog. Same API, different accent
 * colour (blue #3b5c7c) to match teacher theme.
 *
 * Usage:
 *   <ConfirmDialog
 *     dialog={dlgState}
 *     onClose={() => setDlgState(null)}
 *   />
 */

import { useEffect } from "react";
import "../styles/confirmDialog.css";

export default function ConfirmDialog({ dialog, onClose }) {
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, onClose]);

  if (!dialog) return null;

  const {
    title = "Are you sure?",
    message = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    busy = false,
    tone,   // e.g. "skill" — retints --tcd-primary/--tcd-danger via CSS, see confirmDialog.css
    onConfirm,
  } = dialog;

  const handleConfirm = () => {
    if (busy) return;
    onConfirm?.();
  };

  return (
    <div
      className={`tcd__overlay${tone ? ` tcd__overlay--${tone}` : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tcd__title"
      onClick={onClose}
    >
      <div className="tcd__dialog" onClick={(e) => e.stopPropagation()}>
        <h4 id="tcd__title" className="tcd__title">{title}</h4>
        {message && <p className="tcd__message">{message}</p>}
        <div className="tcd__actions">
          <button
            type="button"
            className="tcd__btn tcd__btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`tcd__btn ${danger ? "tcd__btn--danger" : "tcd__btn--primary"}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
