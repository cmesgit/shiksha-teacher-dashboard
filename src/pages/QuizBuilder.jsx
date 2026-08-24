import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import TourHeaderButton from "../tour/TourHeaderButton";
import ChapterTagPicker from "../components/ChapterTagPicker";
import ConfirmDialog from "../components/ConfirmDialog";
import { EMPTY_CHAPTER_VALUE, toChapterPayload, fromChapterPayload } from "../utils/chapterTagPicker";
import "../styles/quiz-builder.css";
import "../styles/quiz-builder-v2.css";
import {
  IoTimeOutline, IoClipboardOutline, IoFolderOutline, IoSparklesOutline,
  IoCloseOutline, IoCheckmarkOutline,
  IoHelpCircleOutline, IoRepeatOutline, IoRemoveCircleOutline, IoEyeOutline,
  IoSend, IoCheckmarkCircle, IoLibraryOutline,
} from "react-icons/io5";
import { useAuth } from "../contexts/AuthContext";

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

/** "1 question" / "4 questions" — the counts row reads as prose, and a fresh
 *  quiz starts at exactly one of each, so the singular is the common case. */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
//   PATCH /teacher/quizzes/:id/assign/             make it live for the
//                                                  teacher's own batches
//                                                  (Phase 1 — replaces the
//                                                  publish/submit-for-review
//                                                  call this screen used to
//                                                  make; that endpoint still
//                                                  exists and still only asks
//                                                  an admin to look at the
//                                                  questions)
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
  sectionId: null,
  // Phase 5d: the spec's switch ships ON — a teacher's questions are
  // suggested to the ShikshaCom bank unless they opt out. Nothing goes live
  // in the shared bank without an admin accepting it either way.
  suggestToBank: true,
  bankState: "suggested",
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

  // Phase 0 put both quiz-v2 flags on the auth context, defaulted false, so a
  // backend that omits `feature_flags` reads as OFF rather than crashing here.
  const { featureFlags } = useAuth();
  const aiEnabled = !!featureFlags?.ai_question_drafting_enabled;

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
  // Handed up by the picker so the per-question chip (5d) can turn a tagged
  // chapter id into its name without a second request.
  const [chapterList, setChapterList] = useState([]);
  // Mock-only, per Quiz.negative_marks_per_wrong (Phase 4). Practice quizzes
  // never subtract, so this is not sent for them.
  const [negativeMarks, setNegativeMarks] = useState("0.25");
  // Phase 5c. Local `_id` is what questions point at; `serverId` is filled in
  // after the sections PUT, because a brand-new section has no uuid until the
  // server mints one and the questions PUT has to reference the real id.
  const [sections, setSections] = useState([]);
  const [confirmFlatten, setConfirmFlatten] = useState(false);

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
        // Sections keep their server uuid as the local `_id`, so questions
        // loaded with `section: <uuid>` line up without a translation table.
        setSections((res.data.sections || []).map((s) => ({
          _id: String(s.id),
          serverId: s.id,
          name: s.name,
        })));
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
          sectionId: q.section ? String(q.section) : null,
          // Read from the server, never assumed: defaulting this to true would
          // re-suggest every question the teacher had kept private the next
          // time they saved.
          suggestToBank: q.suggest_to_bank !== false,
          bankState: q.bank_state || "suggested",
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
  const isMock = quizType === "mock";

  /** What the per-question chapter chip shows. Question carries no chapter of
   *  its own, so this is the quiz's first tag — a real chapter's name if one
   *  is picked, else a free-text label. Null when nothing is tagged, so the
   *  chip disappears rather than rendering an empty pill. */
  const questionChapterLabel = useMemo(() => {
    if (chapterValue.noSpecific) return "No specific chapter";
    const first = chapterValue.chapterIds?.[0];
    if (first) return chapterList.find((c) => String(c.id) === String(first))?.title || null;
    return chapterValue.customLabels?.[0] || null;
  }, [chapterValue, chapterList]);

  /** Left-pane grouping. Each item carries the question's index in the FULL
   *  paper so the visible numbering stays continuous across sections — that
   *  is the number the student sees. A practice paper is one flat group; a
   *  mock is one group per section plus an "Ungrouped" bucket, which only
   *  appears when it actually holds something. */
  const groups = useMemo(() => {
    let buckets;
    if (!isMock) {
      buckets = [{ key: "flat", section: null, items: questions }];
    } else {
      buckets = sections.map((section) => ({
        key: section._id,
        section,
        items: questions.filter((q) => q.sectionId === section._id),
      }));
      const loose = questions.filter(
        (q) => !q.sectionId || !sections.some((s) => s._id === q.sectionId)
      );
      if (loose.length || !sections.length) {
        buckets.push({ key: "ungrouped", section: null, items: loose });
      }
    }

    // Number AFTER grouping, walking the buckets in the order they render.
    // For a mock the section order IS the paper order, so numbering has to
    // follow it — otherwise Section 1 sits at the top of the list holding
    // "Question 2" while the ungrouped bucket below it holds "Question 1".
    let n = 0;
    return buckets.map((b) => ({
      ...b,
      items: b.items.map((q) => ({ q, index: n++ })),
    }));
  }, [questions, sections, isMock]);

  /** The paper in the order the teacher sees it — what `order` must be saved
   *  as, so the student's numbering matches the builder's. */
  const orderedQuestions = useMemo(
    () => groups.flatMap((g) => g.items.map(({ q }) => q)),
    [groups]
  );

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
  function addQuestion(sectionId = null) {
    const q = { ...blankQuestion(), sectionId };
    setQuestions((prev) => [...prev, q]);
    setSelectedId(q._id);
  }

  /* ── Sections (Phase 5c) ────────────────────────────────────────────── */

  function addSection() {
    setSections((prev) => [
      ...prev,
      { _id: crypto.randomUUID(), serverId: null, name: `Section ${prev.length + 1}` },
    ]);
  }

  function renameSection(id, name) {
    setSections((prev) => prev.map((s) => (s._id === id ? { ...s, name } : s)));
  }

  function moveSection(id, delta) {
    setSections((prev) => {
      const i = prev.findIndex((s) => s._id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  /** Deleting a section keeps its questions — they fall back to the ungrouped
   *  list, mirroring the server's SET_NULL. "Merge this section into the main
   *  list" is the same gesture, and a mis-click can never destroy content. */
  function deleteSection(id) {
    setSections((prev) => prev.filter((s) => s._id !== id));
    setQuestions((prev) =>
      prev.map((q) => (q.sectionId === id ? { ...q, sectionId: null } : q))
    );
  }

  /** Leaving mock discards the grouping, so confirm before it happens rather
   *  than after. Practice papers have no sections by design. */
  function requestType(next) {
    if (next === quizType) return;
    if (quizType === "mock" && next === "practice" && sections.length > 0) {
      setConfirmFlatten(true);
      return;
    }
    setQuizType(next);
  }

  function flattenToPractice() {
    setQuizType("practice");
    setSections([]);
    setQuestions((prev) => prev.map((q) => ({ ...q, sectionId: null })));
    setConfirmFlatten(false);
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
      setAiNote(`${drafted.length} question${drafted.length === 1 ? "" : "s"} drafted by AI from "${aiTopic || title}" — review before you assign it.`);
      setShowAiModal(false);
    } catch (err) {
      setError(err.response?.data?.detail || "AI generation failed. Try again or add questions manually.");
    } finally {
      setAiLoading(false);
    }
  }

  function validQuestions() {
    // Walks `orderedQuestions`, not `questions`, so the `order` saved below
    // matches the grouped order on screen. Sending the raw state order would
    // renumber a sectioned mock the moment the student opened it.
    return orderedQuestions.filter(
      (q) =>
        q.text.trim() &&
        q.explanation.trim() &&
        q.choices.filter((c) => c.text.trim()).length >= 2 &&
        q.choices.some((c) => c.is_correct)
    );
  }

  async function persist({ assign }) {
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
      // Sections FIRST: a new section has no server id until this returns,
      // and the questions PUT below rejects a section id it doesn't know.
      // The endpoint matches by id, so a rename is a rename — never a
      // delete-and-recreate, which would NULL every question's section.
      let sectionIdMap = new Map();
      if (quizType === "mock" && sections.length) {
        const res = await api.put(`/teacher/quizzes/${id}/sections/`, {
          sections: sections.map((s, i) => ({
            ...(s.serverId ? { id: s.serverId } : {}),
            name: s.name.trim() || `Section ${i + 1}`,
            order: i,
          })),
        });
        const saved = res.data?.sections || res.data || [];
        // Returned in the order we sent, so position is the join key for the
        // ones that had no id to match on.
        sections.forEach((s, i) => {
          if (saved[i]?.id) sectionIdMap.set(s._id, String(saved[i].id));
        });
        setSections((prev) =>
          prev.map((s, i) => ({ ...s, serverId: saved[i]?.id ?? s.serverId }))
        );
      } else if (quizType === "practice") {
        // Practice papers are flat. Clear any grouping left over from a
        // type switch so the server doesn't keep orphaned sections around.
        await api.put(`/teacher/quizzes/${id}/sections/`, { sections: [] });
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
          // Always sent now, so ungrouping a question actually sticks — the
          // endpoint reads an absent key as "leave it alone".
          section: quizType === "mock"
            ? (sectionIdMap.get(q.sectionId) ?? q.sectionId ?? null)
            : null,
          suggest_to_bank: q.suggestToBank !== false,
          choices: q.choices.filter((c) => c.text.trim()),
        })),
      });
      if (assign) {
        // Phase 1 replaced submit-for-review with this: the teacher makes
        // their own quiz live for their own batches, no admin in the loop.
        // `batch_ids` is sent ONLY on create. The endpoint treats an absent
        // key as "leave the scope alone" (an empty list means "all batches"),
        // so on edit — where the batch picker is hidden and batchId is "" —
        // omitting it is what preserves the batches already assigned.
        await api.patch(`/teacher/quizzes/${id}/assign/`, {
          assign: true,
          ...(batchId ? { batch_ids: [batchId] } : {}),
        });
        toast.success(
          "Assigned — it's live for your batches now.",
          { duration: 5000 }
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
                onClick={() => requestType(id)}
                // The visible title lives in nested spans, which left the
                // radio with no computed accessible name — a screen reader
                // announced two unlabelled radios.
                aria-label={cardTitle}
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
            {plural(questions.length, "question")} · {plural(totalMarks, "mark")}
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
        onChaptersLoaded={setChapterList}
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
        {/* The AI entry point is admin-controlled and ships OFF. Gated, never
            removed (non-negotiable #7): when the flag is on, this is the
            existing modal untouched; when off, the slot below says who can
            turn it on rather than leaving a dead button or a silent gap. */}
        {aiEnabled ? (
          <button className="qb-ai-btn" onClick={() => { setAiTopic(title); setShowAiModal(true); }} data-tour="quiz-builder.ai-generate"><IoSparklesOutline /> Generate with AI</button>
        ) : (
          <span className="qb2-aislot">
            <span className="qb2-aislot__text">AI drafting is off</span>
            <span className="qb2-aislot__switch" aria-hidden="true" />
            <span className="qb2-aislot__hint">admin-controlled</span>
          </span>
        )}
        <div className="qb-actions-right">
          <button className="tk-btn tk-btn--ghost" disabled={saving} onClick={() => persist({ assign: false })}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            className="qb2-assign-btn"
            disabled={saving}
            onClick={() => persist({ assign: true })}
            data-tour="quiz-builder.submit-review"
          >
            <IoSend /> Assign to my batches
          </button>
        </div>
      </div>

      {/* Reassurance banner — the point of Phase 1 in one sentence. Teachers
          used to wait on an admin before a quiz reached their own class; they
          no longer do, and the screen has to say so or the old habit stands. */}
      <p className="qb2-reassure">
        <IoCheckmarkCircle className="qb2-reassure__icon" />
        <span>
          Goes live for your batches the moment you assign it — no admin
          approval. Your questions are also suggested to the ShikshaCom bank,
          where an admin curates them.
        </span>
        <button
          type="button"
          className="qb2-reassure__btn"
          onClick={() => navigate("/teacher/quiz-bank")}
        >
          Bank settings
        </button>
      </p>

      {aiNote && <div className="qb-ai-note"><IoSparklesOutline /> {aiNote}</div>}

      <div className="qb-split">
        <div className="qb-list">
          {/* Numbering runs across the whole paper, not per group — a student
              sees "Question 7", not "Section B question 2". */}
          {groups.map((group) => (
            <div className="qb2-group" key={group.key}>
              <div className="qb2-group__head">
                {group.section ? (
                  <input
                    className="qb2-group__name"
                    value={group.section.name}
                    onChange={(e) => renameSection(group.section._id, e.target.value)}
                    aria-label={`Section name: ${group.section.name}`}
                  />
                ) : (
                  <span className="qb2-group__name qb2-group__name--static">
                    {isMock ? "Ungrouped" : "Questions"}
                  </span>
                )}
                <span className="qb2-group__count">{group.items.length}</span>
                {group.section && (
                  <span className="qb2-group__ops">
                    <button type="button" onClick={() => moveSection(group.section._id, -1)} aria-label="Move section up" title="Move up">↑</button>
                    <button type="button" onClick={() => moveSection(group.section._id, 1)} aria-label="Move section down" title="Move down">↓</button>
                    <button type="button" onClick={() => deleteSection(group.section._id)} aria-label="Delete section (keeps its questions)" title="Delete section — its questions move to Ungrouped">×</button>
                  </span>
                )}
              </div>

              {group.items.map(({ q, index }) => (
                <div
                  key={q._id}
                  className={`qb-list-row ${q._id === selectedId ? "qb-list-row--active" : ""}`}
                  onClick={() => setSelectedId(q._id)}
                >
                  <span className="qb-list-num">{index + 1}</span>
                  <span className="qb-list-text">{q.text || "Untitled question"}</span>
                  {q.source === "bank" && <span className="qb2-bank-tag" title="From a question bank"><IoLibraryOutline /></span>}
                  {q.source === "ai" && <span className="qb-ai-tag" title="AI-drafted"><IoSparklesOutline /></span>}
                  <span
                    className="qb-list-del"
                    onClick={(e) => { e.stopPropagation(); deleteQuestion(q._id); }}
                  >
                    <IoCloseOutline />
                  </span>
                </div>
              ))}

              {isMock && group.section && (
                <button type="button" className="qb2-group__add" onClick={() => addQuestion(group.section._id)}>
                  + Question in this section
                </button>
              )}
            </div>
          ))}

          {isMock && (
            <button type="button" className="qb2-addsection" onClick={addSection}>
              + Add a section
            </button>
          )}
        </div>

        <div className="qb-editor">
          {selected && (
            <>
              <div className="qb-editor-head">
                <span className="qb-editor-qnum">Question {orderedQuestions.findIndex((q) => q._id === selectedId) + 1}</span>
                {/* The chapter this question is filed under. Question has no
                    chapter of its own in the data model — Phase 3 put chapter
                    tagging on the quiz — so this shows the quiz's, which is
                    what actually drives the student's weak-area report. */}
                {questionChapterLabel && (
                  <span className="qb2-qchip" title="From this test's chapter tags">
                    {questionChapterLabel}
                  </span>
                )}
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

              {/* Per-question bank opt-in. Defaults ON; turning it off is how
                  a teacher keeps a question that only makes sense to their own
                  class out of the shared library. The test runs either way. */}
              <div className="qb2-bankrow">
                <button
                  type="button"
                  role="switch"
                  aria-checked={selected.suggestToBank !== false}
                  aria-label="Suggest this question to the ShikshaCom bank"
                  className={`qb2-switch${selected.suggestToBank !== false ? " qb2-switch--on" : ""}`}
                  onClick={() => updateSelected({ suggestToBank: !(selected.suggestToBank !== false) })}
                >
                  <span className="qb2-switch__knob" />
                </button>
                <span className="qb2-bankrow__body">
                  <span className="qb2-bankrow__label">
                    Suggest this question to the ShikshaCom bank
                  </span>
                  <span className="qb2-bankrow__hint">
                    Turn off for questions specific to your class
                  </span>
                </span>
                {selected.bankState === "accepted" && (
                  <span className="qb2-bankrow__state">In the site bank</span>
                )}
                {selected.bankState === "changes_requested" && (
                  <span className="qb2-bankrow__state qb2-bankrow__state--warn">
                    Admin asked for changes
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        dialog={confirmFlatten ? {
          title: "Switch to a practice quiz?",
          message:
            `A practice quiz has no sections. Your ${plural(sections.length, "section")} ` +
            "will be removed and every question moved into one flat list. " +
            "The questions themselves are kept.",
          confirmLabel: "Switch and flatten",
          cancelLabel: "Keep it a mock test",
          danger: true,
          onConfirm: flattenToPractice,
        } : null}
        onClose={() => setConfirmFlatten(false)}
      />

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
              Drafts are not live — review and edit every question before you assign it.
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
