import React from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import TeacherRoutes from "./routes/TeacherRoutes";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import DocumentTitle from "./components/DocumentTitle";
import { TourProvider } from "./tour/TourProvider";
import { tourRegistry } from "./tour/tourRegistry";

// Teacher app has no CourseContext-equivalent (track is implicit from which
// layout is mounted — TeacherLayout sets data-track="academy", SkillDevLayout
// "skill", CounselorLayout "counsellor" — see academyNav/SkillDevLayout).
// Derive the same value from the route so the body-portalled tour overlay
// mirrors it (C8) without needing a new shared context.
function trackFromPathname(pathname) {
  if (pathname.startsWith("/teacher/expert")) return "skill";
  if (pathname.startsWith("/teacher/counsellor")) return "counsellor";
  return "academy";
}

function TourMount({ children }) {
  const location = useLocation();
  return (
    <TourProvider registry={tourRegistry} track={trackFromPathname(location.pathname)}>
      {children}
    </TourProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <DocumentTitle />
          <Toaster position="top-right" />
          <TourMount>
            <TeacherRoutes />
          </TourMount>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
