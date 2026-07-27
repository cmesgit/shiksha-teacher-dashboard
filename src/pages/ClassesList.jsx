// src/pages/ClassesList.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Classes" (teacher) — a card grid of the batches this teacher
// teaches this term, with a syllabus-progress bar per batch. Matches the
// design handoff's Classes screen (Academy Dashboard.dc.html's "classes"
// branch of pageCards, ~line 3313): avatar chip with the batch's short code,
// a teal "{n} students" badge, title + subject/board subline, a progress bar,
// and a footer with the chapter count and an "Open batch" button.
//
// This screen used to be a flat list of SUBJECTS (GET /courses/teacher/
// my-classes/), which carries no progress/chapter data — that's why the old
// screen couldn't show any of this. The design wants BATCHES with real
// syllabus coverage, so this now reads GET /courses/teacher/my-batches/
// instead (the same endpoint + flattening BatchProgress.jsx already uses:
// groups.flatMap(g => g.batches.map(b => ({...b, courseTitle: g.course_title})))).
//
// "Open batch" reuses BatchProgress.jsx's exact navigation to the per-batch
// chapter checklist (BatchProgressDetail) — that screen is the actual home
// for a batch's syllabus progress now that CONTENT areas (Assignments,
// Quizzes, Study Materials, ...) are flattened into their own top-level,
// subject-filterable pages. The old subject-hub route (/teacher/classes/
// :subjectId) still exists for legacy deep links but is no longer where a
// card click should go.
//
// The old card's real "💬 Class chat" shortcut isn't shown in the design, but
// per this project's standing rule (don't drop real functionality just
// because the mockup is silent) it survives as a small icon action beside
// "Open batch". /my-batches groups by course_title, not course_id, so the
// chat button needs a courseTitle → courseId lookup — built from the shared
// TeacherClassesContext (one GET /courses/teacher/my-classes/, already fired
// for every other Academy screen, not a new request of our own).
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMessageCircle } from "react-icons/fi";
import api from "../api/apiClient";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import "../styles/academyScreens.css";

// "Class 10-A" → "10-A" — used only as a fallback when a batch has no
// separate short `code` field of its own.
const stripClassPrefix = (name) => (name || "").replace(/^Class\s+/i, "").trim();

export default function ClassesList() {
  const navigate = useNavigate();
  const { classes, loading: classesLoading, error: classesError } = useTeacherClasses();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/courses/teacher/my-batches/");
        const payload = res.data || {};
        if (!cancelled) {
          setGroups(Array.isArray(payload.groups) ? payload.groups : []);
        }
      } catch (err) {
        console.error("Failed to load batches", err);
        if (!cancelled) {
          setGroups([]);
          setError("Failed to load your classes.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Same flattening BatchProgress.jsx uses: one row per batch, carrying its
  // group's course title along.
  const flatBatches = useMemo(
    () => groups.flatMap((g) => (g.batches || []).map((b) => ({ ...b, courseTitle: g.course_title }))),
    [groups]
  );

  // courseTitle → courseId, from the shared classes list (the only place a
  // course id is available — /my-batches only ever returns course_title).
  const courseIdByTitle = useMemo(() => {
    const map = new Map();
    for (const c of classes || []) {
      if (c.courseTitle && c.courseId && !map.has(c.courseTitle)) {
        map.set(c.courseTitle, c.courseId);
      }
    }
    return map;
  }, [classes]);

  const openBatch = (b) => {
    navigate(`/teacher/batch-progress/${b.id}`, {
      state: { batchName: b.name, batchCode: b.code, courseTitle: b.courseTitle },
    });
  };

  const openClassChat = (courseId, courseTitle) => {
    navigate("/teacher/chat", { state: { courseId, courseTitle } });
  };

  if (classesLoading || loading) {
    return <div className="ac-screen"><LoadingState label="Loading classes" /></div>;
  }
  if (classesError) {
    return <div className="ac-screen"><ErrorState message={classesError} /></div>;
  }
  if (error) {
    return <div className="ac-screen"><ErrorState message={error} /></div>;
  }

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Classes</h1>
          <p className="ac-head__sub">Batches you teach this term.</p>
        </div>
      </div>

      {flatBatches.length === 0 ? (
        <section className="ac-listCard">
          <EmptyState
            plain
            icon="book"
            title="No batches to track yet"
            message="Batches are created by an admin and tied to the courses you teach. Once a batch exists for one of your courses, it shows up here."
          />
        </section>
      ) : (
        <div className="ac-cardGrid">
          {flatBatches.map((b) => {
            const avatarText = b.code || stripClassPrefix(b.name) || b.name;
            const percent = Math.min(100, Math.max(0, b.percent || 0));
            const courseId = courseIdByTitle.get(b.courseTitle);
            const footText = `Ch ${b.chapters_done ?? 0} of ${b.chapters_total ?? 0} covered`;

            return (
              <div key={b.id} className="ac-card">
                <div className="ac-card__top">
                  <div className="ac-card__avatar">{avatarText}</div>
                  <span className="ac-tag ac-tag--teal">{b.seats_taken ?? 0} students</span>
                </div>

                <div>
                  <div className="ac-card__title">{b.name}</div>
                  <div className="ac-card__meta">
                    {[b.courseTitle, b.year].filter(Boolean).join(" · ")}
                  </div>
                </div>

                <div className="ac-card__bar">
                  <div className="ac-card__barTrack">
                    <div className="ac-card__barFill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="ac-card__pct">{percent}%</span>
                </div>

                <div className="ac-card__foot">
                  <span className="ac-card__footText">
                    {footText}
                    {!b.is_active && (
                      <span style={{ color: "var(--warning)", fontWeight: 700 }}> · Closed</span>
                    )}
                  </span>
                  <div className="ac-card__actions">
                    {courseId && (
                      <button
                        type="button"
                        className="ac-cardBtn ac-cardBtn--icon"
                        aria-label="Class chat"
                        title="Class chat"
                        onClick={() => openClassChat(courseId, b.courseTitle)}
                      >
                        <FiMessageCircle size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="ac-cardBtn ac-cardBtn--primary"
                      onClick={() => openBatch(b)}
                    >
                      Open batch
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
