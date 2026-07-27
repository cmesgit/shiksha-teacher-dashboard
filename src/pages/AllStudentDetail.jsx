/**
 * AllStudentDetail.jsx
 *
 * This is the detail view when clicking a student from the "All Students" page.
 * It receives student data via React Router's location.state — no extra API call.
 *
 * WHY location.state?
 * - We already have the student data from the list page
 * - Passing it via state avoids an extra API request
 * - If state is missing (e.g., direct URL access), we show a fallback
 */

import { useNavigate, useLocation } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FiMail, FiPhone, FiUser, FiCalendar, FiHash, FiBook } from "react-icons/fi";
import "../styles/student-detail.css";

// The row shape here comes from AllStudents.jsx via router state — it describes
// ONE STUDENT (a learner profile), while `email`/`username` belong to the
// ACCOUNT and are shared with any enrolled siblings. See AllStudents.jsx.
const displayNameOf = (s) =>
  s.full_name || s.display_name || s.username || "Unnamed student";

export default function AllStudentDetail() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get student from router state
  const student = location.state?.student;

  if (!student) {
    return (
      <div className="sd-page">
        <button className="sd-back-btn" onClick={() => navigate("/teacher/students")}>
          <IoChevronBack /> Back
        </button>
        <div className="sd-empty">Student data not available. Go back and try again.</div>
      </div>
    );
  }

  return (
    <div className="sd-page">
      <button className="sd-back-btn" onClick={() => navigate("/teacher/students")}>
        <IoChevronBack /> Back to All Students
      </button>

      <div className="sd-card">
        {/* Profile header with avatar and name */}
        <div className="sd-profile-section">
          <div className="sd-avatar-large">
            {student.avatar_type === "image" && student.avatar ? (
              <img src={student.avatar} alt="" />
            ) : student.avatar_type === "emoji" && student.avatar ? (
              <span>{student.avatar}</span>
            ) : (
              <span>{displayNameOf(student)[0].toUpperCase()}</span>
            )}
          </div>

          <div className="sd-profile-info">
            <h2>{displayNameOf(student)}</h2>
            {student.course_title && (
              <p className="sd-subject-badge">
                {(student.course_titles || [student.course_title]).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* Detail grid — 2 columns on desktop, 1 on mobile */}
        <div className="sd-details-grid">
          <div className="sd-detail-item">
            <FiMail className="sd-detail-icon" />
            <div>
              {/* Account-level: shared with this student's enrolled siblings,
                  so labelled as the account's rather than the student's. */}
              <span className="sd-detail-label">Account email</span>
              <span className="sd-detail-value">{student.email}</span>
            </div>
          </div>

          <div className="sd-detail-item">
            <FiPhone className="sd-detail-icon" />
            <div>
              <span className="sd-detail-label">Phone</span>
              <span className="sd-detail-value">{student.phone || "Not provided"}</span>
            </div>
          </div>

          <div className="sd-detail-item">
            <FiHash className="sd-detail-icon" />
            <div>
              <span className="sd-detail-label">Student ID</span>
              <span className="sd-detail-value">{student.student_id || "Not assigned"}</span>
            </div>
          </div>

          <div className="sd-detail-item">
            <FiUser className="sd-detail-icon" />
            <div>
              <span className="sd-detail-label">Account username</span>
              <span className="sd-detail-value">{student.username}</span>
            </div>
          </div>

          <div className="sd-detail-item">
            <FiBook className="sd-detail-icon" />
            <div>
              <span className="sd-detail-label">
                {(student.course_titles || []).length > 1 ? "Courses" : "Course"}
              </span>
              <span className="sd-detail-value">
                {(student.course_titles || [student.course_title]).join(", ")}
              </span>
            </div>
          </div>

          <div className="sd-detail-item">
            <FiCalendar className="sd-detail-icon" />
            <div>
              <span className="sd-detail-label">Enrolled On</span>
              <span className="sd-detail-value">
                {new Date(student.enrolled_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {student.batch_code && (
            <div className="sd-detail-item">
              <FiHash className="sd-detail-icon" />
              <div>
                <span className="sd-detail-label">Batch Code</span>
                <span className="sd-detail-value">{student.batch_code}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
