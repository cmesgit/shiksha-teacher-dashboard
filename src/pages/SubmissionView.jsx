import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import "../styles/submission-view.css";
import { LoadingState, ErrorState } from "../components/StateViews";

export default function SubmissionView() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all"); // all | submitted | pending

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const fetchSubmissions = async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(
        `/assignments/teacher/${assignmentId}/submissions/`
      );
      const formatted = res.data.map((s) => ({
        id: s.id,
        name: s.student_name,
        submittedOn: s.submitted_at,
        status: s.submitted_file ? "Submitted" : "Pending",
        file: s.submitted_file,

        // ✅ already correct
        submissionStatus: s.submission_status || "",
      }));
      setStudents(formatted);
    } catch (err) {
      console.error("Failed to load submissions", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const total = students.length;
  const submittedCount = students.filter((s) => s.status === "Submitted").length;
  const pendingCount = total - submittedCount;

  const filteredStudents = students
    .filter((s) => {
      if (filter === "submitted") return s.status === "Submitted";
      if (filter === "pending") return s.status === "Pending";
      return true;
    })
    .sort((a, b) =>
      a.status === b.status ? 0 : a.status === "Submitted" ? -1 : 1
    );

  if (loading) return <LoadingState label="Loading submissions" />;
  if (error) return <ErrorState message="Couldn't load submissions." onRetry={fetchSubmissions} />;

  return (
    <div className="sv-page">

      <button className="sv-back-btn" onClick={() => navigate(-1)}>
        <IoChevronBack /> Back
      </button>

      <div className="sv-header">
        <h2 className="sv-title">Assignment Submissions</h2>
      </div>

      <div className="sv-content-card">

        {/* Summary */}
        <div className="sv-summary">
          <div
            className={`sv-stat-chip submitted ${filter === "submitted" ? "active" : ""}`}
            onClick={() => setFilter(filter === "submitted" ? "all" : "submitted")}
          >
            <span className="sv-stat-number">{submittedCount}</span>
            <span className="sv-stat-slash">/</span>
            <span className="sv-stat-total">{total}</span>
            <span className="sv-stat-label">Submitted</span>
          </div>

          <div
            className={`sv-stat-chip pending ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter(filter === "pending" ? "all" : "pending")}
          >
            <span className="sv-stat-number">{pendingCount}</span>
            <span className="sv-stat-slash">/</span>
            <span className="sv-stat-total">{total}</span>
            <span className="sv-stat-label">Pending</span>
          </div>

          {filter !== "all" && (
            <button className="sv-clear-filter" onClick={() => setFilter("all")}>
              Reset
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="sv-progress-bar-track">
          <div
            className="sv-progress-bar-fill"
            style={{ width: total ? `${(submittedCount / total) * 100}%` : "0%" }}
          />
        </div>
        <p className="sv-progress-label">
          {total ? Math.round((submittedCount / total) * 100) : 0}% submitted
        </p>

        {/* Table */}
        <div className="sv-table-scroll">
        <table className="sv-table">
          <thead>
            <tr>
              <th>Sl No.</th>
              <th>Name</th>
              <th>Submitted On</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="5" className="sv-empty">
                  No matching results
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => (
                <tr key={student.id} className="sv-table-row">
                  <td>{index + 1}</td>
                  <td className="sv-name-cell">{student.name}</td>
                  <td>{formatDate(student.submittedOn)}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span
                        className={`sv-status-badge ${
                          student.status === "Submitted" ? "submitted" : "pending"
                        }`}
                      >
                        {student.status}
                      </span>

                      {/* ✅ Late / On time */}
                      {student.status === "Submitted" && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: student.submissionStatus === "Late" ? "red" : "green",
                          }}
                        >
                          {student.submissionStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {student.file ? (
                      <a
                        href={student.file}
                        target="_blank"
                        rel="noreferrer"
                        className="sv-review-btn"
                      >
                        Review
                      </a>
                    ) : (
                      <span className="sv-no-file">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

      </div>
    </div>
  );
}