import { useNavigate, useParams, useLocation } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FiMail, FiPhone, FiUser, FiCalendar, FiHash } from "react-icons/fi";
import "../styles/student-detail.css";

// The row shape here comes from StudentsList.jsx via router state — it describes
// ONE STUDENT (a learner profile), while `email`/`username` belong to the
// ACCOUNT and are shared with any enrolled siblings. See StudentsList.jsx.
const displayNameOf = (s) =>
  s.full_name || s.display_name || s.username || "Unnamed student";

export default function StudentDetail() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const location = useLocation();

  const student = location.state?.student;
  const subjectName = location.state?.subjectName || "";

  const backPath = `/teacher/classes/${subjectId}/students`;

  if (!student) {
    return (
      <div className="sd-page">
        <button className="sd-back-btn" onClick={() => navigate(backPath)}>
          <IoChevronBack /> Back
        </button>
        <div className="sd-empty">Student data not available. Go back and try again.</div>
      </div>
    );
  }

  return (
    <div className="sd-page">
      <button className="sd-back-btn" onClick={() => navigate(backPath)}>
        <IoChevronBack /> Back to Students
      </button>

      <div className="sd-card">
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
            {subjectName && <p className="sd-subject-badge">{subjectName}</p>}
          </div>
        </div>

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
