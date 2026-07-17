/**
 * ClassPickerLanding.jsx — top-level landing for the CONTENT nav items
 * (Assignments · Study Materials · Recordings) that are managed per class.
 *
 * The Academy Dashboard.html sidebar promotes these to first-class nav
 * destinations, but the underlying screens are scoped to a single class
 * (/teacher/classes/:subjectId/<sub>). This page closes that loose end:
 * pick a class → land on the existing per-class management screen. No dead
 * links, and the visual language matches the mockup's card grid.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import NavIcon from "../components/NavIcon";
import { LoadingState } from "../components/StateViews";

const pickFirstText = (...values) =>
  values.find((v) => typeof v === "string" && v.trim().length > 0) || "";

export default function ClassPickerLanding({ title, subtitle, icon, sub }) {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/courses/teacher/my-classes/");
        const normalized = (res.data || []).map((s) => ({
          subjectId: s.subject_id || s.id,
          subjectName: pickFirstText(s.subject_name, s.name),
          courseTitle: pickFirstText(s.course_title, s.class_name, s.course),
          board: pickFirstText(s.board, s.board_name, s.board_title, s.board?.name),
          stream: pickFirstText(s.stream, s.stream_name, s.stream_title, s.stream?.name),
        }));
        if (alive) setSubjects(normalized);
      } catch (err) {
        console.error("Failed to load classes", err);
        if (alive) setSubjects([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <LoadingState label={`Loading ${title.toLowerCase()}`} />;

  const metaOf = (s) => [s.courseTitle, s.board, s.stream].filter(Boolean).join(" • ");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", animation: "fadeUp .28s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "#e6edee", color: "#425f7f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <NavIcon name={icon} size={19} color="#425f7f" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontFamily: '"Montserrat", sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: "-.4px", color: "#1a2c33" }}>{title}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7c83" }}>{subtitle}</p>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e5eaed", borderRadius: 12, padding: "40px 24px", textAlign: "center", color: "#6b7c83", marginTop: 18 }}>
          No classes assigned yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginTop: 18 }}>
          {subjects.map((s) => (
            <button
              key={s.subjectId}
              type="button"
              onClick={() => navigate(`/teacher/classes/${s.subjectId}/${sub}`)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#cfdbe6"; e.currentTarget.style.background = "#f8fafb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5eaed"; e.currentTarget.style.background = "#fff"; }}
              style={{
                textAlign: "left", cursor: "pointer", background: "#fff",
                border: "1px solid #e5eaed", borderRadius: 12, padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(26,44,51,.06)", transition: "all .15s",
                display: "flex", flexDirection: "column", gap: 10,
                fontFamily: '"Poppins", system-ui, sans-serif',
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1a2c33" }}>{s.subjectName || "Class"}</span>
                <span style={{ color: "#9ca3af", display: "inline-flex" }}>
                  <NavIcon name={icon} size={16} color="#9ca3af" />
                </span>
              </div>
              {metaOf(s) && (
                <span style={{ fontSize: 11, color: "#6b7c83" }}>{metaOf(s)}</span>
              )}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#425f7f", marginTop: 2 }}>Manage {title.toLowerCase()} →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
