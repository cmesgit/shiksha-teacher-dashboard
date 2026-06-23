/**
 * src/pages/skill/ExpertCourses.jsx
 * Wired to:
 *   GET   /skill/teacher/courses/              → list teacher's courses
 *   POST  /skill/teacher/courses/              → create course
 *   PATCH /skill/teacher/courses/<id>/         → edit course
 *   POST  /skill/teacher/courses/<id>/submit/  → submit draft for review
 *   POST  /skill/teacher/courses/<id>/sections/ → add section (module)
 *
 * Course status flow: draft → submitted → approved | rejected
 */
import { useState, useEffect, useCallback } from "react";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import { COURSE_CATEGORIES } from "../../data/skillMockData";
import "../../styles/skillDev.css";

/* ── helpers ── */
function statusColor(st) {
  if (st === "approved") return { color: "#2f9d42", bg: "rgba(47,157,66,.12)" };
  if (st === "submitted") return { color: "#d97706", bg: "rgba(255,143,1,.10)" };
  if (st === "rejected") return { color: "#c0492f", bg: "rgba(192,73,47,.10)" };
  return { color: "#6b7c83", bg: "rgba(0,0,0,.06)" };
}
function statusLabel(st) {
  if (st === "approved")  return "Live";
  if (st === "submitted") return "In review";
  if (st === "rejected")  return "Rejected";
  return "Draft";
}

/* ── Create/Edit modal ── */
function EditCourse({ course, onClose, onSaved, isNew }) {
  const [title,   setTitle]   = useState(course?.title   || "");
  const [cat,     setCat]     = useState(course?.skill_tags?.[0] || COURSE_CATEGORIES[0]);
  const [price,   setPrice]   = useState(course?.price_rupees != null ? course.price_rupees : Math.round((course?.price || 0) / 100));
  const [level,   setLevel]   = useState(course?.level   || "beginner");
  const [mods,    setMods]    = useState(
    course?.sections?.map(s => ({ id: s.id, t: s.title, n: s.lectures?.length || 0, d: "" }))
    || [{ t: "", n: 1, d: "" }, { t: "", n: 1, d: "" }]
  );
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const setMod = (i, k, v) => setMods(ms => ms.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const addMod = () => setMods(ms => [...ms, { t: "", n: 1, d: "" }]);
  const delMod = (i) => setMods(ms => ms.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title.trim()) { setErr("Title is required."); return; }
    setSaving(true); setErr("");
    try {
      let saved;
      const payload = {
        title: title.trim(),
        skill_tags: [cat],
        price: price * 100,   // rupees → paise
        level,
      };
      if (isNew) {
        const r = await api.post("/skill/teacher/courses/", payload);
        saved = r.data;
      } else {
        await api.patch(`/skill/teacher/courses/${course.id}/`, payload);
        saved = { ...course, ...payload, price_rupees: price };
      }
      // Add / update sections (modules)
      for (const m of mods) {
        if (m.id) continue;  // existing sections: skip for now (add section edit later)
        if (!m.t.trim()) continue;
        await api.post(`/skill/teacher/courses/${saved.id || course.id}/sections/`, {
          title: m.t.trim(), order: mods.indexOf(m),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not save course. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="sk-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sk-modal">
        <div className="sk-modal__head">
          <div>
            <h3>{isNew ? "Create a new course" : "Edit course"}</h3>
            <p>{isNew ? "Set up your course details and curriculum" : "Update your course"}</p>
          </div>
          <button className="sk-modal__x" onClick={onClose}><Icon.x size={16} /></button>
        </div>
        <div className="sk-modal__body">
          {err && (
            <div style={{ background: "rgba(192,73,47,.1)", color: "#c0492f", padding: "10px 14px", borderRadius: 9, fontSize: 12.5, marginBottom: 12 }}>
              {err}
            </div>
          )}
          <div className="sk-modal__panel">
            <div className="sk-field">
              <label>Course title</label>
              <input className="sk-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Python & Data Science" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
              <div className="sk-field" style={{ marginBottom: 0 }}>
                <label>Category</label>
                <select className="sk-input" value={cat} onChange={e => setCat(e.target.value)}>
                  {COURSE_CATEGORIES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="sk-field" style={{ marginBottom: 0 }}>
                <label>Price (₹ / seat)</label>
                <input className="sk-input" type="number" value={price} onChange={e => setPrice(+e.target.value)} />
              </div>
            </div>
            <div className="sk-field" style={{ marginTop: 13, marginBottom: 0 }}>
              <label>Level</label>
              <div className="sk-seg">
                {["beginner", "intermediate", "advanced"].map(l => (
                  <button key={l} className={level === l ? "on" : ""} onClick={() => setLevel(l)}>
                    {l[0].toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sk-modal__panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontSize: 14, fontWeight: 800, color: "#1a2c33" }}>
                Curriculum · {mods.length} modules
              </div>
              <button className="sk-btn" style={{ padding: "7px 12px", fontSize: 11.5 }} onClick={addMod}>
                <Icon.plus size={13} /> Add module
              </button>
            </div>
            {mods.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 9 }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(19,137,155,.10)", color: "#0a808a", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                <input className="sk-input" style={{ flex: 1 }} value={m.t} onChange={e => setMod(i, "t", e.target.value)} placeholder="Module title" />
                <input className="sk-input" style={{ width: 58, textAlign: "center" }} type="number" value={m.n} onChange={e => setMod(i, "n", +e.target.value)} title="videos" />
                {mods.length > 1 && (
                  <button onClick={() => delMod(i)} style={{ background: "#fff", border: "1px solid #f0d6d2", color: "#c0492f", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon.x size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="sk-modal__foot">
          <button className="sk-btn sk-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="sk-btn" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create course" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpertCourses() {
  const [courses,  setCourses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [open,     setOpen]     = useState(null);
  const [editIdx,  setEditIdx]  = useState(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.get("/skill/teacher/courses/")
      .then(r => setCourses(Array.isArray(r.data) ? r.data : (r.data.results || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitForReview = async (course) => {
    setSubmitting(s => ({ ...s, [course.id]: true }));
    try {
      await api.post(`/skill/teacher/courses/${course.id}/submit/`);
      setCourses(cs => cs.map(c => c.id === course.id ? { ...c, status: "submitted" } : c));
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not submit. Please try again.");
    } finally {
      setSubmitting(s => { const n = { ...s }; delete n[course.id]; return n; });
    }
  };

  // Compute stats from live data
  const pub     = courses.filter(c => c.status === "approved").length;
  const totS    = courses.reduce((a, c) => a + (c.students_count || 0), 0);
  const rev     = courses.reduce((a, c) => a + ((c.price_rupees || 0) * (c.students_count || 0)), 0);

  const statCards = [
    { c: "#0a808a", icon: <Icon.doc size={16} />,    v: loading ? "—" : pub,                              l: "Published" },
    { c: "#2f9d42", icon: <Icon.users size={16} />,  v: loading ? "—" : totS,                             l: "Total students" },
    { c: "#ff8f01", icon: <Icon.star size={16} />,   v: "—",                                              l: "Avg rating" },
    { c: "#7c6fd0", icon: <Icon.shield size={16} />, v: loading ? "—" : `₹${(rev / 1000).toFixed(0)}k`,  l: "Course revenue" },
  ];

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">My self-paced courses</div>
          <div className="sk-head__sub">Pre-recorded video courses learners take at their own pace</div>
        </div>
        <button className="sk-btn" onClick={() => setCreating(true)}>
          <Icon.plus size={14} /> Create course
        </button>
      </div>

      <div className="rd-statgrid">
        {statCards.map(s => (
          <div key={s.l} className="rd-stat">
            <div className="ic" style={{ background: s.c + "22", color: s.c }}>{s.icon}</div>
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rd-card teacher"><div className="sk-empty">Loading courses…</div></div>
      ) : courses.length === 0 ? (
        <div className="rd-card teacher">
          <div className="sk-empty">
            No courses yet. Create your first self-paced course and submit it for review.
          </div>
        </div>
      ) : courses.map((c, i) => {
        const sc  = statusColor(c.status);
        const isDraft = c.status === "draft" || c.status === "rejected";
        const sections = c.sections || [];
        const lectureCount = c.lecture_count || sections.reduce((a, s) => a + (s.lectures?.length || 0), 0);

        return (
          <div key={c.id} className="rd-card teacher">
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 70, height: 70, borderRadius: 13, background: "linear-gradient(135deg,#13899b,#0a808a)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon.vid size={26} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, background: sc.bg, padding: "3px 9px", borderRadius: 100, textTransform: "uppercase", letterSpacing: ".3px" }}>
                    {statusLabel(c.status)}
                  </span>
                  {c.skill_tags?.slice(0,1).map(t => (
                    <span key={t} style={{ fontSize: 10, fontWeight: 700, color: "#0a808a", background: "rgba(19,137,155,.10)", padding: "3px 9px", borderRadius: 100, textTransform: "uppercase", letterSpacing: ".3px" }}>{t}</span>
                  ))}
                </div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontSize: 16.5, fontWeight: 800, color: "#1a2c33", margin: "7px 0 5px" }}>{c.title}</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#6b7c83" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon.users size={13} /> {c.students_count || 0} students</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon.doc size={13} /> {c.section_count || sections.length} modules · {lectureCount} lessons</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon.shield size={13} /> {c.level || "beginner"}</span>
                </div>
                {c.status === "rejected" && c.reject_reason && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(192,73,47,.08)", border: "1px solid rgba(192,73,47,.2)", borderRadius: 8, fontSize: 12, color: "#c0492f" }}>
                    Rejection reason: {c.reject_reason}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: "#1a2c33" }}>
                  ₹{((c.price_rupees || 0) * (c.students_count || 0)).toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: 10.5, color: "#6b7c83" }}>revenue · ₹{c.price_rupees || 0}/seat</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {sections.length > 0 && (
                <button
                  className="sk-btn sk-btn--ghost"
                  style={{ padding: "8px 13px", fontSize: 12 }}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  {open === i ? "Hide curriculum" : "View curriculum"}
                  <span style={{ transform: open === i ? "rotate(90deg)" : "none", display: "flex" }}><Icon.arrow size={12} /></span>
                </button>
              )}
              {(c.status === "approved" || c.status === "submitted") ? (
                <button className="sk-btn" style={{ padding: "8px 16px", fontSize: 12 }} onClick={() => setEditIdx(i)}>
                  Edit course
                </button>
              ) : (
                <>
                  <button className="sk-btn sk-btn--ghost" style={{ padding: "8px 16px", fontSize: 12 }} onClick={() => setEditIdx(i)}>
                    Edit
                  </button>
                  <button
                    className="sk-btn"
                    style={{ padding: "8px 16px", fontSize: 12 }}
                    onClick={() => submitForReview(c)}
                    disabled={submitting[c.id]}
                  >
                    {submitting[c.id] ? "Submitting…" : "Submit for review"}
                  </button>
                </>
              )}
            </div>

            {open === i && sections.length > 0 && (
              <div style={{ marginTop: 13 }}>
                {sections.map((s, si) => (
                  <div key={s.id || si} className="rd-syll">
                    <div className="sh">
                      <span className="num">{si + 1}</span>
                      <span className="st2">{s.title}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7c83" }}>
                        {s.lectures?.length || 0} videos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editIdx !== null && courses[editIdx] && (
        <EditCourse
          course={courses[editIdx]}
          onClose={() => setEditIdx(null)}
          onSaved={load}
        />
      )}
      {creating && (
        <EditCourse
          isNew
          course={null}
          onClose={() => setCreating(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
