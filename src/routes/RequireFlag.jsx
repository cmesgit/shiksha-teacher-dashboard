// Route gate for an admin-flippable GlobalSettings feature flag.
//
// design_handoff_dashboards_v2 Phase D2. Built for `dashboards_v2_enabled`,
// but deliberately generic — the next flag-gated route should reuse this
// rather than hand-rolling the same three branches again.
//
// Mirrors RequireTrack's loading contract on purpose: while /accounts/me/ is
// in flight we render NEITHER the children nor the redirect. Rendering the
// children would mount a gated screen and fire its API calls before the gate
// is known; redirecting would bounce a legitimate user off a URL they are
// allowed to open. A neutral placeholder is the only option wrong for nobody.
//
// ⚠ The fail-closed direction matters. `featureFlags` defaults to a shape
// that does not contain unknown keys, so a flag the backend has not been
// taught to send reads as `undefined` → falsy → gate CLOSED. That is correct
// for a real gate: a frontend deployed ahead of its backend must hide the
// feature, not reveal it.

import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RequireFlag({ flag, fallback = "/teacher/dashboard", children }) {
  const { featureFlags, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", color: "var(--ink-muted)", fontSize: 14,
        }}
        aria-busy="true"
      >
        Loading…
      </div>
    );
  }

  if (!featureFlags?.[flag]) return <Navigate to={fallback} replace />;
  return children;
}
