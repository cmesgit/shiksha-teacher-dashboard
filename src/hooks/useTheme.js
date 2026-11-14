// Dark-mode state for Dashboards v2.
//
// Writes `data-theme="dark"` onto <html>, which is what the dark token block
// in shared/tokens.css keys off. Deliberately NOT driven by
// `prefers-color-scheme`: a system-level preference would flip every existing
// screen at once, and screens that still carry literal hex values do not
// survive that. Opt-in only, persisted per browser.
//
// The attribute is set on <html> rather than a wrapper div so the tokens
// cascade into portalled content (modals, toasts) too.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sk_theme";

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    // Private mode / disabled storage — fall back to light rather than throw.
    return "light";
  }
}

function apply(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

export default function useTheme() {
  const [theme, setTheme] = useState(readStored);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* non-fatal: the theme still applies for this session */
    }
  }, [theme]);

  // Clean up when the last v2 screen unmounts, so navigating back to a
  // legacy screen that has no dark styling doesn't inherit dark tokens.
  useEffect(() => () => apply("light"), []);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  return { theme, toggleTheme, setTheme };
}
