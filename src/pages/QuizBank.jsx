// src/pages/QuizBank.jsx
// ──────────────────────────────────────────────────────────────────────────
// T3 · My question bank (design_handoff_quiz_system/README.md §T3, Phase 6).
//
// This screen used to describe itself as "a searchable library of finalized
// (admin-approved) questions". That stopped being true in Phase 2: a
// teacher's own questions are theirs from the moment they write them, and
// `scope=mine` now returns everything they wrote regardless of review or
// curation state. The old copy told teachers their work was invisible until
// an admin blessed it — the exact belief this refactor exists to remove.
//
// The screen is now ownership-aware: your questions, with the ShikshaCom
// bank's opinion of each shown as a secondary state rather than a gate.
//
// Endpoints:
//   GET   /teacher/question-bank/?scope=mine&state=&subject=&difficulty=&search=
//   GET   /teacher/question-bank/summary/     the four stat cards
//   GET   /teacher/question-bank/filters/     subject + difficulty options
//   PATCH /teacher/questions/:id/bank/        { suggest_to_bank }
//
// Deliberate deviations from the spec, both because the data model cannot
// honestly support them:
//   - No "used in N tests" chip. A Question has ONE quiz FK; pulling one from
//     the bank creates a fresh row with no link back, so that count does not
//     exist. Better absent than invented.
//   - "+ Write a question" opens the quiz builder. Questions live inside a
//     test — there is no standalone question editor to send anyone to.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IoCheckmarkCircle } from "react-icons/io5";
import { FiSearch, FiMessageSquare } from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import "../styles/quiz-bank.css";
import "../styles/quiz-bank-t3.css";

const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };

/* The four curation states, as the teacher sees them. `null` = no state
 * filter. Order matches the spec's chip row. */
const STATE_CHIPS = [
  { id: "", label: "All" },
  { id: "accepted", label: "In site bank" },
  { id: "suggested", label: "Awaiting" },
  { id: "changes_requested", label: "Needs changes" },
  { id: "private", label: "Kept private" },
];

const STATE_CHIP = {
  accepted: { label: "In site bank", tone: "success" },
  suggested: { label: "Awaiting curation", tone: "warning" },
  changes_requested: { label: "Needs changes", tone: "danger" },
  private: { label: "Kept private", tone: "neutral" },
};

export default function QuizBank() {
  const navigate = useNavigate();

  const [scope, setScope] = useState("mine");
  const [subjectId, setSubjectId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({ subjects: [], topics: [], difficulties: [] });
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/teacher/question-bank/filters/")
      .then((res) => setFilters(res.data))
      .catch((err) => console.error("Failed to load bank filters", err));
  }, []);

  const loadSummary = useCallback(() => {
    api.get("/teacher/question-bank/summary/")
      .then((res) => setSummary(res.data))
      // The strip is decoration over the list — a failure here shows "—",
      // it does not take the screen down.
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/teacher/question-bank/", {
        params: {
          scope,
          subject: subjectId || undefined,
          difficulty: difficulty || undefined,
          state: state || undefined,
          search: search || undefined,
        },
      });
      setItems(res.data.results || res.data);
      setSelected(new Set());
    } catch (err) {
      console.error("Failed to load question bank", err);
      setError("Failed to load your question bank.");
    } finally {
      setLoading(false);
    }
  }, [scope, subjectId, difficulty, state, search]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const stats = useMemo(() => [
    { key: "total", value: summary?.total, label: "questions you've written", tone: "blue" },
    { key: "accepted", value: summary?.accepted, label: "in the ShikshaCom bank", tone: "green" },
    { key: "suggested", value: summary?.suggested, label: "awaiting curation", tone: "amber" },
    { key: "changes", value: summary?.changes_requested, label: "admin asked for changes", tone: "red" },
  ], [summary]);

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allShownSelected = items.length > 0 && items.every((q) => selected.has(q.id));

  const toggleAllShown = () => {
    setSelected(allShownSelected ? new Set() : new Set(items.map((q) => q.id)));
  };

  /** Bulk opt-in/out. There is no bulk endpoint, so this is N PATCHes — fine
   *  at the scale of a hand-made selection, and each one still goes through
   *  Question.save()'s invariant rather than a raw UPDATE. Reports partial
   *  failure honestly instead of claiming the whole batch worked. */
  const setSuggestForSelected = async (suggest) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) => api.patch(`/teacher/questions/${id}/bank/`, { suggest_to_bank: suggest }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setBusy(false);

    if (failed === 0) {
      toast.success(
        suggest
          ? `${ids.length} suggested to the ShikshaCom bank.`
          : `${ids.length} kept private to your classes.`
      );
    } else {
      toast.error(`${ids.length - failed} updated, ${failed} failed.`);
    }
    loadItems();
    loadSummary();
  };

  const isMine = scope === "mine";

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">My question bank</h1>
          <p className="ac-head__sub">
            Everything you write lands here automatically. Reuse it in any test,
            and it&rsquo;s suggested to the ShikshaCom bank unless you say otherwise.
          </p>
        </div>
        <div className="ac-head__actions">
          <button
            type="button"
            className="ac-headBtn"
            onClick={() => navigate("/teacher/bank-status")}
          >
            Site bank status
          </button>
          <button
            type="button"
            className="ac-headBtn ac-headBtn--primary"
            onClick={() => navigate("/teacher/quizzes")}
          >
            + Write a question
          </button>
        </div>
      </div>

      <div className="qb3-strip">
        {stats.map((s) => (
          <div className="qb3-stat" key={s.key}>
            <span className={`qb3-stat__tile qb3-stat__tile--${s.tone}`} aria-hidden="true" />
            <div>
              <div className="qb3-stat__value">{s.value ?? "—"}</div>
              <div className="qb3-stat__label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="qb3-filters">
        <div className="qb3-search">
          <FiSearch />
          <input
            placeholder="Search your questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search your questions"
          />
        </div>
        <select
          className="qb3-select" value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject"
        >
          <option value="">All subjects</option>
          {filters.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          className="qb3-select" value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty"
        >
          <option value="">Any difficulty</option>
          {filters.difficulties.map((d) => (
            <option key={d} value={d}>{DIFF_LABEL[d] || d}</option>
          ))}
        </select>
      </div>

      <div className="ac-filterBar">
        <div className="ac-pills">
          {STATE_CHIPS.map((c) => (
            <button
              key={c.id || "all"}
              type="button"
              className={`ac-pill${state === c.id ? " is-active" : ""}`}
              onClick={() => setState(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {/* The school library is not part of T3, but deleting the only way to
            browse it would remove a working feature the spec never asked to
            drop — it stays as a scope toggle. */}
        <div className="qb3-scope">
          <button
            type="button"
            className={`ac-pill${isMine ? " is-active" : ""}`}
            onClick={() => setScope("mine")}
          >
            Mine
          </button>
          <button
            type="button"
            className={`ac-pill${!isMine ? " is-active" : ""}`}
            onClick={() => setScope("school")}
          >
            School library
          </button>
        </div>
      </div>

      {isMine && selected.size > 0 && (
        <div className="qb3-bulk">
          <span className="qb3-bulk__count">{selected.size} selected</span>
          <button
            type="button" className="ac-btn" disabled={busy}
            onClick={() => setSuggestForSelected(true)}
          >
            Suggest to bank
          </button>
          <button
            type="button" className="ac-btn" disabled={busy}
            onClick={() => setSuggestForSelected(false)}
          >
            Keep private
          </button>
          <button
            type="button" className="ac-btn" onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState plain label="Loading your questions" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadItems} />
      ) : items.length === 0 ? (
        <section className="ac-listCard">
          <EmptyState
            plain
            icon="quiz"
            title={isMine ? "Nothing here yet" : "Nothing shared yet"}
            message={
              isMine
                ? "Write a question in any test and it lands here automatically — approved or not."
                : "No questions from other teachers of your subjects have been accepted into the site bank yet."
            }
          />
        </section>
      ) : (
        <section className="ac-listCard">
          {isMine && (
            <label className="qb3-selectAll">
              <input
                type="checkbox"
                checked={allShownSelected}
                onChange={toggleAllShown}
              />
              Select all {items.length} shown
            </label>
          )}

          {items.map((q) => {
            const chip = STATE_CHIP[q.bank_state] || STATE_CHIP.private;
            const correctId = q.choices?.find((c) => c.is_correct)?.id;
            return (
              <div className="ac-row ac-row--flush qb3-row" key={q.id}>
                {isMine && (
                  <input
                    type="checkbox"
                    className="qb3-row__check"
                    checked={selected.has(q.id)}
                    onChange={() => toggleOne(q.id)}
                    aria-label={`Select: ${q.text.slice(0, 40)}`}
                  />
                )}

                <div className="qb3-row__body">
                  <p className="qb3-row__text">{q.text}</p>

                  <div className="qb3-row__chips">
                    {q.chapter_label && (
                      <span className={`qb3-chip qb3-chip--${q.chapter_is_custom ? "custom" : "chapter"}`}>
                        {q.chapter_label}
                      </span>
                    )}
                    <span className="qb3-chip qb3-chip--plain">
                      {DIFF_LABEL[q.difficulty] || q.difficulty}
                    </span>
                    <span className="qb3-chip qb3-chip--plain">
                      {q.marks} {q.marks === 1 ? "mark" : "marks"}
                    </span>
                    <span className="qb3-chip qb3-chip--plain">
                      from &ldquo;{q.quiz_title}&rdquo;
                    </span>
                    {!isMine && q.author_name && (
                      <span className="qb3-chip qb3-chip--plain">by {q.author_name}</span>
                    )}
                  </div>

                  {/* The admin's actual words, on the actual question. Without
                      this a teacher is told "changes requested" with no way to
                      find out which changes. */}
                  {q.bank_state === "changes_requested" && q.bank_feedback && (
                    <div className="qb3-feedback">
                      <FiMessageSquare />
                      <span>{q.bank_feedback}</span>
                    </div>
                  )}

                  {correctId && (
                    <div className="qb3-row__answer">
                      <IoCheckmarkCircle />
                      {q.choices.find((c) => c.id === correctId)?.text}
                    </div>
                  )}
                </div>

                <div className="qb3-row__side">
                  <span className={`qb3-state qb3-state--${chip.tone}`}>{chip.label}</span>
                  <button
                    type="button"
                    className="ac-btn"
                    onClick={() => navigate(`/teacher/quizzes/${q.quiz_id}/edit`)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
