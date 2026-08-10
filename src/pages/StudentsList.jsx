import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import "../styles/students.css";
import { LoadingState } from "../components/StateViews";

// ONE ROW = ONE STUDENT, NOT ONE ACCOUNT. This app is multi-profile: a parent
// with three enrolled children is one login and three students, so several rows
// can share the same `email`/`account_id`/`username`. `student.id` is the
// learner-profile id (the student) — full_name is optional on a profile, so
// fall back to display_name (what the profile picker shows, and the only field
// that distinguishes siblings) before the account-level `username`.
const displayNameOf = (s) =>
  s.full_name || s.display_name || s.username || "Unnamed student";

export default function StudentsList() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const backPath = `/teacher/classes/${subjectId}`;

  useEffect(() => {
    async function fetchStudents() {
      try {
        const res = await api.get(`/courses/subjects/${subjectId}/students/`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoading(false);
      }
    }

    if (subjectId) fetchStudents();
  }, [subjectId]);

  if (loading) return <LoadingState label="Loading students" />;

  if (!data) return <div className="students-loading">Failed to load students.</div>;

  const filtered = data.students;

  return (
    <div className="students-page">
      <button className="students-back-btn" onClick={() => navigate(backPath)}>
        <IoChevronBack /> Back
      </button>

      <div className="students-header">
        <div>
          <h2 className="students-title">Students</h2>
          <p className="students-subtitle">
            {data.subject_name} &middot; {data.course_title} &middot;{" "}
            {data.total_students} student{data.total_students !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="students-empty">No students enrolled.</p>
      ) : (
        <div className="students-table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Student ID</th>
                <th>Batch</th>
                <th>Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, idx) => (
                <tr
                  key={student.id || `account:${student.account_id}`}
                  className="students-row"
                  onClick={() =>
                    navigate(
                      `/teacher/classes/${subjectId}/students/${student.id}`,
                      { state: { student, subjectName: data.subject_name } }
                    )
                  }
                >
                  <td>{idx + 1}</td>
                  <td>
                    <div className="students-name-cell">
                      <div className="students-avatar">
                        {student.avatar_type === "image" && student.avatar ? (
                          <img src={student.avatar} alt="" />
                        ) : student.avatar_type === "emoji" && student.avatar ? (
                          <span>{student.avatar}</span>
                        ) : (
                          <span>{displayNameOf(student)[0].toUpperCase()}</span>
                        )}
                      </div>
                      <span>{displayNameOf(student)}</span>
                    </div>
                  </td>
                  <td>{student.email}</td>
                  <td>{student.student_id || "—"}</td>
                  <td>{student.batch_code || "—"}</td>
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
