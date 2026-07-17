import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { IoCheckmarkCircle } from "react-icons/io5";
import api from "../api/apiClient";
import "../styles/create-quiz.css";
import { LoadingState } from "../components/StateViews";

const createEmptyQuestion = () => ({
  question: "",
  options: ["", "", "", ""],
  answerIndex: null,
  explanation: "",
  topic: "",
  difficulty: "medium",
});

const createEmptyError = () => ({
  question: "",
  options: ["", "", "", ""],
  optionsGeneral: "",
  answer: "",
  explanation: "",
});

const TIME_PRESETS = [5, 10, 15, 30];

const TOPIC_PLACEHOLDER = "e.g. Integration";

/* ── bulk-paste parser ──
   One question per block (blank-line separated): first line is the
   question text, following lines are "A) option" / "a. option" style
   choices, star the correct one with a trailing "*". */
function parseBulkImport(text) {
  const blocks = (text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const qText = lines[0].replace(/^(Q[:.)]?\s*|\d+[.)]\s*)/i, "");
    const options = [];
    let answerIndex = 0;
    for (const line of lines.slice(1)) {
      const m = line.match(/^[A-Da-d][.)]\s*(.+)$/);
      if (!m) continue;
      let optText = m[1].trim();
      if (optText.endsWith("*") || line.includes("*")) {
        answerIndex = options.length;
        optText = optText.replace(/\s*\*\s*$/, "");
      }
      options.push(optText);
    }
    if (qText && options.length >= 2) {
      while (options.length < 4) options.push("");
      out.push({
        question: qText,
        options: options.slice(0, 6),
        answerIndex,
        explanation: "",
        topic: "",
        difficulty: "medium",
      });
    }
  }
  return out;
}

/* ── tiny inline popup ── */
function FieldError({ msg, onDismiss }) {
  const [visible, setVisible] = useState(true);
  if (!msg || !visible) return null;
  const dismiss = () => { setVisible(false); onDismiss?.(); };
  return (
    <div className="cq-field-error" role="alert">
      <span className="cq-field-error-icon">!</span>
      {msg}
      <button className="cq-field-error-close" type="button" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export default function CreateQuiz() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [title, setTitle] = useState("");
  const [quizType, setQuizType] = useState("mock"); // "mock" | "practice"
  const [questions, setQuestions] = useState([createEmptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [timeLimit, setTimeLimit] = useState(10);
  const [customTime, setCustomTime] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  /* ── bulk paste / import ── */
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const importPreview = useMemo(() => parseBulkImport(importText), [importText]);

  /* ── question bank drawer ── */
  const [showBank, setShowBank] = useState(false);
  const [bankScope, setBankScope] = useState("mine");
  const [bankTopic, setBankTopic] = useState("");
  const [bankDifficulty, setBankDifficulty] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [bankItems, setBankItems] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSelected, setBankSelected] = useState(() => new Set());

  /* ── validation errors ── */
  const [titleError, setTitleError] = useState("");
  const [qErrors, setQErrors] = useState([createEmptyError()]);

  const effectiveTimeLimit = useCustom ? parseInt(customTime) || 5 : timeLimit;

  /* ── helpers to clear a specific error on user interaction ── */
  const clearTitleError = () => setTitleError("");

  const clearQError = (qIdx, field, optIdx = null) => {
    setQErrors((prev) => {
      const copy = prev.map((e) => ({ ...e, options: [...e.options] }));
      if (field === "option" && optIdx !== null) {
        copy[qIdx].options[optIdx] = "";
      } else {
        copy[qIdx][field] = "";
      }
      return copy;
    });
  };

  /* ── question state updaters ── */
  const updateQuestion = (index, value) => {
    const copy = [...questions];
    copy[index].question = value;
    setQuestions(copy);
    clearQError(index, "question");
  };

  const updateOption = (qIndex, optIndex, value) => {
    const copy = [...questions];
    copy[qIndex].options[optIndex] = value;
    setQuestions(copy);
    clearQError(qIndex, "option", optIndex);
  };

  const updateExplanation = (index, value) => {
    const copy = [...questions];
    copy[index].explanation = value;
    setQuestions(copy);
    clearQError(index, "explanation");
  };

  const setCorrectAnswer = (qIndex, optIndex) => {
    const copy = [...questions];
    copy[qIndex].answerIndex = optIndex;
    setQuestions(copy);
    clearQError(qIndex, "answer");
  };

  const updateTopic = (index, value) => {
    const copy = [...questions];
    copy[index].topic = value;
    setQuestions(copy);
  };

  const updateDifficulty = (index, value) => {
    const copy = [...questions];
    copy[index].difficulty = value;
    setQuestions(copy);
  };

  /* Append parsed/reused questions (from bulk import or the bank) onto the
     end of the local list — they flow through the exact same "Create"
     submission as manually-typed questions. If the only row on the page is
     still the untouched first blank question, replace it instead of
     leaving an empty question dangling in the middle of the list. */
  const appendQuestions = (newOnes) => {
    if (!newOnes.length) return;
    setQuestions((prev) => {
      const isBlankFirst =
        prev.length === 1 &&
        !prev[0].question.trim() &&
        prev[0].options.every((o) => !o.trim());
      return isBlankFirst ? newOnes : [...prev, ...newOnes];
    });
    setQErrors((prev) => {
      const isBlankFirst = prev.length === 1;
      const fresh = newOnes.map(() => createEmptyError());
      return isBlankFirst && questions.length === 1 && !questions[0].question.trim()
        ? fresh
        : [...prev, ...fresh];
    });
  };

  const addQuestion = () => {
    setQuestions([...questions, createEmptyQuestion()]);
    setQErrors((prev) => [...prev, createEmptyError()]);
  };

  /* ── delete a specific question ── */
  const deleteQuestion = (index) => {
    if (questions.length === 1) return; // keep at least one
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    setQErrors((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── bulk paste / import ── */
  const openImport = () => setShowImport(true);
  const closeImport = () => { setShowImport(false); setImportText(""); };
  const doImport = () => {
    if (!importPreview.length) return;
    appendQuestions(importPreview);
    closeImport();
  };

  /* ── question bank drawer ── */
  useEffect(() => {
    if (!showBank) return;
    let cancelled = false;
    (async () => {
      setBankLoading(true);
      try {
        const res = await api.get("/teacher/question-bank/", {
          params: {
            scope: bankScope,
            subject: subjectId || undefined,
            topic: bankTopic || undefined,
            difficulty: bankDifficulty || undefined,
            search: bankSearch || undefined,
          },
        });
        if (!cancelled) setBankItems(res.data.results || res.data);
      } catch (err) {
        console.error("Failed to load question bank", err);
        if (!cancelled) setBankItems([]);
      } finally {
        if (!cancelled) setBankLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showBank, bankScope, bankTopic, bankDifficulty, bankSearch, subjectId]);

  const openBank = () => setShowBank(true);
  const closeBank = () => { setShowBank(false); setBankSelected(new Set()); };

  const toggleBankItem = (id) => {
    setBankSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addFromBank = () => {
    const picked = bankItems.filter((b) => bankSelected.has(b.id));
    if (!picked.length) { closeBank(); return; }
    const mapped = picked.map((b) => {
      const choices = b.choices || [];
      const correctIdx = Math.max(0, choices.findIndex((c) => c.is_correct));
      return {
        question: b.text,
        options: choices.map((c) => c.text),
        answerIndex: correctIdx,
        explanation: b.explanation || "",
        topic: b.topic || "",
        difficulty: b.difficulty || "medium",
      };
    });
    appendQuestions(mapped);
    closeBank();
  };

  /* ── cancel handlers ── */
  const handleCancel = () => {
    const hasContent =
      title.trim() ||
      questions.some(
        (q) =>
          q.question.trim() ||
          q.options.some((o) => o.trim()) ||
          q.explanation.trim()
      );
    if (hasContent) {
      setShowCancelModal(true);
    } else {
      navigate(`/teacher/classes/${subjectId}/quizzes`);
    }
  };

  /* ── validate and return true if all fields are valid ── */
  const validate = () => {
    let valid = true;

    let newTitleError = "";
    if (!title.trim()) {
      newTitleError = "Quiz title is required.";
      valid = false;
    }
    setTitleError(newTitleError);

    const newQErrors = questions.map((q) => {
      const err = createEmptyError();

      if (!q.question.trim()) {
        err.question = "Question text is required.";
        valid = false;
      }

      const filledCount = q.options.filter((o) => o.trim()).length;
      if (filledCount < 2) {
        err.optionsGeneral = "At least 2 answer options are required.";
        valid = false;
      }

      if (q.answerIndex === null || !q.options[q.answerIndex]?.trim()) {
        err.answer = "Please select the correct answer.";
        valid = false;
      }

      if (!q.explanation.trim()) {
        err.explanation = "Explanation is required.";
        valid = false;
      }

      return err;
    });

    setQErrors(newQErrors);
    return valid;
  };

  const handleCreate = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const quizRes = await api.post("/teacher/quizzes/", {
        subject: subjectId,
        title,
        description: "",
        // due_date removed — quizzes no longer expire
        time_limit_minutes: effectiveTimeLimit,
        quiz_type: quizType,
      });

      const quizId = quizRes.data.id;

      await api.post(`/teacher/quizzes/${quizId}/questions/bulk/`, {
        questions: questions.map((q, i) => ({
          text: q.question,
          order: i + 1,
          marks: 1,
          explanation: q.explanation,
          topic: q.topic.trim(),
          difficulty: q.difficulty,
          choices: q.options
            .map((opt, index) => ({
              text: opt.trim(),
              is_correct: index === q.answerIndex,
            }))
            .filter((c) => c.text),
        })),
      });

      alert("Quiz created successfully");
      navigate(`/teacher/classes/${subjectId}/quizzes`);
    } catch (err) {
      alert(err.response?.data?.detail || "Quiz creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-quiz-page">
      <button type="button" className="cq-back-btn" onClick={handleCancel}>
        ← Back
      </button>

      <div className="cq-shell">
        <div className="cq-title-container">
          {/* Quiz title */}
          <div className="cq-title-field">
            <input
              className={`cq-title-input ${titleError ? "cq-input-error" : ""}`}
              type="text"
              placeholder="Quiz Title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); clearTitleError(); }}
            />
            <FieldError msg={titleError} />
          </div>

          {/* Timer picker */}
          <div className="cq-timer-picker">
            <span className="cq-timer-label">⏱ Time limit</span>
            <div className="cq-timer-presets">
              {TIME_PRESETS.map((min) => (
                <button
                  key={min}
                  type="button"
                  className={`cq-timer-btn ${!useCustom && timeLimit === min ? "active" : ""}`}
                  onClick={() => { setTimeLimit(min); setUseCustom(false); }}
                >
                  {min} min
                </button>
              ))}
              <button
                type="button"
                className={`cq-timer-btn ${useCustom ? "active" : ""}`}
                onClick={() => setUseCustom(true)}
              >
                Custom
              </button>
            </div>

            {useCustom && (
              <input
                className="cq-timer-custom-input"
                type="number"
                min="1"
                placeholder="Enter minutes"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                autoFocus
              />
            )}

            <span className="cq-timer-display">{effectiveTimeLimit} min selected</span>
          </div>

          {/* Quiz type */}
          <div className="cq-type-picker">
            <span className="cq-timer-label">Mode</span>
            <div className="cq-timer-presets">
              <button
                type="button"
                className={`cq-timer-btn ${quizType === "mock" ? "active" : ""}`}
                onClick={() => setQuizType("mock")}
                title="Timed, full-paper navigation, graded only on submit"
              >
                Mock test — timed
              </button>
              <button
                type="button"
                className={`cq-timer-btn ${quizType === "practice" ? "active" : ""}`}
                onClick={() => setQuizType("practice")}
                title="Untimed, one question at a time, instant feedback"
              >
                Practice — instant feedback
              </button>
            </div>
          </div>
        </div>

        <div className="cq-form-container">
          <div className="cq-toolbar-row">
            <button type="button" className="cq-tool-btn" onClick={openImport}>
              ⇪ Bulk paste / import
            </button>
            <button type="button" className="cq-tool-btn" onClick={openBank}>
              🗂 Question bank
            </button>
          </div>

          <div className="cq-questions-list">
            {questions.map((q, qIndex) => {
              const err = qErrors[qIndex] || createEmptyError();
              return (
                <div key={qIndex} className="cq-question-block">

                  {/* Question header with delete button */}
                  <div className="cq-question-top">
                    <span className="cq-qno">Q{qIndex + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <input
                        className={`cq-question-input ${err.question ? "cq-input-error" : ""}`}
                        placeholder="Enter Question"
                        value={q.question}
                        onChange={(e) => updateQuestion(qIndex, e.target.value)}
                      />
                      <FieldError msg={err.question} />
                    </div>
                    {/* Only show delete if more than one question */}
                    {questions.length > 1 && (
                      <button
                        type="button"
                        className="cq-delete-question-btn"
                        onClick={() => deleteQuestion(qIndex)}
                        title="Remove this question"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Options */}
                  <div className="cq-options-grid">
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} className="cq-option-row">
                        <span className="cq-option-letter">
                          {String.fromCharCode(97 + optIndex)})
                        </span>
                        <div style={{ flex: 1 }}>
                          <input
                            className="cq-option-input"
                            placeholder={optIndex < 2 ? `Option ${optIndex + 1}` : `Option ${optIndex + 1} (optional)`}
                            value={opt}
                            onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <FieldError msg={err.optionsGeneral} />

                  {/* Topic + difficulty (used by the question bank & result analytics) */}
                  <div className="cq-meta-row">
                    <div className="cq-meta-field">
                      <span className="cq-meta-label">Topic</span>
                      <input
                        className="cq-meta-input"
                        placeholder={TOPIC_PLACEHOLDER}
                        value={q.topic}
                        onChange={(e) => updateTopic(qIndex, e.target.value)}
                      />
                    </div>
                    <div className="cq-meta-field">
                      <span className="cq-meta-label">Difficulty</span>
                      <select
                        className="cq-meta-input"
                        value={q.difficulty}
                        onChange={(e) => updateDifficulty(qIndex, e.target.value)}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  {/* Answer picker */}
                  <div className="cq-answer-row">
                    <span className="cq-answer-label">Answer:</span>
                    <div>
                      <div className="cq-answer-choices">
                        {q.options.map((_, optIndex) => (
                          <label key={optIndex} className="cq-answer-choice">
                            <input
                              type="radio"
                              name={`correct-answer-${qIndex}`}
                              checked={q.answerIndex === optIndex}
                              onChange={() => setCorrectAnswer(qIndex, optIndex)}
                            />
                            <span>{String.fromCharCode(97 + optIndex)}</span>
                          </label>
                        ))}
                      </div>
                      <FieldError msg={err.answer} />
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="cq-explanation-row">
                    <span className="cq-answer-label">Explanation:</span>
                    <div style={{ flex: 1 }}>
                      <textarea
                        className={`cq-explanation-input ${err.explanation ? "cq-input-error" : ""}`}
                        placeholder="Explain why this is the correct answer..."
                        value={q.explanation}
                        onChange={(e) => updateExplanation(qIndex, e.target.value)}
                      />
                      <FieldError msg={err.explanation} />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          <div className="cq-bottom-row">
            <button
              type="button"
              className="cq-cancel-btn"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="button" className="cq-add-question-btn" onClick={addQuestion}>
              Add Question
            </button>
            <button
              type="button"
              className="cq-create-btn"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <div className="quiz-modal-overlay">
          <div className="quiz-modal-box">
            <h3>Discard Quiz?</h3>
            <p>
              You have unsaved content.
              <br /><br />
              ⚠️ All your work will be lost if you leave.
            </p>
            <div className="quiz-modal-actions">
              <button
                className="quiz-btn-cancel"
                onClick={() => setShowCancelModal(false)}
              >
                Keep Editing
              </button>
              <button
                className="quiz-btn-exit"
                onClick={() => navigate(`/teacher/classes/${subjectId}/quizzes`)}
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk paste / import modal */}
      {showImport && (
        <div className="quiz-modal-overlay">
          <div className="cq-import-modal">
            <h3>Bulk paste questions</h3>
            <p className="cq-import-hint">
              Paste from any doc. One question per block: question line, then
              options A) to D), star (*) the correct one.
            </p>
            <textarea
              className="cq-import-textarea"
              placeholder={"Q: What is ∫ 2x dx?\nA) x² + C *\nB) 2x² + C\nC) x + C\nD) 2 + C"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="cq-import-footer">
              <span className={`cq-import-count ${importPreview.length ? "cq-import-count--ready" : ""}`}>
                {importPreview.length
                  ? `✓ ${importPreview.length} question${importPreview.length > 1 ? "s" : ""} detected`
                  : "Paste above to preview"}
              </span>
              <div className="cq-import-actions">
                <button type="button" className="cq-cancel-btn" onClick={closeImport}>Cancel</button>
                <button
                  type="button"
                  className="cq-create-btn"
                  disabled={!importPreview.length}
                  onClick={doImport}
                >
                  Add questions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question bank drawer */}
      {showBank && (
        <>
          <div className="cq-bank-backdrop" onClick={closeBank} />
          <div className="cq-bank-drawer">
            <div className="cq-bank-drawer-header">
              <h3>Question bank</h3>
              <button type="button" className="cq-bank-close" onClick={closeBank}>✕</button>
            </div>

            <div className="cq-bank-tabs">
              <button
                type="button"
                className={`cq-bank-tab ${bankScope === "mine" ? "cq-bank-tab--active" : ""}`}
                onClick={() => setBankScope("mine")}
              >
                My questions
              </button>
              <button
                type="button"
                className={`cq-bank-tab ${bankScope === "school" ? "cq-bank-tab--active" : ""}`}
                onClick={() => setBankScope("school")}
              >
                School library
              </button>
            </div>

            <p className="cq-bank-scope-note">
              {bankScope === "mine"
                ? "Every question you write in any approved quiz is saved here automatically — reuse it in one tap."
                : "Shared by colleagues assigned to your subjects."}
            </p>

            <div className="cq-bank-filters">
              <input
                className="cq-bank-filter-input"
                placeholder="Filter by topic…"
                value={bankTopic}
                onChange={(e) => setBankTopic(e.target.value)}
              />
              <select
                className="cq-bank-filter-input"
                value={bankDifficulty}
                onChange={(e) => setBankDifficulty(e.target.value)}
              >
                <option value="">Any difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="cq-bank-search">
              <FiSearch />
              <input
                placeholder="Search by topic or keyword…"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
              />
            </div>

            <div className="cq-bank-list">
              {bankLoading ? (
                <LoadingState plain label="Loading questions" />
              ) : bankItems.length === 0 ? (
                <p className="cq-bank-empty">No matching questions yet.</p>
              ) : (
                bankItems.map((b) => {
                  const selected = bankSelected.has(b.id);
                  const correct = b.choices?.find((c) => c.is_correct);
                  return (
                    <div
                      key={b.id}
                      className={`cq-bank-item ${selected ? "cq-bank-item--selected" : ""}`}
                      onClick={() => toggleBankItem(b.id)}
                    >
                      <div className={`cq-bank-check ${selected ? "cq-bank-check--on" : ""}`}>
                        {selected && <IoCheckmarkCircle />}
                      </div>
                      <div className="cq-bank-item-body">
                        <div className="cq-bank-item-text">{b.text}</div>
                        <div className="cq-bank-item-meta">
                          {b.topic && <span className="cq-bank-item-topic">{b.topic}</span>}
                          <span>{b.difficulty}</span>
                          {bankScope === "school" && <span>· {b.author_name}</span>}
                          {correct && <span className="cq-bank-item-answer">Ans: {correct.text}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button type="button" className="cq-create-btn cq-bank-add-btn" onClick={addFromBank}>
              Add {bankSelected.size} selected
            </button>
          </div>
        </>
      )}
    </div>
  );
}
