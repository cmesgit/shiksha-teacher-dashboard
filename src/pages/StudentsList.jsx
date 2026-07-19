import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import "../styles/students.css";
import { LoadingState } from "../components/StateViews";

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
                  key={student.id}
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
                          <span>{(student.full_name || "?")[0].toUpperCase()}</span>
                        )}
                      </div>
                      <span>{student.full_name || student.username}</span>
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
