import React from "react";

/**
 * ErrorBoundary — wrap the app so a render-time crash shows a readable message
 * instead of a blank white screen. Without this, any thrown error in a teacher
 * page (a bad API shape, an undefined field, etc.) unmounts everything and you
 * just see white with the real cause buried in the console.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaced in the console for debugging; replace with your logger if any.
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
        }}>
          <div style={{
            maxWidth: 520, background: "#fff", border: "1px solid #eee",
            borderRadius: 12, padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,.06)",
          }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#b91c1c" }}>
              Something went wrong on this page
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#555", lineHeight: 1.6 }}>
              The dashboard hit an error while rendering. The details are below and in
              your browser console.
            </p>
            <pre style={{
              background: "#f5f5f5", borderRadius: 8, padding: 12, fontSize: 12,
              color: "#333", overflow: "auto", maxHeight: 160, margin: "0 0 16px",
            }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
                padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
