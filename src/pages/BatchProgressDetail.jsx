// PLACEMENT: src/pages/BatchProgressDetail.jsx
//
// The "tick module": for one batch, the teacher sees every subject → chapter in
// the course and ticks each chapter covered/not-covered, with an optional note.
// Coverage is per-batch, so two batches of the same course progress separately.
// Only subjects the teacher is assigned to are editable; the rest are shown
// read-only so they still see the whole course's progress.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FiCheck, FiLock } from "react-icons/fi";
import api from "../api/apiClient";
import "../styles/batch-progress.css";
import { LoadingState } from "../components/StateViews";

function Bar({ percent }) {
  return (
    <div className="bp-bar" aria-hidden>
      <div className="bp-bar__fill" style={{ width: `${Math.min(100, percent || 0)}%` }} />
    </div>
  );
}

export default function BatchProgressDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [data, setData] = useState(null);
  const [mySubjects, setMySubjects] = useState(null); // Set of subject ids, or null while loading
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState({});      // chapterId -> true
  const [notes, setNotes] = useState({});              // chapterId -> draft string
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [progress, classes] = await Promise.allSettled([
        api.get(`/courses/batches/${batchId}/progress/`),
        api.get(`/courses/teacher/my-classes/`),
      ]);
      if (cancel) return;

      if (progress.status === "fulfilled") {
        const d = progress.value.data;
        setData(d);
        const draft = {};
        (d.subjects || []).forEach((s) =>
          s.chapters.forEach((c) => { draft[c.id] = c.note || ""; })
        );
        setNotes(draft);
      } else {
        setError("Couldn't load this batch. You may not teach any subject in its course.");
      }

      if (classes.status === "fulfilled") {
        const ids = new Set(
          (classes.value.data || []).map((c) => c.subject_id || c.id)
        );
        setMySubjects(ids);
      } else {
        setMySubjects(new Set());
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [batchId]);

  const label = useMemo(() => {
    if (state?.batchName) return `${state.batchName}${state.batchCode ? ` · ${state.batchCode}` : ""}`;
    if (data?.batch) return `${data.batch.name}${data.batch.code ? ` · ${data.batch.code}` : ""}`;
    return "Batch";
  }, [state, data]);

  const canEdit = (subjectId) => !!mySubjects && mySubjects.has(subjectId);

  // Merge a coverage response back into state, updating subject + overall totals.
  const applyResp = (resp) => {
    setData((prev) => {
      if (!prev) return prev;
      const subjects = prev.subjects.map((s) => {
        if (s.id !== resp.subject_id) return s;
        const chapters = s.chapters.map((c) =>
          c.id === resp.chapter_id
            ? { ...c, is_covered: resp.is_covered, covered_at: resp.covered_at, note: resp.note }
            : c
        );
        return {
          ...s,
          chapters,
          chapters_done: resp.subject_chapters_done,
          percent: resp.subject_percent,
        };
      });
      const done = subjects.reduce((n, s) => n + (s.chapters_done || 0), 0);
      const total = prev.chapters_total || subjects.reduce((n, s) => n + (s.chapters_total || 0), 0);
      return {
        ...prev,
        subjects,
        chapters_done: done,
        chapters_left: total - done,
        percent: total ? Math.round((done / total) * 100) : 0,
      };
    });
  };

  const post = async (chapter, done, note) => {
    setSavingIds((m) => ({ ...m, [chapter.id]: true }));
    setError("");
    try {
      const res = await api.post(
        `/courses/batches/${batchId}/chapters/${chapter.id}/coverage/`,
        { done, note }
      );
      applyResp(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Couldn't save that. Try again.");
    } finally {
      setSavingIds((m) => { const n = { ...m }; delete n[chapter.id]; return n; });
    }
  };

  const toggle = (subject, chapter) => {
    if (!canEdit(subject.id) || savingIds[chapter.id]) return;
    post(chapter, !chapter.is_covered, notes[chapter.id] ?? chapter.note ?? "");
  };

  const commitNote = (subject, chapter) => {
    if (!canEdit(subject.id)) return;
    const draft = notes[chapter.id] ?? "";
    if (draft === (chapter.note || "")) return; // unchanged
    post(chapter, chapter.is_covered, draft);
  };

  return (
    <div className="bp-wrapper">
      <button className="bp-back-btn" onClick={() => navigate("/teacher/batch-progress")}>
        <IoChevronBack /> All batches
      </button>

      <div className="bp-container">
        <div className="bp-top bp-top--detail">
          <div>
            <h2>{label}</h2>
            {(state?.courseTitle || "") && <p className="bp-sub">{state.courseTitle}</p>}
          </div>
          {data && (
            <div className="bp-overall">
              <span className="bp-overall-pct">{data.percent}%</span>
              <span className="bp-muted">{data.chapters_done}/{data.chapters_total} chapters</span>
            </div>
          )}
        </div>

        {data && <div className="bp-overall-bar"><Bar percent={data.percent} /></div>}

        {error && <div className="bp-error" role="alert">{error}</div>}

        {loading ? (
          <LoadingState plain label="Loading batch progress" />
        ) : !data ? (
          <p className="bp-muted">Nothing to show.</p>
        ) : (data.subjects || []).length === 0 ? (
          <p className="bp-muted">This course has no chapters yet.</p>
        ) : (
          <div className="bp-subjects">
            {data.subjects.map((s) => {
              const editable = canEdit(s.id);
              return (
                <section className="bp-subject" key={s.id}>
                  <div className="bp-subject-head">
                    <div className="bp-subject-title">
                      <span>{s.name}</span>
                      {!editable && (
                        <span className="bp-readonly" title="You don't teach this subject">
                          <FiLock /> read-only
                        </span>
                      )}
                    </div>
                    <span className="bp-muted">{s.chapters_done}/{s.chapters_total} · {s.percent}%</span>
                  </div>
                  <Bar percent={s.percent} />

                  {s.chapters.length === 0 ? (
                    <p className="bp-muted bp-muted--indent">No chapters in this subject.</p>
                  ) : (
                    <ul className="bp-chapters">
                      {s.chapters.map((c) => {
                        const saving = !!savingIds[c.id];
                        return (
                          <li key={c.id} className={`bp-chapter${c.is_covered ? " covered" : ""}`}>
                            <button
                              type="button"
                              className={`bp-check${c.is_covered ? " on" : ""}`}
                              disabled={!editable || saving}
                              aria-pressed={c.is_covered}
                              aria-label={c.is_covered ? `Mark "${c.title}" not covered` : `Mark "${c.title}" covered`}
                              onClick={() => toggle(s, c)}
                            >
                              {c.is_covered ? <FiCheck /> : null}
                            </button>

                            <div className="bp-chapter-body">
                              <span className="bp-chapter-title">{c.title}</span>
                              {editable ? (
                                <input
                                  className="bp-note-input"
                                  placeholder="Add a note (optional)"
                                  value={notes[c.id] ?? ""}
                                  disabled={saving}
                                  onChange={(e) =>
                                    setNotes((n) => ({ ...n, [c.id]: e.target.value }))
                                  }
                                  onBlur={() => commitNote(s, c)}
                                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                />
                              ) : (
                                c.note ? <span className="bp-note-ro">“{c.note}”</span> : null
                              )}
                            </div>

                            {saving && <span className="bp-saving" aria-hidden>saving…</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
