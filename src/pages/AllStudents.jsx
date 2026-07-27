/**
 * AllStudents.jsx
 *
 * HOW THIS PAGE WORKS:
 *
 * 1. On mount (useEffect), we call GET /courses/teacher/all-students/
 *    → This returns all students across all the teacher's classes
 *
 * 2. We store the response in `data` state
 *
 * 3. The `search` state filters students by name/email/ID/course as user types,
 *    and `batchFilter` filters by batch — this is the design's Students screen
 *    (Academy Dashboard.dc.html lines 2039–2074): flat row list, avatar +
 *    name + "Class {batch}" subline, batch-filter chip row above the list
 *    (dc.html's stuChips, hardcoded ["All","10-A","10-B","9-A"] there — derived
 *    here from whatever batch_code values actually appear so the filter stays
 *    truthful for any real roster).
 *
 * 4. Each row is clickable — navigates to student detail page. The design's
 *    own row has no click-through (its row only wires a "Message" button that
 *    just jumps to the Messages tab, not a real per-student feature) — but this
 *    app already has a real student-detail page, so the click-through is kept
 *    verbatim rather than dropped to match the prototype.
 *
 * Divergence from the design's row — deliberate, not an oversight: the mockup
 * additionally shows a per-student "Attendance %" and "Avg score" stat and a
 * "Last active" line. None of those exist anywhere in this API response or in
 * any cheap-to-add backend source (confirmed against TeacherAllStudentsView) —
 * the only real attendance figure that exists is a batch-level average used by
 * BatchProgressDetail, not a per-student one. Rather than fabricate numbers,
 * the row's right-hand slot shows the student's real `enrolled_at` date
 * instead, the same "don't show a stat with no data behind it" call already
 * made elsewhere in this project.
 *
 * ONE ROW = ONE STUDENT, NOT ONE ACCOUNT. This app is multi-profile: a parent
 * with three enrolled children is one login and three students, so several
 * rows can share the same `email`/`account_id`/`username`. `student.id` is the
 * learner-profile id (the student), which is why it — and never the email — is
 * the row key. Use displayNameOf() rather than `username` for the same reason.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import api from "../api/apiClient";
import { LoadingState, ErrorState } from "../components/StateViews";
import { subjectChipPalette } from "../utils/subjectChips";
import "../styles/academyScreens.css";

// full_name is optional on a learner profile; display_name is what the profile
// picker shows and is the only field that distinguishes siblings on one
// account, so it comes before the account-level `username` fallback.
const displayNameOf = (s) =>
  s.full_name || s.display_name || s.username || "Unnamed student";

const initialsOf = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "S";

const ALL_BATCHES = "All";

const fmtEnrolled = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function AllStudents() {
  const navigate = useNavigate();

  // State: stores the API response { total_students, students[] }
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState(ALL_BATCHES);

  // useEffect runs ONCE on mount (empty dependency array [])
  useEffect(() => {
    let cancelled = false;

    async function fetchStudents() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/courses/teacher/all-students/");
        if (cancelled) return;
        setData(res.data);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load students", err);
        setError("Failed to load students.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStudents();
    return () => { cancelled = true; };
  }, []);

  const students = useMemo(() => data?.students || [], [data]);

  // Batch chips, from the batches that actually appear in the roster. The
  // design hardcodes ["All","10-A","10-B","9-A"]; deriving them keeps the
  // control truthful for any real timetable.
  const batchChips = useMemo(() => {
    const codes = [...new Set(students.map((s) => s.batch_code).filter(Boolean))].sort();
    return [ALL_BATCHES, ...codes];
  }, [students]);

  // Filter by batch, then by the free-text search (name/email/ID/course). The
  // design's Students screen has no search box in its static prototype, but
  // this is real working functionality with no design equivalent replacing
  // it — filter chips filter by batch, not by text — so it's kept per this
  // project's standing rule: don't delete real functionality just because the
  // mockup doesn't show it.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => batchFilter === ALL_BATCHES || (s.batch_code || "") === batchFilter)
      .filter((s) => {
        if (!q) return true;
        return (
          displayNameOf(s).toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          (s.student_id || "").toLowerCase().includes(q) ||
          // course_titles lists every course this student shares with the
          // teacher; course_title is only the first of them.
          (s.course_titles || [s.course_title]).join(" ").toLowerCase().includes(q)
        );
      });
  }, [students, search, batchFilter]);

  if (loading) return <div className="ac-screen"><LoadingState label="Loading students" /></div>;
  if (error) return <div className="ac-screen"><ErrorState message={error} /></div>;

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Students</h1>
          <p className="ac-head__sub">All students across your batches.</p>
        </div>
      </div>

      <div className="ac-filterBar">
        <div className="ac-pills">
          {batchChips.map((b) => (
            <button
              key={b}
              type="button"
              className={`ac-pill${batchFilter === b ? " is-active" : ""}`}
              onClick={() => setBatchFilter(b)}
            >
              {b === ALL_BATCHES ? "All" : b}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="ac-searchInput"
          placeholder="Search by name, email, ID or course…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search students"
        />
      </div>

      <section className="ac-listCard">
        <div className="ac-list">
          {filtered.length === 0 ? (
            <div className="ac-emptyRow">
              {search || batchFilter !== ALL_BATCHES
                ? "No students match your filters."
                : "No students enrolled."}
            </div>
          ) : (
            filtered.map((student) => {
              const name = displayNameOf(student);
              const chip = subjectChipPalette(name);
              return (
                <div
                  key={student.id || `account:${student.account_id}`}
                  className="ac-row"
                  onClick={() =>
                    navigate(`/teacher/students/${student.id}`, {
                      state: { student },
                    })
                  }
                >
                  <div className="ac-row__avatar" style={{ background: chip.bg, color: chip.ink }}>
                    {student.avatar_type === "image" && student.avatar ? (
                      <img src={student.avatar} alt="" />
                    ) : student.avatar_type === "emoji" && student.avatar ? (
                      <span>{student.avatar}</span>
                    ) : (
                      <span>{initialsOf(name)}</span>
                    )}
                  </div>

                  <div className="ac-row__body">
                    <div className="ac-row__topic">{name}</div>
                    <div className="ac-row__sub">
                      {student.batch_code ? `Class ${student.batch_code}` : "No batch assigned"}
                    </div>
                  </div>

                  <div className="ac-row__stat">
                    <div className="ac-row__statValue">{fmtEnrolled(student.enrolled_at)}</div>
                    <div className="ac-row__statLabel">Enrolled</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
