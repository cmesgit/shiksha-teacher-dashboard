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
 * 3. The `search` state filters students by name/email/ID as user types
 *    → filter() runs on every render, comparing against the search query
 *
 * 4. Each row is clickable — navigates to student detail page
 *    → We pass student data via router state (no extra API call needed)
 *
 * ONE ROW = ONE STUDENT, NOT ONE ACCOUNT. This app is multi-profile: a parent
 * with three enrolled children is one login and three students, so several
 * rows can share the same `email`/`account_id`/`username`. `student.id` is the
 * learner-profile id (the student), which is why it — and never the email — is
 * the row key. Use displayNameOf() rather than `username` for the same reason.
 */

import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import "../styles/students.css";
import { LoadingState } from "../components/StateViews";

// full_name is optional on a learner profile; display_name is what the profile
// picker shows and is the only field that distinguishes siblings on one
// account, so it comes before the account-level `username` fallback.
const displayNameOf = (s) =>
  s.full_name || s.display_name || s.username || "Unnamed student";

export default function AllStudents() {
  const navigate = useNavigate();

  // State: stores the API response { total_students, students[] }
  const [data, setData] = useState(null);
  // State: the search input value
  const [search, setSearch] = useState("");
  // State: loading flag to show spinner/message while fetching
  const [loading, setLoading] = useState(true);

  // useEffect runs ONCE on mount (empty dependency array [])
  // It fetches all students from the backend
  useEffect(() => {
    async function fetchStudents() {
      try {
        const res = await api.get("/courses/teacher/all-students/");
        setData(res.data);
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoading(false); // Always stop loading, even on error
      }
    }

    fetchStudents();
  }, []);

  // Early returns for loading/error states
  if (loading) return <LoadingState label="Loading students" />;
  if (!data) return <div className="students-loading">Failed to load students.</div>;

  // Filter students based on search input
  // .filter() creates a NEW array with only matching items
  // .toLowerCase() makes the search case-insensitive
  const filtered = data.students.filter((s) => {
    const q = search.toLowerCase();
    return (
      displayNameOf(s).toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.student_id || "").toLowerCase().includes(q) ||
      // course_titles lists every course this student shares with the teacher;
      // course_title is only the first of them.
      (s.course_titles || [s.course_title]).join(" ").toLowerCase().includes(q)
    );
  });

  return (
    <div className="students-page">
      {/* Header with title and search */}
      <div className="students-header">
        <div>
          <h2 className="students-title">All Students</h2>
          <p className="students-subtitle">
            {data.total_students} student{data.total_students !== 1 ? "s" : ""} across all your classes
          </p>
        </div>

        <div className="students-search">
          <input
            type="text"
            placeholder="Search by name, email, ID or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FiSearch className="students-search-icon" />
        </div>
      </div>

      {/* Table or empty message */}
      {filtered.length === 0 ? (
        <p className="students-empty">
          {search ? "No students match your search." : "No students enrolled."}
        </p>
      ) : (
        <div className="students-table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Student ID</th>
                <th>Course</th>
                <th>Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {/* .map() loops through each student and renders a <tr> */}
              {filtered.map((student, idx) => (
                <tr
                  key={student.id || `account:${student.account_id}`}
                  className="students-row"
                  onClick={() =>
                    navigate(`/teacher/students/${student.id}`, {
                      state: { student },
                    })
                  }
                >
                  <td>{idx + 1}</td>
                  <td>
                    <div className="students-name-cell">
                      {/* Avatar: show image, emoji, or first letter fallback */}
                      <div className="students-avatar">
                        {student.avatar_type === "image" && student.avatar ? (
                          <img src={student.avatar} alt="" />
                        ) : student.avatar_type === "emoji" && student.avatar ? (
                          <span>{student.avatar}</span>
                        ) : (
                          <span>
                            {displayNameOf(student)[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span>{displayNameOf(student)}</span>
                    </div>
                  </td>
                  <td>{student.email}</td>
                  <td>{student.student_id || "—"}</td>
                  <td>{(student.course_titles || [student.course_title]).join(", ")}</td>
                  <td>
                    {new Date(student.enrolled_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
