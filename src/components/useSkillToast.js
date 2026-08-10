// components/useSkillToast.js — split from SkillToast.jsx so each file only
// exports one kind of thing (satisfies react-refresh/only-export-components).
import { useContext } from "react";
import { SkillToastContext } from "./SkillToastContext.js";

export function useSkillToast() {
  const ctx = useContext(SkillToastContext);
  if (!ctx) throw new Error("useSkillToast() must be used inside <SkillToastProvider>");
  return ctx;
}
