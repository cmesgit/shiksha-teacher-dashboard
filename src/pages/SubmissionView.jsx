import { useNavigate, useParams, useLocation } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { Fragment, useEffect, useState } from "react";
import api from "../api/apiClient";
import "../styles/submission-view.css";
import { LoadingState, ErrorState } from "../components/StateViews";
import TourHeaderButton from "../tour/TourHeaderButton";
import SubmissionPreview from "../components/SubmissionPreview";

export default function SubmissionView() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { assignmentId } = useParams();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  // The message itself, not a boolean. A bad id (404) and a staffing problem
  // (403) used to render the identical "Couldn't load submissions." card,
  // which is how a wrong-id bug in the notification bell looked exactly like
  // a server outage and took a cross-repo trace to tell apart.
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(null);
  const [filter, setFilter] = useState("all"); // all | submitted | pending
  const [gradingId, setGradingId] = useState(null);
  const [marksInput, setMarksInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [gradeErr, setGradeErr] = useState("");

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
    setError("");
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
        fileName: s.submitted_file_name || "",

        // ✅ already correct
        submissionStatus: s.submission_status || "",
        marksObtained: s.marks_obtained,
        maxMarks: s.max_marks,
        feedback: s.feedback || "",
        gradedAt: s.graded_at,
      }));
      setStudents(formatted);
    } catch (err) {
      console.error("Failed to load submissions", err);
      const status = err?.response?.status;
      if (status === 404) {
        setError(
          "This assignment no longer exists, or that link points somewhere else. " +
          "Open it from the Assignments list instead."
        );
      } else if (status === 403) {
        setError("You're not assigned to this class, so its submissions aren't visible to you.");
      } else {
        setError("Couldn't load submissions.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const openGrading = (student) => {
    setGradingId(student.id);
    setMarksInput(student.marksObtained ?? "");
    setFeedbackInput(student.feedback || "");
    setGradeErr("");
  };

  const closeGrading = () => {
    setGradingId(null);
    setGradeErr("");
  };

  const saveGrade = async (student) => {
    if (marksInput === "" || marksInput === null) {
      setGradeErr("Enter a mark first.");
      return;
    }
    setSaving(true);
    setGradeErr("");
    try {
      const res = await api.post(`/assignments/teacher/submissions/${student.id}/grade/`, {
        marks_obtained: marksInput,
        feedback: feedbackInput,
      });
      setStudents((ss) => ss.map((s) => (s.id === student.id ? {
        ...s,
        marksObtained: res.data.marks_obtained,
        maxMarks: res.data.max_marks,
        feedback: res.data.feedback,
        gradedAt: res.data.graded_at,
      } : s)));
      setGradingId(null);
    } catch (err) {
      setGradeErr(err?.response?.data?.marks_obtained || "Couldn't save the grade. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
  if (error) return <ErrorState message={error} onRetry={fetchSubmissions} />;

  return (
    <div className="sv-page">

      <button className="sv-back-btn" onClick={() => navigate(-1)}>
        <IoChevronBack /> Back
      </button>

      <div className="sv-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 className="sv-title">Assignment Submissions</h2>
        <TourHeaderButton pathname={pathname} />
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
              <th>Grade</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="6" className="sv-empty">
                  No matching results
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => (
                <Fragment key={student.id}>
                <tr className="sv-table-row">
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
                    {student.marksObtained != null ? (
                      <span className="sv-status-badge submitted">
                        {student.marksObtained}/{student.maxMarks}
                      </span>
                    ) : (
                      <span className="sv-no-file">Ungraded</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* Was an <a target="_blank"> straight at the file, so
                          reviewing meant a new tab at best and a download to
                          disk at worst. Opens in place now; the overlay still
                          offers Download for formats a browser can't render. */}
                      {student.file && (
                        <button
                          type="button"
                          className="sv-review-btn"
                          onClick={() => setPreviewing(student)}
                        >
                          Review
                        </button>
                      )}
                      {student.status === "Submitted" && gradingId !== student.id && (
                        <button
                          type="button"
                          className="sv-review-btn"
                          onClick={() => openGrading(student)}
                          data-tour="submissions.grade-btn"
                        >
                          {student.marksObtained != null ? "Edit grade" : "Grade"}
                        </button>
                      )}
                      {!student.file && student.marksObtained == null && (
                        <span className="sv-no-file">—</span>
                      )}
                    </div>
                  </td>
                </tr>
                {gradingId === student.id && (
                  <tr className="sv-table-row">
                    <td colSpan="6">
                      <div className="sv-grade-form" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }} data-tour="submissions.marks-input">
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="number"
                            min="0"
                            max={student.maxMarks || 100}
                            value={marksInput}
                            onChange={(e) => setMarksInput(e.target.value)}
                            placeholder="Marks"
                            style={{ width: 80 }}
                          />
                          <span>/ {student.maxMarks || 100}</span>
                        </div>
                        <textarea
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder="Feedback for the student (optional)"
                          rows={3}
                        />
                        {gradeErr && <div style={{ color: "red", fontSize: 13 }}>{gradeErr}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            className="sv-review-btn"
                            disabled={saving}
                            onClick={() => saveGrade(student)}
                            data-tour="submissions.save-grade"
                          >
                            {saving ? "Saving…" : "Save grade"}
                          </button>
                          <button type="button" className="sv-review-btn" onClick={closeGrading} disabled={saving}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
        </div>

      </div>

      {previewing && (
        <SubmissionPreview
          // Keyed so switching between two students' files remounts rather
          // than reusing the instance — which is what lets the preview derive
          // its initial loading state from the props instead of correcting it
          // in an effect.
          key={previewing.id}
          url={previewing.file}
          filename={previewing.fileName}
          studentName={previewing.name}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}