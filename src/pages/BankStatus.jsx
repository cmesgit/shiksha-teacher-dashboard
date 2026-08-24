// src/pages/BankStatus.jsx
// ──────────────────────────────────────────────────────────────────────────
// T4 · ShikshaCom bank status (design_handoff_quiz_system §T4, Phase 6).
//
// The screen exists to answer one anxiety left over from the old flow: "is
// something of mine stuck waiting for an admin?" The answer is no, and the
// head says so outright — a teacher's tests run regardless. Curation only
// decides what joins the shared library.
//
// Endpoints:
//   GET   /teacher/bank-status/   counts + auto-suggest default + latest note
//   PATCH /teacher/bank-status/   { auto_suggest_questions }
// ──────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClock, FiMessageSquare, FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import { LoadingState, ErrorState } from "../components/StateViews";
import "../styles/academyScreens.css";
import "../styles/bank-status.css";

/* The four states, in the spec's order. `filter` is the state= value T3
 * understands, so every row can hand the teacher straight to its questions. */
const STATE_ROWS = [
  {
    key: "accepted", tone: "green", Icon: FiCheckCircle,
    title: "Accepted into the ShikshaCom bank",
    sub: "Other teachers of your subjects can use these, and they feed student chapter practice.",
    filter: "accepted",
  },
  {
    key: "suggested", tone: "amber", Icon: FiClock,
    title: "Waiting for curation",
    sub: "An admin hasn't looked yet. Your own tests are unaffected.",
    filter: "suggested",
  },
  {
    key: "changes_requested", tone: "red", Icon: FiMessageSquare,
    title: "Changes requested",
    sub: "An admin asked for an edit before these can join the shared bank.",
    filter: "changes_requested",
  },
  {
    key: "private", tone: "grey", Icon: FiLock,
    title: "Kept private",
    sub: "Yours alone — never suggested, never reviewed.",
    filter: "private",
  },
];

const CURATION_STEPS = [
  "You write a question in any test. It's yours immediately.",
  "Unless you opted out, it's also suggested to the ShikshaCom bank.",
  "An admin reviews it — accept, or ask you for a change.",
  "Accepted questions join the shared library other teachers draw on.",
];

export default function BankStatus() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/teacher/bank-status/");
      setData(res.data);
    } catch (err) {
      console.error("Failed to load bank status", err);
      setError("Couldn't load your ShikshaCom bank status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAutoSuggest = async () => {
    const next = !data.auto_suggest_questions;
    setSaving(true);
    // Optimistic: the switch is the thing being manipulated, so it must move
    // under the finger. Rolled back on failure rather than left lying.
    setData((d) => ({ ...d, auto_suggest_questions: next }));
    try {
      await api.patch("/teacher/bank-status/", { auto_suggest_questions: next });
      toast.success(
        next
          ? "New questions will be suggested automatically."
          : "New questions will stay private unless you say otherwise."
      );
    } catch (err) {
      setData((d) => ({ ...d, auto_suggest_questions: !next }));
      toast.error(err.response?.data?.detail || "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  };

  const goToState = (filter) => navigate(`/teacher/quiz-bank?state=${filter}`);

  if (loading) return <div className="ac-screen"><LoadingState label="Loading bank status" /></div>;
  if (error) return <div className="ac-screen"><ErrorState message={error} onRetry={load} /></div>;

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Your questions in the ShikshaCom bank</h1>
          <p className="ac-head__sub">
            You never wait for this. Your tests run either way — an admin only
            decides what joins the shared library other teachers and students
            can draw on.
          </p>
        </div>
      </div>

      <div className="bs-layout">
        <div className="bs-main">
          <div className="bs-auto">
            <span className="bs-auto__tile" aria-hidden="true"><FiCheckCircle /></span>
            <div className="bs-auto__text">
              <div className="bs-auto__title">Suggest my new questions automatically</div>
              <div className="bs-auto__sub">
                {data.auto_suggest_questions ? "On." : "Off."} You can turn it off
                for any single question in the builder.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.auto_suggest_questions}
              aria-label="Suggest my new questions automatically"
              disabled={saving}
              className={`bs-switch${data.auto_suggest_questions ? " bs-switch--on" : ""}`}
              onClick={toggleAutoSuggest}
            >
              <span className="bs-switch__knob" />
            </button>
          </div>

          <section className="ac-listCard">
            {STATE_ROWS.map(({ key, tone, Icon, title, sub, filter }) => (
              <div className="ac-row ac-row--flush bs-row" key={key}>
                <span className={`bs-row__tile bs-row__tile--${tone}`}><Icon size={17} /></span>
                <div className="bs-row__body">
                  <div className="bs-row__title">{title}</div>
                  <div className="bs-row__sub">{sub}</div>
                </div>
                <div className={`bs-row__count bs-row__count--${tone}`}>{data[key] ?? 0}</div>
                <button
                  type="button"
                  className="ac-btn"
                  onClick={() => goToState(filter)}
                  disabled={!data[key]}
                >
                  View
                </button>
              </div>
            ))}
          </section>
        </div>

        <aside className="bs-rail">
          <div className="bs-card">
            <h2 className="bs-card__title">How curation works</h2>
            <ol className="bs-steps">
              {CURATION_STEPS.map((step, i) => (
                <li className="bs-step" key={i}>
                  <span className="bs-step__num">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bs-card">
            <h2 className="bs-card__title">Latest admin note</h2>
            {data.latest_note ? (
              <>
                <p className="bs-note__q">
                  &ldquo;{data.latest_note.question_text}&rdquo;
                </p>
                <div className="bs-note">{data.latest_note.feedback}</div>
                <button
                  type="button"
                  className="ac-btn bs-note__btn"
                  onClick={() => goToState("changes_requested")}
                >
                  Open the {data.changes_requested === 1
                    ? "question"
                    : `${data.changes_requested} questions`}
                </button>
              </>
            ) : (
              <p className="bs-card__empty">
                No admin has asked for a change. Nothing of yours is blocked.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
