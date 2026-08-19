import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import SubjectCard from "../components/SubjectCard";
import api from "../api/apiClient";
import "../styles/classes.css";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";

export default function Classes() {
  const { subjectId } = useParams(); // ✅ correct param name

  const [hoveredTitle, setHoveredTitle] = useState("Assignments");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    if (!subjectId) return;
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(
        `/courses/subjects/${subjectId}/dashboard/`
      );

      setDashboard(res.data);
    } catch (err) {
      console.error("Failed to load dashboard", err);
      setError("Failed to load class data.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  if (loading) return <LoadingState label="Loading class" />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;
  if (!dashboard) return <EmptyState icon="book" title="No data found" message="This class doesn't have any data to show yet." />;

  const base = `/teacher/classes/${subjectId}`;

  return (
    <div className="classes-wrapper">
      <div className="classes-container">

        <div className="classes-top">
          {/* Course-qualified: "Mathematics — Live Sessions" alone never said
              which class's Mathematics you were looking at. */}
          <h2>
            {[dashboard.name, dashboard.course_title].filter(Boolean).join(" · ")} — {hoveredTitle}
          </h2>
        </div>

        <div className="classes-grid">

          <SubjectCard
            title="Assignments"
            count={dashboard.assignments?.total || 0}
            label="Tasks"
            path={`${base}/assignments`}
            onHover={() => setHoveredTitle("Assignments")}
          />

          <SubjectCard
            title="Quiz"
            count={dashboard.quizzes?.total || 0}
            label="Tests"
            path={`${base}/quizzes`}
            onHover={() => setHoveredTitle("Quiz")}
          />

          <SubjectCard
            title="Study Materials"
            count={dashboard.studyMaterialsCount || 0}
            label="Resources"
            path={`${base}/study-materials`}
            onHover={() => setHoveredTitle("Study Materials")}
          />

          <SubjectCard
            title="Session Recordings"
            count={dashboard.recordingsCount || 0}
            label="Recordings"
            path={`${base}/session-recordings`}
            onHover={() => setHoveredTitle("Session Recordings")}
          />

          <SubjectCard
            title="Live Sessions"
            count={dashboard.upcomingSessions?.length || 0}
            label="Upcoming"
            path={`${base}/live-sessions`}
            onHover={() => setHoveredTitle("Live Sessions")}
          />

          <SubjectCard
            title="Students"
            count={dashboard.studentsCount || 0}
            label="Enrolled"
            path={`${base}/students`}
            onHover={() => setHoveredTitle("Students")}
          />

        </div>
      </div>
    </div>
  );
}