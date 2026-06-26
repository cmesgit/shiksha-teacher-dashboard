// PLACEMENT: teacher_ui/src/pages/ClassesList.jsx  (replace whole file)
// DEPLOY:    /app/teacher_ui/src/pages/ClassesList.jsx
//
// WHAT CHANGED: captures course_id / course_title from /courses/teacher/my-classes/
// (already returned by the API) and adds a "Class chat" button to each class
// card. It opens the SAME per-course group room students reach from their course
// page (the room is keyed by course id), via Chat.jsx which accepts
// { courseId, courseTitle }. Tapping the card still opens the subject as before.

import { useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import "../styles/classes-list.css";

export default function ClassesList() {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pickFirstText = (...values) => {
      const found = values.find(
        (value) => typeof value === "string" && value.trim().length > 0
      );
      return found || "";
    };

    async function fetchSubjects() {
      try {
        const res = await api.get(
          "/courses/teacher/my-classes/"
        );

        // Normalize API response so subjectId is always available
        const normalized = res.data.map((s) => ({
          subjectId: s.subject_id || s.id,
          subjectName: pickFirstText(s.subject_name, s.name),
          courseId: s.course_id || "",
          courseTitle: pickFirstText(s.course_title, s.class_name, s.course),
          board: pickFirstText(
            s.board,
            s.board_name,
            s.board_title,
            s.board?.name
          ),
          stream: pickFirstText(
            s.stream,
            s.stream_name,
            s.stream_title,
            s.stream?.name
          ),
        }));

        setSubjects(normalized);

      } catch (err) {
        console.error("Failed to load teacher subjects", err);
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSubjects();
  }, []);

  if (loading) return <div>Loading classes...</div>;

  const getClassMeta = (subject) =>
    [subject.courseTitle, subject.board, subject.stream]
      .filter(Boolean)
      .join(" • ");

  const openClassChat = (e, subject) => {
    e.stopPropagation(); // don't open the subject dashboard
    if (!subject.courseId) return;
    navigate("/teacher/chat", {
      state: { courseId: subject.courseId, courseTitle: subject.courseTitle },
    });
  };

  return (
    <div className="cl-wrapper">

      <button
        className="cl-back-btn"
        onClick={() => navigate("/teacher/dashboard")}
      >
        <IoChevronBack /> Back
      </button>

      <div className="cl-container">

        <div className="cl-top">
          <h2>My Classes</h2>
        </div>

        <div className="cl-grid">

          {subjects.length === 0 && (
            <p style={{ opacity: 0.6 }}>
              No subjects assigned.
            </p>
          )}

          {subjects.map((subject) => (
            <div
              className="cl-card"
              key={subject.subjectId}
              onClick={() =>
                navigate(
                  `/teacher/classes/${subject.subjectId}`
                )
              }
            >

              <p className="cl-card-name">
                {subject.subjectName}
              </p>

              <div className="cl-card-right">

                <span className="cl-card-label">
                  {getClassMeta(subject)}
                </span>

                {subject.courseId && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => openClassChat(e, subject)}
                    onKeyDown={(e) => { if (e.key === "Enter") openClassChat(e, subject); }}
                    style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#1b9c85,#1dcaab)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    💬 Class chat
                  </span>
                )}

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>
  );
}
