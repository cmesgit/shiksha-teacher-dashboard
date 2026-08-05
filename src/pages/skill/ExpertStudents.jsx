/**
 * src/pages/skill/ExpertStudents.jsx — NEW screen (design_handoff_skilldev
 * Expert "3. Students · mastery tracker"), verified against the live
 * standalone prototype: target stepper, 4-up stat grid, filter pills, one
 * card per student with progress/status/note/Mark-complete/Message.
 *
 * GET  /skill/teacher/students/
 * PUT  /skill/teacher/mastery-target/
 * POST /skill/teacher/students/<learner_id>/mark-complete/
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/apiClient";
import MasteryBar from "../../components/MasteryBar";
import { useSkillToast } from "../../components/useSkillToast";
import "../../styles/skillDev.css";
import "../../styles/expertStudents.css";
import { LoadingState } from "../../components/StateViews";

function fmtWhen(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    const tom = new Date(now); tom.setDate(now.getDate() + 1);
    const t = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    if (sameDay(d, now)) return `Today · ${t}`;
    if (sameDay(d, tom)) return `Tomorrow · ${t}`;
    return `${d.toLocaleDateString("en-IN", { weekday: "short" })} · ${t}`;
  } catch { return null; }
}
function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return "—"; }
}

export default function ExpertStudents() {
  const navigate = useNavigate();
  const showToast = useSkillToast();
  const [data, setData] = useState({ mastery_target: 3, stats: {}, students: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [savingTarget, setSavingTarget] = useState(false);

  const load = () => {
    api.get("/skill/teacher/students/")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const setTarget = async (next) => {
    if (next < 1 || next > 12 || savingTarget) return;
    setSavingTarget(true);
    try {
      await api.put("/skill/teacher/mastery-target/", { target: next });
      setData((d) => ({ ...d, mastery_target: next }));
    } finally { setSavingTarget(false); }
  };

  const markComplete = async (s) => {
    try {
      const r = await api.post(`/skill/teacher/students/${s.learner_id}/mark-complete/`);
      setData((d) => ({
        ...d,
        students: d.students.map((x) => (x.learner_id === s.learner_id
          ? { ...x, progress: r.data.progress, mastered: r.data.mastered }
          : x)),
      }));
      showToast(r.data.mastered ? `${s.name.split(" ")[0]} has mastered your course.` : "Session marked complete.");
    } catch {
      showToast("Couldn't mark complete — check for a confirmed session.");
    }
  };

  const openChat = (s) => navigate("/teacher/expert/inbox", { state: { learnerId: s.learner_id, learnerName: s.name } });

  const { mastery_target, stats, students } = data;
  const visible = filter === "all" ? students : filter === "mastered" ? students.filter((s) => s.mastered) : students.filter((s) => !s.mastered);

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="es-eyebrow">Mastery tracking</div>
          <div className="sk-head__title">Student progress</div>
        </div>
      </div>

      <div className="es-targetRow">
        <span className="es-targetLabel">Sessions to master</span>
        <button className="es-stepBtn" onClick={() => setTarget(mastery_target - 1)} disabled={mastery_target <= 1 || savingTarget}>−</button>
        <span className="es-targetValue">{mastery_target} sessions</span>
        <button className="es-stepBtn" onClick={() => setTarget(mastery_target + 1)} disabled={mastery_target >= 12 || savingTarget}>+</button>
      </div>

      <div className="es-statGrid">
        <div className="es-statTile"><div className="es-statValue">{loading ? "—" : stats.active_students ?? 0}</div><div className="es-statLabel">Active students</div></div>
        <div className="es-statTile"><div className="es-statValue">{loading ? "—" : stats.reached_mastery ?? 0}</div><div className="es-statLabel">Reached mastery</div></div>
        <div className="es-statTile"><div className="es-statValue">{loading ? "—" : stats.sessions_delivered ?? 0}</div><div className="es-statLabel">Sessions delivered</div></div>
        <div className="es-statTile"><div className="es-statValue">{mastery_target}</div><div className="es-statLabel">Sessions to master</div></div>
      </div>

      <div className="es-filters">
        <button className={`es-filterPill ${filter === "active" ? "is-active" : ""}`} onClick={() => setFilter("active")}>
          In progress · {students.filter((s) => !s.mastered).length}
        </button>
        <button className={`es-filterPill ${filter === "mastered" ? "is-active" : ""}`} onClick={() => setFilter("mastered")}>
          Mastered · {students.filter((s) => s.mastered).length}
        </button>
        <button className={`es-filterPill ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>
          All students · {students.length}
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading students" />
      ) : visible.length === 0 ? (
        <div className="sk-empty">No students in this view yet.</div>
      ) : visible.map((s) => {
        const next = fmtWhen(s.next_session);
        return (
          <div key={s.learner_id} className="es-card">
            <div className="es-cardTop">
              <div className="es-avatar">{(s.name || "?")[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="es-name">{s.name}<span className={`es-statusChip ${s.mastered ? "is-mastered" : ""}`}>{s.mastered ? "Mastered" : `${s.target - s.progress} to go`}</span></div>
                <div className="es-track">{s.track} · last session {fmtDate(s.last_session)}</div>
              </div>
              <div className="es-nextSession">
                <div className="es-nextLabel">Next session</div>
                <div className={next ? "es-nextValue" : "es-nextEmpty"}>{next || "No session booked"}</div>
              </div>
            </div>
            <MasteryBar progress={s.progress} target={s.target} mastered={s.mastered} sentence={null} />
            <div className="es-progressLine">{s.progress} / {s.target} sessions</div>
            {s.note && <div className="es-note">{s.note}</div>}
            <div className="es-cardActions">
              {!s.mastered && <button className="es-btn es-btn--primary" onClick={() => markComplete(s)}>Mark session complete</button>}
              <button className="es-btn es-btn--outline" onClick={() => openChat(s)}>Message</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
