/**
 * src/pages/skill/ExpertCourses.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * "My Courses" — self-paced course creator (Udemy-style), ported from the
 * prototype's TeachCourses + EditCourse. Stat row, course cards with a
 * curriculum accordion, and create/edit modal.
 *
 * Route: /teacher/expert/courses
 * API TODO: see src/data/skillMockData.js (MY_COURSES + course endpoints).
 */
import { useState } from "react";
import { Icon } from "../../components/SkillIcons";
import { MY_COURSES, COURSE_CATEGORIES } from "../../data/skillMockData";
import "../../styles/skillDev.css";

/* ── Create / edit course modal ── */
function EditCourse({ course, onClose, isNew }) {
  const [title, setTitle]   = useState(course.title);
  const [cat, setCat]       = useState(course.cat);
  const [price, setPrice]   = useState(course.price);
  const [status, setStatus] = useState(course.status);
  const [mods, setMods]     = useState(course.syllabus.map((m) => ({ ...m })));

  const setMod = (i, k, v) => setMods((ms) => ms.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));
  const addMod = () => setMods((ms) => [...ms, { t: "", n: 1, d: "" }]);
  const delMod = (i) => setMods((ms) => ms.filter((_, idx) => idx !== i));

  // API TODO: POST /api/skill/teacher/courses/ (create) or
  //           PATCH /api/skill/teacher/courses/<id>/ (edit), then add sections.
  const submit = () => { onClose(); };

  return (
    <div className="sk-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sk-modal">
        <div className="sk-modal__head">
          <div>
            <h3>{isNew ? "Create a new course" : "Edit course"}</h3>
            <p>{isNew ? "Set up your course details and curriculum" : "Update your course details and curriculum"}</p>
          </div>
          <button className="sk-modal__x" onClick={onClose}><Icon.x size={16} /></button>
        </div>

        <div className="sk-modal__body">
          <div className="sk-modal__panel">
            <div className="sk-field">
              <label>Course title</label>
              <input className="sk-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Python & Data Science" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
              <div className="sk-field" style={{ marginBottom: 0 }}>
                <label>Category</label>
                <select className="sk-input" value={cat} onChange={(e) => setCat(e.target.value)}>
                  {COURSE_CATEGORIES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="sk-field" style={{ marginBottom: 0 }}>
                <label>Price (₹ / seat)</label>
                <input className="sk-input" type="number" value={price} onChange={(e) => setPrice(+e.target.value)} />
              </div>
            </div>
            <div className="sk-field" style={{ marginTop: 13, marginBottom: 0 }}>
              <label>Status</label>
              <div className="sk-seg">
                {["Published", "Draft"].map((st) => (
                  <button key={st} className={status === st ? "on" : ""} onClick={() => setStatus(st)}>{st}</button>
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
                <input className="sk-input" style={{ flex: 1 }} value={m.t} onChange={(e) => setMod(i, "t", e.target.value)} placeholder="Module title" />
                <input className="sk-input" style={{ width: 58, textAlign: "center" }} type="number" value={m.n} onChange={(e) => setMod(i, "n", +e.target.value)} title="videos" />
                <input className="sk-input" style={{ width: 72, textAlign: "center" }} value={m.d} onChange={(e) => setMod(i, "d", e.target.value)} placeholder="dur" />
                <button onClick={() => delMod(i)} style={{ background: "#fff", border: "1px solid #f0d6d2", color: "#c0492f", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon.x size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sk-modal__foot">
          <button className="sk-btn sk-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="sk-btn" onClick={submit}>{isNew ? "Publish course" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

export default function ExpertCourses() {
  const [open, setOpen]         = useState(0);
  const [editIdx, setEditIdx]   = useState(null);
  const [creating, setCreating] = useState(false);

  const totS = MY_COURSES.reduce((a, c) => a + c.students, 0);
  const pub  = MY_COURSES.filter((c) => c.status === "Published").length;
  const rev  = MY_COURSES.reduce((a, c) => a + c.revenue, 0);

  const statCards = [
    { c: "#0a808a", icon: <Icon.doc size={16} />,    v: pub,                     l: "Published" },
    { c: "#2f9d42", icon: <Icon.users size={16} />,  v: totS,                    l: "Total students" },
    { c: "#ff8f01", icon: <Icon.star size={16} />,   v: "4.8",                   l: "Avg rating" },
    { c: "#7c6fd0", icon: <Icon.shield size={16} />, v: `₹${(rev / 1000).toFixed(0)}k`, l: "Course revenue" },
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
        {statCards.map((s) => (
          <div key={s.l} className="rd-stat">
            <div className="ic" style={{ background: s.c + "22", color: s.c }}>{s.icon}</div>
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {MY_COURSES.map((c, i) => {
        const draft = c.status === "Draft";
        return (
          <div key={c.title} className="rd-card teacher">
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 70, height: 70, borderRadius: 13, background: "linear-gradient(135deg,#13899b,#0a808a)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon.vid size={26} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#0a808a", background: "rgba(19,137,155,.10)", padding: "3px 9px", borderRadius: 100, textTransform: "uppercase", letterSpacing: ".3px" }}>{c.cat}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100, textTransform: "uppercase", letterSpacing: ".3px", color: draft ? "#d97706" : "#2f9d42", background: draft ? "rgba(255,143,1,.10)" : "rgba(47,157,66,.12)" }}>{c.status}</span>
                </div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontSize: 16.5, fontWeight: 800, color: "#1a2c33", margin: "7px 0 5px" }}>{c.title}</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#6b7c83" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon.users size={13} /> {c.students} students</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon.doc size={13} /> {c.modules} modules · {c.lessons} lessons</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon.clock size={13} /> {c.hrs}</span>
                  {c.rating && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#d97706", fontWeight: 700 }}><Icon.star size={12} /> {c.rating} ({c.reviews})</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: "#1a2c33" }}>₹{c.revenue.toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 10.5, color: "#6b7c83" }}>revenue · ₹{c.price.toLocaleString("en-IN")}/seat</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="sk-btn sk-btn--ghost"
                style={{ padding: "8px 13px", fontSize: 12 }}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {open === i ? "Hide curriculum" : "View curriculum"}
                <span style={{ transform: open === i ? "rotate(90deg)" : "none", display: "flex" }}><Icon.arrow size={12} /></span>
              </button>
              <button className="sk-btn" style={{ padding: "8px 16px", fontSize: 12 }} onClick={() => setEditIdx(i)}>
                {draft ? "Publish" : "Edit course"}
              </button>
            </div>
            {open === i && (
              <div style={{ marginTop: 13 }}>
                {c.syllabus.map((m, mi) => (
                  <div key={mi} className="rd-syll">
                    <div className="sh">
                      <span className="num">{mi + 1}</span>
                      <span className="st2">{m.t}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7c83" }}>{m.n} videos · {m.d}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editIdx !== null && <EditCourse course={MY_COURSES[editIdx]} onClose={() => setEditIdx(null)} />}
      {creating && (
        <EditCourse
          isNew
          course={{ title: "", cat: "Coding & Web", status: "Draft", price: 0, syllabus: [{ t: "", n: 1, d: "" }, { t: "", n: 1, d: "" }] }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
