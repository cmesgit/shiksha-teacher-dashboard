import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FaRegFolder } from "react-icons/fa";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import "../styles/assignment-view.css";
import { LoadingState } from "../components/StateViews";

export default function AssignmentView() {
  const navigate = useNavigate();
  const { assignmentId, subjectId } = useParams();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  useEffect(() => {
    async function fetchAssignment() {
      try {
        const res = await api.get(`/assignments/${assignmentId}/`);
        setAssignment(res.data);
      } catch (err) {
        console.error("Failed to load assignment", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAssignment();
  }, [assignmentId]);

  if (loading) return <LoadingState label="Loading assignment" />;
  if (!assignment) return <div>Assignment not found</div>;

  return (
    <div className="assignment-view-page">
      
      <button
        className="av-back-btn"
        onClick={() => navigate(-1)}
      >
        <IoChevronBack /> Back
      </button>

      <div className="av-header">
        <h2 className="av-title">{assignment.title}</h2>
      </div>

      <div className="av-content-card">

        <div className="av-edit-row">
          <button
            className="av-edit-btn"
            onClick={() =>
              navigate(
                `/teacher/classes/${subjectId}/assignments/create`,
                { state: assignment }
              )
            }
          >
            Edit
          </button>
        </div>

        <div className="av-details">

          <p className="av-detail-line">
            <span className="av-label">Title: </span>
            <span className="av-value-bold">{assignment.title}</span>
          </p>

          <p className="av-detail-line">
            <span className="av-label">Due Date: </span>
            <span className="av-value-bold">
              {formatDate(assignment.due_date)}
            </span>
          </p>

          <div className="av-description">
            <span className="av-label">Description: </span>
            <span className="av-desc-text">{assignment.description}</span>
          </div>

          {assignment.attachment && (
            <div className="av-file-card">
              <div className="av-file-icon-box">
                <FaRegFolder className="av-file-icon" />
              </div>

              <a
                href={assignment.attachment}
                target="_blank"
                rel="noopener noreferrer"
                className="av-file-name"
              >
                Download File
              </a>
            </div>
          )}

          {assignment.files?.map((f) => (
            <div className="av-file-card" key={f.id}>
              <div className="av-file-icon-box">
                <FaRegFolder className="av-file-icon" />
              </div>

              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="av-file-name"
              >
                {f.original_filename}
              </a>
            </div>
          ))}

          <div className="av-actions">
            <button
              className="av-view-submission-btn"
              onClick={() =>
                navigate(
                  `/teacher/classes/${subjectId}/assignments/${assignmentId}/submissions`
                )
              }
            >
              View Submissions
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}