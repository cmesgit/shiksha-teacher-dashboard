import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import TourHeaderButton from "../tour/TourHeaderButton";
import ChapterTagPicker from "../components/ChapterTagPicker";
import { EMPTY_CHAPTER_VALUE, toChapterPayload, fromChapterPayload } from "../utils/chapterTagPicker";
import "../styles/quiz-builder.css";
import "../styles/quiz-builder-v2.css";
import {
  IoTimeOutline, IoClipboardOutline, IoFolderOutline, IoSparklesOutline,
  IoCloseOutline, IoCheckmarkOutline,
  IoHelpCircleOutline, IoRepeatOutline, IoRemoveCircleOutline, IoEyeOutline,
} from "react-icons/io5";

// ── T2 type cards (design_handoff_quiz_system/README.md §T2) ──────────────
// Copy is the spec's, verbatim: the two cards are the only place a teacher is
// told what the fork actually costs them, so paraphrasing it loses the point.
const QUIZ_TYPES = [
  {
    id: "practice",
    title: "Practice quiz",
    sub: "Retry as often as they like, answer shown after each question. No timer.",
    Icon: IoHelpCircleOutline,
  },
  {
    id: "mock",
    title: "Mock test",
    sub: "Exam conditions: sections, one attempt, strict timer, negative marking.",
    Icon: IoTimeOutline,
  },
];

// Matches the backend's validated set for Quiz.negative_marks_per_wrong.
const NEGATIVE_OPTIONS = ["0", "0.25", "0.33", "0.5", "1"];

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
  const { pathname } = useLocation();
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

  // Batch + chapter (create only — like Assignments, these are ignored by
  // the update endpoint once the quiz exists, so they're fetched and shown
  // only until the first save creates the Quiz row).
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  // Phase 5a: the old single-select chapter + "Custom" free-text pair is
  // replaced by the shared picker, which owns its own chapter fetch — hence no
  // `chapters` state here any more. Chapters are optional and multiple now, so
  // the save-time "pick a chapter" guard below goes with them.
  const [chapterValue, setChapterValue] = useState(EMPTY_CHAPTER_VALUE);
  const chapterPickerRef = useRef(null);
  // Mock-only, per Quiz.negative_marks_per_wrong (Phase 4). Practice quizzes
  // never subtract, so this is not sent for them.
  const [negativeMarks, setNegativeMarks] = useState("0.25");

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
        setNegativeMarks(String(res.data.negative_marks_per_wrong ?? "0.25"));
        // Reads chapter_tags/no_specific_chapter/chapter_note off the draft.
        // Pre-Phase-3 drafts carry none of those and resolve to the empty
        // value, which is now a legitimate state rather than a broken form.
        setChapterValue(fromChapterPayload(res.data));
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

  // Batch + chapter pickers — same rationale as CreateAssignment.jsx's
  // teacher-scoped batch endpoint, with the same 404 fallback for a backend
  // that predates it.
  useEffect(() => {
    if (quizIdParam || !subjectId) return; // editing an existing quiz — skip
    let cancelled = false;
    api
      .get(`/assignments/teacher/subject/${subjectId}/batches/`)
      .catch((err) => {
        if (err?.response?.status !== 404) throw err;
        return api.get(`/courses/subjects/${subjectId}/batches/`);
      })
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setBatches(list);
        if (list.length === 1) setBatchId(String(list[0].id));
      })
      .catch(() => { if (!cancelled) setBatches([]); });

    // The chapter fetch that used to live here is gone: ChapterTagPicker owns
    // it now, and duplicating it would fire the same request twice per load.

    return () => { cancelled = true; };
  }, [subjectId, quizIdParam]);

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
    if (!quizId) {
      if (!batchId) {
        setError("Pick a batch before saving.");
        return;
      }
      // No chapter guard any more — Phase 3 made chapters optional and
      // multiple, and "no specific chapter" is an explicit, valid answer.
    }
    setSaving(true);
    setError(null);
    try {
      // Promote any chapters the teacher typed into real syllabus rows first,
      // so the tags can point at ids. Returns the unchanged value (and toasts)
      // if the promote call fails, so a save is never blocked by it.
      const resolvedChapters =
        (await chapterPickerRef.current?.resolveForSubmit()) ?? chapterValue;

      let id = quizId;
      if (!id) {
        const res = await api.post("/teacher/quizzes/", {
          subject: subjectId,
          title: title.trim(),
          description: "",
          quiz_type: quizType,
          time_limit_minutes: quizType === "mock" ? Number(timeLimit) : null,
          batch_id: batchId,
          // Practice quizzes never subtract, so the field is mock-only —
          // sending 0.25 on a practice quiz would persist a rule the type
          // ignores and then surface it if the teacher ever switched type.
          ...(quizType === "mock"
            ? { negative_marks_per_wrong: Number(negativeMarks) }
            : {}),
          ...toChapterPayload(resolvedChapters),
        });
        id = res.data.id;
        setQuizId(id);
      } else {
        await api.patch(`/teacher/quizzes/${id}/`, {
          title: title.trim(),
          quiz_type: quizType,
          time_limit_minutes: quizType === "mock" ? Number(timeLimit) : null,
          ...(quizType === "mock"
            ? { negative_marks_per_wrong: Number(negativeMarks) }
            : {}),
          ...toChapterPayload(resolvedChapters),
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button className="qb-back" onClick={() => navigate(subjectId ? `/teacher/classes/${subjectId}/quizzes` : "/teacher/quizzes")}>
          ← Back to quizzes
        </button>
        <TourHeaderButton pathname={pathname} />
      </div>

      {error && <div className="qb-error">{error}</div>}

      {/* ── T2 header: type fork, title, mode row ─────────────────────── */}
      <div className="qb2-head">
        <div className="qb2-types" role="radiogroup" aria-label="Test type">
          {QUIZ_TYPES.map(({ id, title: cardTitle, sub, Icon }) => {
            const on = quizType === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`qb2-type${on ? " qb2-type--on" : ""}`}
                onClick={() => setQuizType(id)}
              >
                <span className="qb2-type__tile"><Icon /></span>
                <span className="qb2-type__body">
                  <span className="qb2-type__title">{cardTitle}</span>
                  <span className="qb2-type__sub">{sub}</span>
                </span>
                <span className="qb2-type__radio">{on && <IoCheckmarkOutline />}</span>
              </button>
            );
          })}
        </div>

        <input
          className="qb2-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled test"
          aria-label="Test title"
        />

        {/* Mode row. These are the rules the type already implies — shown so a
            teacher can see what "mock" actually means without saving first.
            Only the two mock numbers are editable; the rest state facts. */}
        <div className="qb2-modes">
          {quizType === "mock" ? (
            <>
              <span className="qb2-pill">
                <IoTimeOutline />
                Timer
                <input
                  type="number" min={5} max={180} value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  className="qb2-pill__num" aria-label="Time limit in minutes"
                />
                min
              </span>
              <span className="qb2-pill">
                <IoRemoveCircleOutline />
                Negative marking
                <select
                  className="qb2-pill__select" value={negativeMarks}
                  onChange={(e) => setNegativeMarks(e.target.value)}
                  aria-label="Negative marks per wrong answer"
                >
                  {NEGATIVE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                per wrong
              </span>
              <span className="qb2-pill"><IoCheckmarkOutline /> One attempt only</span>
            </>
          ) : (
            <>
              <span className="qb2-pill"><IoRepeatOutline /> Unlimited retries</span>
              <span className="qb2-pill"><IoEyeOutline /> Show answer after each question</span>
            </>
          )}
          <span className="qb2-counts">
            {questions.length} questions · {totalMarks} marks
          </span>
        </div>
      </div>

      {/* Compact picker — chapters are optional and multiple (Phase 3). */}
      <ChapterTagPicker
        ref={chapterPickerRef}
        subjectId={subjectId}
        value={chapterValue}
        onChange={setChapterValue}
        variant="compact"
        noteLabel="Note for students"
        notePlaceholder="What this test covers, what to revise first…"
      />

      {/* Batch — create only; once the quiz exists it is fixed. The chapter
          controls that used to sit beside it are now the picker above. */}
      {!quizId && (
        <div className="qb-toolbar">
          <select className="qb-select" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code}){b.year ? ` — ${b.year}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="qb-actions">
        <button className="tk-btn" onClick={addQuestion} data-tour="quiz-builder.add-question">+ Add question</button>
        <button className="tk-btn tk-btn--ghost" onClick={() => setShowImport(true)}><IoClipboardOutline /> Bulk paste / import</button>
        <button className="tk-btn tk-btn--ghost" onClick={openBank} data-tour="quiz-builder.question-bank"><IoFolderOutline /> Question bank</button>
        <button className="qb-ai-btn" onClick={() => { setAiTopic(title); setShowAiModal(true); }} data-tour="quiz-builder.ai-generate"><IoSparklesOutline /> Generate with AI</button>
        <div className="qb-actions-right">
          <button className="tk-btn tk-btn--ghost" disabled={saving} onClick={() => persist({ publish: false })}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button className="qb-publish-btn" disabled={saving} onClick={() => persist({ publish: true })} data-tour="quiz-builder.submit-review">
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
