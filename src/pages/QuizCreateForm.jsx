import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack, IoClose, IoCheckmarkCircle, IoWarning } from "react-icons/io5";
import { MdDragIndicator } from "react-icons/md";
import { FiEye, FiAlertCircle } from "react-icons/fi";
import api from "../api/apiClient";
import "../styles/quiz-create.css";

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS = ["Details", "Questions", "Preview & Publish"];

const BLANK_CHOICE = () => ({ text: "", is_correct: false });

const BLANK_QUESTION = () => ({
  _id: crypto.randomUUID(),          // local only, not sent to backend
  text: "",
  marks: 1,
  order: 0,
  explanation: "",
  choices: [BLANK_CHOICE(), BLANK_CHOICE(), BLANK_CHOICE(), BLANK_CHOICE()],
  _saved: false,                     // true once POSTed to backend
  _error: null,
});

const INSTRUCTIONS = [
  {
    icon: "📋",
    title: "Quiz Details",
    points: [
      "Set a clear, descriptive title for your quiz.",
"Set a time limit in minutes. Recommended: 1–2 minutes per question.",
      "The quiz will only be visible to students after you publish it.",
    ],
  },
  {
    icon: "✏️",
    title: "Adding Questions",
    points: [
      "Each question must have exactly one correct answer marked.",
      "Provide 2–6 answer choices per question.",
      "Default marks per question is 1 — increase for harder questions.",
      "Write a clear explanation — students see this after submitting.",
      "You can delete any unsaved question before publishing.",
      "Minimum 1 question required to publish; recommended 5–20 questions.",
    ],
  },
  {
    icon: "🚀",
    title: "Publishing",
    points: [
      "Preview the full quiz before publishing to catch errors.",
      "Once published, questions cannot be edited or deleted.",
      "Total marks are calculated automatically from individual question marks.",
      "Students can attempt the quiz multiple times.",
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function totalMarks(questions) {
  return questions.reduce((sum, q) => sum + Number(q.marks || 1), 0);
}

function validateDetails(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.subject) errors.subject = "Subject is required.";
  if (!form.time_limit_minutes || form.time_limit_minutes < 1)
    errors.time_limit_minutes = "Time limit must be at least 1 minute.";
  return errors;
}

function validateQuestion(q) {
  if (!q.text.trim()) return "Question text is required.";
  const filled = q.choices.filter((c) => c.text.trim());
  if (filled.length < 2) return "At least 2 answer choices are required.";
  const correct = q.choices.filter((c) => c.is_correct && c.text.trim());
  if (correct.length !== 1) return "Exactly one correct answer must be marked.";
  if (!q.explanation.trim()) return "Explanation is required.";
  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepBar({ current }) {
  return (
    <div className="qcf-stepbar">
      {STEPS.map((label, i) => (
        <div key={i} className={`qcf-step ${i === current ? "active" : i < current ? "done" : ""}`}>
          <div className="qcf-step-circle">{i < current ? "✓" : i + 1}</div>
          <span className="qcf-step-label">{label}</span>
          {i < STEPS.length - 1 && <div className="qcf-step-line" />}
        </div>
      ))}
    </div>
  );
}

function InstructionPanel({ stepIndex }) {
  const info = INSTRUCTIONS[stepIndex];
  return (
    <aside className="qcf-instructions">
      <div className="qcf-instr-icon">{info.icon}</div>
      <h3 className="qcf-instr-title">{info.title}</h3>
      <ul className="qcf-instr-list">
        {info.points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>

      {stepIndex === 1 && (
        <div className="qcf-instr-legend">
          <p className="qcf-instr-legend-title">Marks guide</p>
          <div className="qcf-instr-legend-row"><span className="qcf-badge qcf-badge-easy">1 mark</span> Easy / recall</div>
          <div className="qcf-instr-legend-row"><span className="qcf-badge qcf-badge-med">2 marks</span> Application</div>
          <div className="qcf-instr-legend-row"><span className="qcf-badge qcf-badge-hard">3+ marks</span> Analysis / reasoning</div>
        </div>
      )}
    </aside>
  );
}

function QuestionCard({ q, index, onUpdate, onDelete, onSave, saving, subjects }) {
  const err = q._error;

  const updateChoice = (ci, field, value) => {
    const choices = q.choices.map((c, i) => {
      if (i !== ci) return field === "is_correct" ? { ...c, is_correct: false } : c;
      return { ...c, [field]: value };
    });
    // if marking correct, unmark others
    if (field === "is_correct" && value) {
      choices.forEach((c, i) => { if (i !== ci) c.is_correct = false; });
    }
    onUpdate({ ...q, choices });
  };

  const addChoice = () => {
    if (q.choices.length >= 6) return;
    onUpdate({ ...q, choices: [...q.choices, BLANK_CHOICE()] });
  };

  const removeChoice = (ci) => {
    if (q.choices.length <= 2) return;
    onUpdate({ ...q, choices: q.choices.filter((_, i) => i !== ci) });
  };

  return (
    <div className={`qcf-qcard ${q._saved ? "qcf-qcard--saved" : ""} ${err ? "qcf-qcard--error" : ""}`}>
      <div className="qcf-qcard-header">
        <div className="qcf-qcard-drag"><MdDragIndicator /></div>
        <span className="qcf-qcard-num">Q{index + 1}</span>
        <div className="qcf-qcard-meta">
          <label className="qcf-marks-label">
            Marks:
            <input
              type="number"
              min={1}
              max={10}
              value={q.marks}
              disabled={q._saved}
              className="qcf-marks-input"
              onChange={(e) => onUpdate({ ...q, marks: Math.max(1, Number(e.target.value)) })}
            />
          </label>
          {q._saved ? (
            <span className="qcf-saved-badge"><IoCheckmarkCircle /> Saved</span>
          ) : (
            <button className="qcf-del-btn" onClick={() => onDelete(q._id)} title="Remove this question">
              <IoClose /> Remove
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="qcf-qerror"><FiAlertCircle /> {err}</div>
      )}

      <textarea
        className="qcf-qtextarea"
        placeholder="Enter question text…"
        value={q.text}
        disabled={q._saved}
        onChange={(e) => onUpdate({ ...q, text: e.target.value })}
        rows={2}
      />

      <div className="qcf-choices-label">Answer Choices <span className="qcf-hint">(mark exactly one correct)</span></div>
      <div className="qcf-choices">
        {q.choices.map((c, ci) => (
          <div key={ci} className={`qcf-choice-row ${c.is_correct ? "qcf-choice-correct" : ""}`}>
            <input
              type="radio"
              name={`correct-${q._id}`}
              checked={c.is_correct}
              disabled={q._saved}
              onChange={() => updateChoice(ci, "is_correct", true)}
              className="qcf-choice-radio"
              title="Mark as correct answer"
            />
            <span className="qcf-choice-letter">{String.fromCharCode(65 + ci)}</span>
            <input
              type="text"
              className="qcf-choice-input"
              placeholder={`Choice ${String.fromCharCode(65 + ci)}`}
              value={c.text}
              disabled={q._saved}
              onChange={(e) => updateChoice(ci, "text", e.target.value)}
            />
            {c.is_correct && <IoCheckmarkCircle className="qcf-correct-icon" />}
            {!q._saved && q.choices.length > 2 && (
              <button className="qcf-choice-del" onClick={() => removeChoice(ci)} title="Remove choice">
                <IoClose />
              </button>
            )}
          </div>
        ))}
        {!q._saved && q.choices.length < 6 && (
          <button className="qcf-add-choice-btn" onClick={addChoice}>+ Add choice</button>
        )}
      </div>

      <div className="qcf-explanation-wrap">
        <label className="qcf-explanation-label">Explanation <span className="qcf-hint">(shown to students after submission)</span></label>
        <textarea
          className="qcf-explanation-input"
          placeholder="Explain why the correct answer is correct…"
          value={q.explanation}
          disabled={q._saved}
          onChange={(e) => onUpdate({ ...q, explanation: e.target.value })}
          rows={2}
        />
      </div>

      {!q._saved && (
        <div className="qcf-qcard-footer">
          <button
            className="qcf-save-q-btn"
            onClick={() => onSave(q._id)}
            disabled={saving === q._id}
          >
            {saving === q._id ? "Saving…" : "✓ Save Question"}
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ details, questions, totalM }) {
  return (
    <div className="qcf-preview">
      <div className="qcf-preview-header">
        <div>
          <h2 className="qcf-preview-title">{details.title}</h2>
          <p className="qcf-preview-meta">
              Time limit: {details.time_limit_minutes} min &nbsp;•&nbsp;
            {questions.length} questions &nbsp;•&nbsp;
            {totalM} marks total
          </p>
        </div>
        <span className="qcf-preview-draft-badge">DRAFT</span>
      </div>

      {questions.length === 0 && (
        <p className="qcf-preview-empty">No questions added yet.</p>
      )}

      <div className="qcf-preview-questions">
        {questions.map((q, qi) => (
          <div key={q._id} className="qcf-preview-qblock">
            <div className="qcf-preview-qrow">
              <span className="qcf-preview-qnum">{qi + 1}.</span>
              <span className="qcf-preview-qtext">{q.text || <em>No text</em>}</span>
              <span className="qcf-preview-qmarks">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
            </div>
            <div className="qcf-preview-choices">
              {q.choices.filter(c => c.text.trim()).map((c, ci) => (
                <div key={ci} className={`qcf-preview-choice ${c.is_correct ? "qcf-preview-choice--correct" : ""}`}>
                  <span className="qcf-preview-choice-letter">{String.fromCharCode(65 + ci)}</span>
                  {c.text}
                  {c.is_correct && <IoCheckmarkCircle className="qcf-preview-check" />}
                </div>
              ))}
            </div>
            {q.explanation && (
              <div className="qcf-preview-explanation">
                <strong>Explanation:</strong> {q.explanation}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuizCreateForm({ subjects = [] }) {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [step, setStep] = useState(0);
  const [quizId, setQuizId] = useState(null);          // set after quiz is created on backend
  const [detailErrors, setDetailErrors] = useState({});
  const [globalError, setGlobalError] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  // Step 0 — quiz details
  const [form, setForm] = useState({
    title: "",
    subject: subjectId || "",
    time_limit_minutes: 30,
    description: "",
  });

  // Step 1 — questions
  const [questions, setQuestions] = useState([BLANK_QUESTION()]);

  // ── Handlers: Step 0 ────────────────────────────────────────────────────

  const handleDetailChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDetailErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleStep0Next = async () => {
    const errors = validateDetails(form);
    if (Object.keys(errors).length) { setDetailErrors(errors); return; }

    try {
      setGlobalError(null);
      if (!quizId) {
        // Create quiz on backend now
        const res = await api.post("/teacher/quizzes/", {
          subject: form.subject,
          title: form.title.trim(),
          description: form.description.trim(),
          time_limit_minutes: Number(form.time_limit_minutes),
        });
        setQuizId(res.data.id);
      }
      setStep(1);
    } catch (err) {
      setGlobalError(err.response?.data?.detail || "Failed to create quiz. Check the details and try again.");
    }
  };

  // ── Handlers: Step 1 ────────────────────────────────────────────────────

  const updateQuestion = (updated) => {
    setQuestions((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
  };

  const deleteQuestion = (localId) => {
    setQuestions((prev) => prev.filter((q) => q._id !== localId));
  };

  const addQuestion = () => {
    const newQ = BLANK_QUESTION();
    newQ.order = questions.length;
    setQuestions((prev) => [...prev, newQ]);
  };

  const saveQuestion = async (localId) => {
    const q = questions.find((x) => x._id === localId);
    const err = validateQuestion(q);
    if (err) {
      setQuestions((prev) => prev.map((x) => x._id === localId ? { ...x, _error: err } : x));
      return;
    }

    setSavingQuestion(localId);
    try {
      await api.post(`/teacher/quizzes/${quizId}/questions/`, {
        text: q.text.trim(),
        marks: Number(q.marks),
        order: questions.findIndex((x) => x._id === localId),
        explanation: q.explanation.trim(),
        choices: q.choices
          .filter((c) => c.text.trim())
          .map((c) => ({ text: c.text.trim(), is_correct: c.is_correct })),
      });
      setQuestions((prev) =>
        prev.map((x) => x._id === localId ? { ...x, _saved: true, _error: null } : x)
      );
    } catch (err) {
      const msg = err.response?.data?.detail
        || (Array.isArray(err.response?.data) ? err.response.data.join(", ") : null)
        || "Failed to save question.";
      setQuestions((prev) => prev.map((x) => x._id === localId ? { ...x, _error: msg } : x));
    } finally {
      setSavingQuestion(null);
    }
  };

  const handleStep1Next = () => {
    const unsaved = questions.filter((q) => !q._saved);
    if (unsaved.length) {
      setGlobalError(`You have ${unsaved.length} unsaved question(s). Save or remove them before continuing.`);
      return;
    }
    if (questions.length === 0) {
      setGlobalError("Add at least one question before previewing.");
      return;
    }
    setGlobalError(null);
    setStep(2);
  };

  // ── Handlers: Step 2 — publish ──────────────────────────────────────────

  const handlePublish = async () => {
    setPublishing(true);
    setGlobalError(null);
    try {
      await api.patch(`/teacher/quizzes/${quizId}/publish/`);
      setPublished(true);
    } catch (err) {
      setGlobalError(err.response?.data?.detail || "Failed to publish quiz.");
    } finally {
      setPublishing(false);
    }
  };

  const savedCount = questions.filter((q) => q._saved).length;
  const tm = totalMarks(questions.filter((q) => q._saved));

  // ── Render ───────────────────────────────────────────────────────────────

  if (published) {
    return (
      <div className="qcf-published-screen">
        <div className="qcf-published-card">
          <div className="qcf-published-icon">🎉</div>
          <h2>Quiz Published!</h2>
          <p>
            <strong>{form.title}</strong> is now live.<br />
            Students can now attempt it any time.
          </p>
          <div className="qcf-published-stats">
            <div><strong>{questions.length}</strong><span>Questions</span></div>
            <div><strong>{tm}</strong><span>Total Marks</span></div>
            <div><strong>{form.time_limit_minutes}m</strong><span>Time Limit</span></div>
          </div>
          <button
            className="qcf-btn-primary"
            onClick={() => navigate(`/teacher/classes/${subjectId}/quizzes`)}
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="qcf-page">
      {/* Back button */}
      <button
        className="qcf-back-btn"
        onClick={() => (step === 0 ? navigate(`/teacher/classes/${subjectId}/quizzes`) : setStep(step - 1))}
      >
        <IoChevronBack /> {step === 0 ? "Back to Quizzes" : "Previous Step"}
      </button>

      <h1 className="qcf-page-title">Create New Quiz</h1>

      <StepBar current={step} />

      {globalError && (
        <div className="qcf-global-error">
          <IoWarning /> {globalError}
        </div>
      )}

      <div className="qcf-layout">
        {/* LEFT — main content */}
        <div className="qcf-main">

          {/* ── STEP 0: Details ── */}
          {step === 0 && (
            <div className="qcf-section">
              <h2 className="qcf-section-title">Quiz Details</h2>

              <div className="qcf-field">
                <label>Title <span className="qcf-req">*</span></label>
                <input
                  type="text"
                  className={`qcf-input ${detailErrors.title ? "qcf-input--error" : ""}`}
                  placeholder="e.g. Chapter 3 — Cell Biology Quiz"
                  value={form.title}
                  onChange={(e) => handleDetailChange("title", e.target.value)}
                />
                {detailErrors.title && <p className="qcf-field-error">{detailErrors.title}</p>}
              </div>

              <div className="qcf-field">
                <label>Description <span className="qcf-optional">(optional)</span></label>
                <textarea
                  className="qcf-input qcf-textarea"
                  placeholder="Brief description of what this quiz covers…"
                  value={form.description}
                  onChange={(e) => handleDetailChange("description", e.target.value)}
                  rows={2}
                />
              </div>

              <div className="qcf-row">
                <div className="qcf-field">
                  <label>Time Limit (minutes) <span className="qcf-req">*</span></label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className={`qcf-input ${detailErrors.time_limit_minutes ? "qcf-input--error" : ""}`}
                    value={form.time_limit_minutes}
                    onChange={(e) => handleDetailChange("time_limit_minutes", Math.max(1, Number(e.target.value)))}
                  />
                  {detailErrors.time_limit_minutes && <p className="qcf-field-error">{detailErrors.time_limit_minutes}</p>}
                  <p className="qcf-field-hint">Recommended: 1–2 min per question</p>
                </div>
              </div>

              {/* Subject selector only shown if subjectId was not passed via route */}
              {!subjectId && subjects.length > 0 && (
                <div className="qcf-field">
                  <label>Subject <span className="qcf-req">*</span></label>
                  <select
                    className={`qcf-input ${detailErrors.subject ? "qcf-input--error" : ""}`}
                    value={form.subject}
                    onChange={(e) => handleDetailChange("subject", e.target.value)}
                  >
                    <option value="">Select a subject…</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {detailErrors.subject && <p className="qcf-field-error">{detailErrors.subject}</p>}
                </div>
              )}

              <div className="qcf-field-hint qcf-timing-hint">
                <FiEye /> Preview will be available before publishing. Quiz is only visible to students after you publish.
              </div>

              <button className="qcf-btn-primary qcf-btn-next" onClick={handleStep0Next}>
                Next: Add Questions →
              </button>
            </div>
          )}

          {/* ── STEP 1: Questions ── */}
          {step === 1 && (
            <div className="qcf-section">
              <div className="qcf-questions-header">
                <h2 className="qcf-section-title">Questions</h2>
                <div className="qcf-questions-stats">
                  <span className="qcf-stat-pill qcf-stat-pill--blue">{savedCount} saved</span>
                  <span className="qcf-stat-pill qcf-stat-pill--green">{tm} marks total</span>
                </div>
              </div>

              {questions.map((q, i) => (
                <QuestionCard
                  key={q._id}
                  q={q}
                  index={i}
                  onUpdate={updateQuestion}
                  onDelete={deleteQuestion}
                  onSave={saveQuestion}
                  saving={savingQuestion}
                />
              ))}

              <button className="qcf-add-q-btn" onClick={addQuestion}>
                + Add Another Question
              </button>

              <div className="qcf-step1-footer">
                <button className="qcf-btn-secondary" onClick={() => setStep(0)}>
                  ← Edit Details
                </button>
                <button className="qcf-btn-primary" onClick={handleStep1Next}>
                  Preview Quiz →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Preview & Publish ── */}
          {step === 2 && (
            <div className="qcf-section">
              <h2 className="qcf-section-title">Preview & Publish</h2>
              <p className="qcf-preview-note">
                This is exactly what you and your students will see. Review carefully — questions cannot be edited after publishing.
              </p>

              <PreviewPanel
                details={form}
                questions={questions.filter((q) => q._saved)}
                totalM={tm}
              />

              <div className="qcf-publish-footer">
                <button className="qcf-btn-secondary" onClick={() => setStep(1)}>
                  ← Edit Questions
                </button>
                <button
                  className="qcf-btn-publish"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? "Publishing…" : "🚀 Publish Quiz"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — instructions sidebar */}
        <InstructionPanel stepIndex={step} />
      </div>
    </div>
  );
}
