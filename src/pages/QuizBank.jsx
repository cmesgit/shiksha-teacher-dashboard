import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoChevronBack, IoCheckmarkCircle } from "react-icons/io5";
import { FiSearch } from "react-icons/fi";
import api from "../api/apiClient";
import "../styles/quiz-bank.css";
import { LoadingState } from "../components/StateViews";

const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };

function BankCard({ q, scope }) {
  const correctId = q.choices?.find((c) => c.is_correct)?.id;
  return (
    <div className="qbk-card">
      <div className="qbk-card-top">
        {q.topic && <span className="qbk-chip qbk-chip--topic">{q.topic}</span>}
        <span className={`qbk-chip qbk-chip--diff qbk-chip--${q.difficulty}`}>
          {DIFF_LABEL[q.difficulty] || q.difficulty}
        </span>
        <span className="qbk-marks">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
        {scope === "school" && (
          <span className="qbk-author" title={q.author_name}>by {q.author_name}</span>
        )}
      </div>
      <div className="qbk-card-text">{q.text}</div>
      <div className="qbk-choices">
        {(q.choices || []).map((c) => (
          <div key={c.id} className={`qbk-choice ${c.id === correctId ? "qbk-choice--correct" : ""}`}>
            {c.id === correctId && <IoCheckmarkCircle />}
            <span>{c.text}</span>
          </div>
        ))}
      </div>
      {q.explanation && (
        <div className="qbk-explanation"><strong>Explanation:</strong> {q.explanation}</div>
      )}
      <div className="qbk-card-footer">
        <span className="qbk-subject">{q.subject_name}</span>
        <span className="qbk-source">from “{q.quiz_title}”</span>
      </div>
    </div>
  );
}

export default function QuizBank() {
  const navigate = useNavigate();

  const [scope, setScope] = useState("mine");
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({ subjects: [], topics: [], difficulties: [] });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/teacher/question-bank/filters/");
        setFilters(res.data);
      } catch (err) {
        console.error("Failed to load bank filters", err);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/teacher/question-bank/", {
          params: {
            scope,
            subject: subjectId || undefined,
            topic: topic || undefined,
            difficulty: difficulty || undefined,
            search: search || undefined,
          },
        });
        if (!cancelled) setItems(res.data.results || res.data);
      } catch (err) {
        console.error("Failed to load question bank", err);
        if (!cancelled) setError("Failed to load the question bank.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, subjectId, topic, difficulty, search]);

  const emptyMessage = useMemo(() => {
    if (scope === "mine") {
      return "Questions you write in any approved quiz are saved here automatically — nothing finalized yet.";
    }
    return "No shared questions match these filters yet. Try clearing a filter, or check back once colleagues publish more quizzes.";
  }, [scope]);

  return (
    <div className="qbk-page">
      <button className="qbk-back-btn" onClick={() => navigate("/teacher/dashboard")}>
        <IoChevronBack /> Back
      </button>

      <div className="qbk-header">
        <div>
          <h2 className="qbk-title">Quiz Bank</h2>
          <p className="qbk-subtitle">
            A searchable library of finalized (admin-approved) questions you can draw on when building new quizzes.
          </p>
        </div>
      </div>

      <div className="qbk-toolbar">
        <div className="qbk-tabs">
          <button
            className={`qbk-tab ${scope === "mine" ? "qbk-tab--active" : ""}`}
            onClick={() => setScope("mine")}
          >
            My questions
          </button>
          <button
            className={`qbk-tab ${scope === "school" ? "qbk-tab--active" : ""}`}
            onClick={() => setScope("school")}
          >
            School library
          </button>
        </div>

        <div className="qbk-filters">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">All my subjects</option>
            {filters.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">All topics</option>
            {filters.topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">All difficulties</option>
            {filters.difficulties.map((d) => (
              <option key={d} value={d}>{DIFF_LABEL[d] || d}</option>
            ))}
          </select>
          <div className="qbk-search">
            <FiSearch />
            <input
              placeholder="Search by topic or keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="qbk-scope-note">
        {scope === "mine"
          ? "Every question you write in any approved quiz is saved here automatically."
          : "Shared by other teachers assigned to your subjects — scoped to what you're approved to teach."}
      </div>

      {loading ? (
        <LoadingState plain label="Loading quizzes" />
      ) : error ? (
        <div className="qbk-error">{error}</div>
      ) : items.length === 0 ? (
        <div className="qbk-empty">{emptyMessage}</div>
      ) : (
        <div className="qbk-grid">
          {items.map((q) => (
            <BankCard key={q.id} q={q} scope={scope} />
          ))}
        </div>
      )}
    </div>
  );
}
