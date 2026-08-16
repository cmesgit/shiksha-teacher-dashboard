import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import "../styles/quiz-builder.css";
import {
  IoTimeOutline, IoClipboardOutline, IoFolderOutline, IoSparklesOutline,
  IoCloseOutline, IoCheckmarkOutline,
} from "react-icons/io5";

// Redesigned quiz builder — replaces CreateQuiz.jsx. Single-page split-pane
// editor: question list (left) + editor (right), plus bulk paste import,
// question bank (mine/school, subject-scoped), and OpenAI-backed generation.
// Ships Split-pane only (Document variant dropped per design decision).
//
// Two routes mount this component:
//   quizzes/create/:subjectId  — new quiz, subjectId comes from the URL
//   quizzes/:quizId/edit       — existing draft/rejected quiz, subjectId is
//                                 read from the loaded quiz once fetched
//                                 (GET /quizzes/:id/draft/ doesn't need it
//                                 in the URL, and the id itself already
//                                 pins the quiz unambiguously)
//
// Endpoints:
//   GET   /quizzes/:id/draft/                    load for edit (existing)
//   POST  /teacher/quizzes/                       create draft (existing)
//   PATCH /teacher/quizzes/:id/                   update meta (new)
//   PUT   /teacher/quizzes/:id/questions/bulk/     replace full question set (new)
//   PATCH /teacher/quizzes/:id/publish/            submit for admin review (existing)
//   GET   /teacher/question-bank/?scope=mine|school&subject=
//   POST  /teacher/quizzes/generate-ai/            { topic, difficulty, count }

const blankChoice = () => ({ text: "", is_correct: false });
const blankQuestion = () => ({
  _id: crypto.randomUUID(),
  text: "",
  topic: "",
  difficulty: "medium",
  marks: 1,
  explanation: "",
  choices: [blankChoice(), blankChoice(), blankChoice(), blankChoice()],
  source: "manual",
});

function parseBulkImport(text) {
  const blocks = (text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  for (const b of blocks) {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const qText = lines[0].replace(/^(Q[:.)]?\s*|\d+[.)]\s*)/i, "");
    const choices = [];
    for (const l of lines.slice(1)) {
      const m = l.match(/^[A-Da-d][.)]\s*(.+)$/);
      if (!m) continue;
      let t = m[1].trim();
      const isCorrect = /\*\s*$/.test(l);
      t = t.replace(/\s*\*\s*$/, "");
      choices.push({ text: t, is_correct: isCorrect });
    }
    if (!choices.some((c) => c.is_correct) && choices.length) choices[0].is_correct = true;
    if (qText && choices.length >= 2) {
      out.push({ ...blankQuestion(), text: qText, choices, source: "import" });
    }
  }
  return out;
}

export default function QuizBuilder() {
  const navigate = useNavigate();
  const { subjectId: subjectIdParam, quizId: quizIdParam } = useParams();

  const [quizId, setQuizId] = useState(quizIdParam || null);
  const [subjectId, setSubjectId] = useState(subjectIdParam || null);
  const [title, setTitle] = useState("Untitled quiz");
  const [quizType, setQuizType] = useState("practice"); // "practice" | "mock"
  const [timeLimit, setTimeLimit] = useState(45);
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [selectedId, setSelectedId] = useState(questions[0]._id);
  const [loading, setLoading] = useState(!!quizIdParam);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const [showBank, setShowBank] = useState(false);
  const [bankTab, setBankTab] = useState("mine");
  const [bankItems, setBankItems] = useState({ mine: [], school: [] });
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSel, setBankSel] = useState({});

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("Mixed");
  const [aiCount, setAiCount] = useState(3);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  useEffect(() => {
    if (!quizIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/quizzes/${quizIdParam}/draft/`);
        if (cancelled) return;
        setTitle(res.data.title);
        setQuizType(res.data.quiz_type || "practice");
        setTimeLimit(res.data.time_limit_minutes || 45);
        setSubjectId(res.data.subject_id);
        const qs = (res.data.questions || []).map((q) => ({
          _id: String(q.id),
          serverId: q.id,
          text: q.text,
          topic: q.topic || "",
          difficulty: q.difficulty || "medium",
          marks: q.marks || 1,
          explanation: q.explanation || "",
          choices: q.choices?.length ? q.choices : [blankChoice(), blankChoice(), blankChoice(), blankChoice()],
          source: q.source || "manual",
        }));
        setQuestions(qs.length ? qs : [blankQuestion()]);
        setSelectedId((qs[0] || questions[0])._id);
      } catch (err) {
        if (!cancelled) setError("Failed to load quiz.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizIdParam]);

  const selected = useMemo(
    () => questions.find((q) => q._id === selectedId) || questions[0],
    [questions, selectedId]
  );
  const totalMarks = useMemo(() => questions.reduce((s, q) => s + Number(q.marks || 0), 0), [questions]);

  function updateSelected(patch) {
    setQuestions((prev) => prev.map((q) => (q._id === selectedId ? { ...q, ...patch } : q)));
  }
  function updateChoice(ci, patch) {
    updateSelected({
      choices: selected.choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)),
    });
  }
  function setCorrect(ci) {
    updateSelected({ choices: selected.choices.map((c, i) => ({ ...c, is_correct: i === ci })) });
  }
  function addQuestion() {
    const q = blankQuestion();
    setQuestions((prev) => [...prev, q]);
    setSelectedId(q._id);
  }
  function deleteQuestion(id) {
    setQuestions((prev) => {
      const next = prev.filter((q) => q._id !== id);
      const kept = next.length ? next : [blankQuestion()];
      if (id === selectedId) setSelectedId(kept[0]._id);
      return kept;
    });
  }

  const importPreview = useMemo(() => parseBulkImport(importText), [importText]);
  function doImport() {
    if (!importPreview.length) return;
    setQuestions((prev) => [...prev, ...importPreview]);
    setShowImport(false);
    setImportText("");
  }

  async function openBank() {
    setShowBank(true);
    if (bankItems.mine.length || bankItems.school.length) return;
    setBankLoading(true);
    try {
      const [mine, school] = await Promise.all([
        api.get("/teacher/question-bank/", { params: { scope: "mine", subject: subjectId } }),
        api.get("/teacher/question-bank/", { params: { scope: "school", subject: subjectId } }),
      ]);
      setBankItems({ mine: mine.data, school: school.data });
    } catch (err) {
      console.error("Failed to load question bank:", err);
    } finally {
      setBankLoading(false);
    }
  }
  function toggleBankSel(scope, id) {
    const key = `${scope}-${id}`;
    setBankSel((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function addFromBank() {
    const picked = [];
    ["mine", "school"].forEach((scope) => {
      bankItems[scope].forEach((b) => {
        if (bankSel[`${scope}-${b.id}`]) {
          picked.push({
            ...blankQuestion(),
            text: b.text,
            topic: b.topic || "",
            difficulty: b.difficulty || "medium",
            explanation: b.explanation || "",
            choices: b.choices,
            source: "bank",
          });
        }
      });
    });
    if (picked.length) setQuestions((prev) => [...prev, ...picked]);
    setShowBank(false);
    setBankSel({});
  }

  async function generateWithAi() {
    setAiLoading(true);
    try {
      const res = await api.post("/teacher/quizzes/generate-ai/", {
        topic: aiTopic || title,
        difficulty: aiDifficulty,
        count: Number(aiCount) || 3,
      });
      const drafted = (res.data.questions || []).map((q) => ({
        ...blankQuestion(),
        text: q.text,
        topic: q.topic || aiTopic,
        difficulty: (q.difficulty || "medium").toLowerCase(),
        marks: q.marks || 2,
        explanation: q.explanation || "",
        choices: q.choices,
        source: "ai",
      }));
      setQuestions((prev) => [...prev, ...drafted]);
      setAiNote(`${drafted.length} question${drafted.length === 1 ? "" : "s"} drafted by AI from "${aiTopic || title}" — review before publishing.`);
      setShowAiModal(false);
    } catch (err) {
      setError(err.response?.data?.detail || "AI generation failed. Try again or add questions manually.");
    } finally {
      setAiLoading(false);
    }
  }

  function validQuestions() {
    return questions.filter(
      (q) =>
        q.text.trim() &&
        q.explanation.trim() &&
        q.choices.filter((c) => c.text.trim()).length >= 2 &&
        q.choices.some((c) => c.is_correct)
    );
  }

  async function persist({ publish }) {
    const valid = validQuestions();
    if (!valid.length) {
      setError("Add at least one complete question (text, 2+ choices, one marked correct, and an explanation) before saving.");
      return;
    }
    if (!subjectId) {
      setError("Missing subject — please go back and start again.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let id = quizId;
      if (!id) {
        const res = await api.post("/teacher/quizzes/", {
          subject: subjectId,
          title: title.trim(),
          description: "",
          quiz_type: quizType,
          time_limit_minutes: quizType === "mock" ? Number(timeLimit) : null,
        });
        id = res.data.id;
        setQuizId(id);
      } else {
        await api.patch(`/teacher/quizzes/${id}/`, {
          title: title.trim(),
          quiz_type: quizType,
          time_limit_minutes: quizType === "mock" ? Number(timeLimit) : null,
        });
      }
      await api.put(`/teacher/quizzes/${id}/questions/bulk/`, {
        questions: valid.map((q, i) => ({
          id: q.serverId,
          text: q.text.trim(),
          topic: q.topic.trim(),
          difficulty: q.difficulty,
          marks: Number(q.marks) || 1,
          order: i,
          explanation: q.explanation.trim(),
          source: q.source,
          choices: q.choices.filter((c) => c.text.trim()),
        })),
      });
      if (publish) await api.patch(`/teacher/quizzes/${id}/publish/`);
      if (publish) {
        toast.success(
          "Submitted for admin review — an admin will verify it before it goes live for students.",
          { duration: 6000 }
        );
      } else {
        toast.success("Draft saved");
      }
      navigate(`/teacher/classes/${subjectId}/quizzes`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save quiz.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="qb-loading">Loading quiz…</div>;

  return (
    <div className="qb-page">
      <button className="qb-back" onClick={() => navigate(subjectId ? `/teacher/classes/${subjectId}/quizzes` : "/teacher/quizzes")}>
        ← Back to quizzes
      </button>

      {error && <div className="qb-error">{error}</div>}

      <div className="qb-toolbar">
        <input className="qb-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" />
        <select className="qb-select" value={quizType} onChange={(e) => setQuizType(e.target.value)}>
          <option value="practice">Practice — instant feedback</option>
          <option value="mock">Mock test — timed</option>
        </select>
        {quizType === "mock" && (
          <div className="qb-time-field">
            <span><IoTimeOutline /></span>
            <input type="number" min={5} max={180} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
            <span>min</span>
          </div>
        )}
        <span className="qb-counts">{questions.length} Qs · {totalMarks} marks</span>
      </div>

      <div className="qb-actions">
        <button className="tk-btn" onClick={addQuestion}>+ Add question</button>
        <button className="tk-btn tk-btn--ghost" onClick={() => setShowImport(true)}><IoClipboardOutline /> Bulk paste / import</button>
        <button className="tk-btn tk-btn--ghost" onClick={openBank}><IoFolderOutline /> Question bank</button>
        <button className="qb-ai-btn" onClick={() => { setAiTopic(title); setShowAiModal(true); }}><IoSparklesOutline /> Generate with AI</button>
        <div className="qb-actions-right">
          <button className="tk-btn tk-btn--ghost" disabled={saving} onClick={() => persist({ publish: false })}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button className="qb-publish-btn" disabled={saving} onClick={() => persist({ publish: true })}>
            Submit for review
          </button>
        </div>
      </div>

      {aiNote && <div className="qb-ai-note"><IoSparklesOutline /> {aiNote}</div>}

      <div className="qb-split">
        <div className="qb-list">
          {questions.map((q, i) => (
            <div
              key={q._id}
              className={`qb-list-row ${q._id === selectedId ? "qb-list-row--active" : ""}`}
              onClick={() => setSelectedId(q._id)}
            >
              <span className="qb-list-num">{i + 1}</span>
              <span className="qb-list-text">{q.text || "Untitled question"}</span>
              {q.source === "ai" && <span className="qb-ai-tag" title="AI-drafted"><IoSparklesOutline /></span>}
              <span
                className="qb-list-del"
                onClick={(e) => { e.stopPropagation(); deleteQuestion(q._id); }}
              >
                <IoCloseOutline />
              </span>
            </div>
          ))}
        </div>

        <div className="qb-editor">
          {selected && (
            <>
              <div className="qb-editor-head">
                <span className="qb-editor-qnum">Question {questions.findIndex((q) => q._id === selectedId) + 1}</span>
                <input
                  className="qb-select-sm"
                  style={{ minWidth: 140 }}
                  placeholder="Topic…"
                  value={selected.topic}
                  onChange={(e) => updateSelected({ topic: e.target.value })}
                />
                <select className="qb-select-sm" value={selected.difficulty} onChange={(e) => updateSelected({ difficulty: e.target.value })}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <label className="qb-marks-field">
                  Marks
                  <input type="number" min={1} max={10} value={selected.marks} onChange={(e) => updateSelected({ marks: e.target.value })} />
                </label>
              </div>

              <textarea
                className="qb-question-text"
                placeholder="Type the question…"
                value={selected.text}
                onChange={(e) => updateSelected({ text: e.target.value })}
              />

              <div className="qb-choices">
                {selected.choices.map((c, ci) => (
                  <div key={ci} className="qb-choice-row">
                    <button
                      type="button"
                      className={`qb-choice-radio ${c.is_correct ? "qb-choice-radio--on" : ""}`}
                      onClick={() => setCorrect(ci)}
                      title="Mark correct"
                    >
                      {c.is_correct ? <IoCheckmarkOutline /> : ""}
                    </button>
                    <input
                      className={`qb-choice-input ${c.is_correct ? "qb-choice-input--on" : ""}`}
                      placeholder="Option text"
                      value={c.text}
                      onChange={(e) => updateChoice(ci, { text: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="qb-hint">Click the circle to set the correct answer.</div>

              <label className="qb-explanation-label">Explanation (shown after answering)</label>
              <textarea
                className="qb-explanation-text"
                placeholder="Why is this the correct answer?"
                value={selected.explanation}
                onChange={(e) => updateSelected({ explanation: e.target.value })}
              />
            </>
          )}
        </div>
      </div>

      {showImport && (
        <div className="qb-modal-overlay" onClick={() => setShowImport(false)}>
          <div className="qb-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Bulk paste questions</h3>
            <p className="qb-modal-desc">
              One question per block: question line, then options A)–D), star (*) the correct one.
            </p>
            <textarea
              className="qb-import-textarea"
              placeholder={"Q: What is ∫ 2x dx?\nA) x² + C *\nB) 2x² + C\nC) x + C\nD) 2 + C"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="qb-modal-footer">
              <span className={`qb-import-count ${importPreview.length ? "qb-import-count--ok" : ""}`}>
                {importPreview.length ? <><IoCheckmarkOutline /> {importPreview.length} question(s) detected</> : "Paste above to preview"}
              </span>
              <div className="qb-modal-btns">
                <button className="tk-btn tk-btn--ghost" onClick={() => setShowImport(false)}>Cancel</button>
                <button className="tk-btn" onClick={doImport} disabled={!importPreview.length}>Add questions</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBank && (
        <div className="qb-drawer-overlay" onClick={() => setShowBank(false)}>
          <div className="qb-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="qb-drawer-head">
              <h3>Question bank</h3>
              <span className="qb-drawer-close" onClick={() => setShowBank(false)}><IoCloseOutline /></span>
            </div>
            <div className="qb-scope-note">Scoped to your assigned subject</div>
            <div className="qb-bank-tabs">
              <button className={`qb-bank-tab ${bankTab === "mine" ? "qb-bank-tab--on" : ""}`} onClick={() => setBankTab("mine")}>
                My questions · {bankItems.mine.length}
              </button>
              <button className={`qb-bank-tab ${bankTab === "school" ? "qb-bank-tab--on" : ""}`} onClick={() => setBankTab("school")}>
                School library · {bankItems.school.length}
              </button>
            </div>
            <div className="qb-scope-note qb-scope-note--muted">
              {bankTab === "mine"
                ? "Every question you write in any approved quiz is saved here automatically."
                : "Shared by other teachers of this subject."}
            </div>
            <div className="qb-bank-list">
              {bankLoading ? (
                <div className="qb-loading">Loading…</div>
              ) : (
                bankItems[bankTab].map((b) => {
                  const key = `${bankTab}-${b.id}`;
                  const on = !!bankSel[key];
                  return (
                    <div key={b.id} className={`qb-bank-row ${on ? "qb-bank-row--on" : ""}`} onClick={() => toggleBankSel(bankTab, b.id)}>
                      <div className={`qb-bank-check ${on ? "qb-bank-check--on" : ""}`}>{on ? <IoCheckmarkOutline /> : ""}</div>
                      <div className="qb-bank-body">
                        <div className="qb-bank-text">{b.text}</div>
                        <div className="qb-bank-meta">
                          {bankTab === "school" && <span className="qb-bank-author">{b.author_name}</span>}
                          <span>{b.topic} · {b.difficulty}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {!bankLoading && !bankItems[bankTab].length && <div className="qb-bank-empty">No questions here yet.</div>}
            </div>
            <button className="tk-btn qb-bank-add-btn" onClick={addFromBank}>
              Add {Object.values(bankSel).filter(Boolean).length} selected
            </button>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="qb-modal-overlay" onClick={() => setShowAiModal(false)}>
          <div className="qb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qb-ai-modal-head">
              <h3>Generate with AI</h3>
              <span className="qb-ai-badge"><IoSparklesOutline /> AI</span>
            </div>
            <p className="qb-modal-desc">
              Drafts land as unpublished — review and edit every question before publishing.
            </p>
            <label className="qb-field-label">Chapter / topic</label>
            <input className="qb-select" style={{ width: "100%" }} value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Definite Integrals" />
            <div className="qb-ai-row">
              <div>
                <label className="qb-field-label">Difficulty mix</label>
                <select className="qb-select" value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)}>
                  <option>Mixed</option>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
              <div>
                <label className="qb-field-label">How many</label>
                <select className="qb-select" value={aiCount} onChange={(e) => setAiCount(e.target.value)}>
                  <option>3</option>
                  <option>5</option>
                  <option>10</option>
                </select>
              </div>
            </div>
            <div className="qb-modal-footer">
              <div className="qb-modal-btns" style={{ marginLeft: "auto" }}>
                <button className="tk-btn tk-btn--ghost" onClick={() => setShowAiModal(false)}>Cancel</button>
                <button className="qb-ai-btn" onClick={generateWithAi} disabled={aiLoading || !aiTopic.trim()}>
                  {aiLoading ? "Generating…" : <><IoSparklesOutline /> Generate</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
