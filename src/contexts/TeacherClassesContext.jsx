// The teacher's classes (subjects they teach), fetched once and shared.
//
// GET /courses/teacher/my-classes/ had five independent callers — ClassesList,
// ClassPickerLanding, LiveSessions, BatchProgressDetail and
// ScheduleSessionModal — each normalising the payload its own way, and each
// firing its own request. The flattened CONTENT screens need the same list to
// build their subject-pill filters, so rather than add more copies this is the
// single source: one request, one normalisation.
//
// The payload's field names vary by endpoint version (subject_id vs id,
// course_title vs class_name, board vs board_name vs board.name), which is why
// normalisation lives here rather than in each screen.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/apiClient";

const TeacherClassesContext = createContext({
  classes: [],
  loading: true,
  error: null,
  reload: () => {},
});

const pickFirstText = (...values) =>
  values.find((v) => typeof v === "string" && v.trim().length > 0) || "";

export function normalizeClass(s) {
  return {
    subjectId: s.subject_id || s.id,
    subjectName: pickFirstText(s.subject_name, s.name),
    courseId: s.course_id || s.course?.id || null,
    courseTitle: pickFirstText(s.course_title, s.class_name, s.course),
    board: pickFirstText(s.board, s.board_name, s.board_title, s.board?.name),
    stream: pickFirstText(s.stream, s.stream_name, s.stream_title, s.stream?.name),
  };
}

export function TeacherClassesProvider({ children }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/courses/teacher/my-classes/");
      setClasses((res.data || []).map(normalizeClass));
    } catch (err) {
      console.error("Failed to load classes", err);
      setError("Failed to load your classes.");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <TeacherClassesContext.Provider value={{ classes, loading, error, reload: load }}>
      {children}
    </TeacherClassesContext.Provider>
  );
}

export function useTeacherClasses() {
  return useContext(TeacherClassesContext);
}
