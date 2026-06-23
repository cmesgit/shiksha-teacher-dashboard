/**
 * src/components/Sidebar.jsx  ·  ACADEMY / FACULTY sidebar
 * Skill Dev has its OWN nav in SkillDevLayout, so this sidebar only ever
 * renders the academy nav. A pure GUEST never reaches this (they route to
 * /teacher/expert under SkillDevLayout). Kept guest-safe just in case.
 */
import { useEffect, useState } from "react";
import { FiUsers, FiHome, FiChevronDown } from "react-icons/fi";
import { MdDashboard } from "react-icons/md";
import { FaChalkboardTeacher } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { RiLockLine, RiLiveLine, RiGroupLine } from "react-icons/ri";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/apiClient";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/Shiksha.svg";
import "../styles/sidebar.css";
import { HOME_URL } from "../config/urls";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { teacherInfo } = useAuth();
  const [classes, setClasses] = useState([]);
  const [classesOpen, setClassesOpen] = useState(
    location.pathname.startsWith("/teacher/classes")
  );

  const isActive = (path) =>
    path === "/teacher/dashboard"
      ? location.pathname === path
      : location.pathname.startsWith(path);

  useEffect(() => {
    const pickFirstText = (...values) => {
      const found = values.find((v) => typeof v === "string" && v.trim().length > 0);
      return found || "";
    };
    async function fetchClasses() {
      try {
        const res = await api.get("/courses/teacher/my-classes/");
        const normalized = res.data.map((cls) => ({
          subject_id:   cls.subject_id || cls.id,
          subject_name: pickFirstText(cls.subject_name, cls.name),
          course_title: pickFirstText(cls.course_title, cls.class_name, cls.course),
          board:  pickFirstText(cls.board, cls.board_name, cls.board_title, cls.board?.name),
          stream: pickFirstText(cls.stream, cls.stream_name, cls.stream_title, cls.stream?.name),
        }));
        setClasses(normalized);
      } catch (err) {
        console.error("Failed to load teacher classes", err);
      }
    }
    fetchClasses();
  }, []);

  const getClassMeta = (cls) => {
    const meta = [cls.course_title, cls.board, cls.stream].filter(Boolean).join(" • ");
    return meta ? ` (${meta})` : "";
  };

  return (
    <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <img src={logo} alt="ShikshaCom" />
          <div>
            <h3>ShikshaCom</h3>
            <p>Faculty Portal</p>
          </div>
        </div>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
          <IoClose />
        </button>
      </div>

      <nav>
        <div className={`menu-item ${isActive("/teacher/dashboard") ? "active" : ""}`}
          onClick={() => { navigate("/teacher/dashboard"); setSidebarOpen(false); }}>
          <MdDashboard /><span>Dashboard</span>
        </div>

        <div className={`menu-item ${isActive("/teacher/students") ? "active" : ""}`}
          onClick={() => { navigate("/teacher/students"); setSidebarOpen(false); }}>
          <FiUsers /><span>Student List</span>
        </div>

        <div className={`menu-item menu-dropdown ${isActive("/teacher/classes") ? "active" : ""}`}
          onClick={() => setClassesOpen((o) => !o)}>
          <FaChalkboardTeacher />
          <span>Classes</span>
          <FiChevronDown className={`menu-chevron ${classesOpen ? "menu-chevron--open" : ""}`} />
        </div>

        {classesOpen && (
          <div className="submenu">
            {classes.length === 0 && <p className="submenu-empty">No classes</p>}
            {classes.map((cls) => (
              <p key={cls.subject_id}
                className={location.pathname === `/teacher/classes/${cls.subject_id}` ? "submenu-active" : ""}
                onClick={() => { navigate(`/teacher/classes/${cls.subject_id}`); setSidebarOpen(false); }}>
                {cls.subject_name}{getClassMeta(cls)}
              </p>
            ))}
          </div>
        )}

        <div className={`menu-item ${isActive("/teacher/live-sessions") ? "active" : ""}`}
          onClick={() => { navigate("/teacher/live-sessions"); setSidebarOpen(false); }}>
          <RiLiveLine /><span>Live Sessions</span>
        </div>

        <div className={`menu-item ${isActive("/teacher/private-sessions") ? "active" : ""}`}
          onClick={() => { navigate("/teacher/private-sessions"); setSidebarOpen(false); }}>
          <RiLockLine /><span>Private Sessions</span>
        </div>

        <div className={`menu-item ${isActive("/teacher/group-sessions") ? "active" : ""}`}
          onClick={() => { navigate("/teacher/group-sessions"); setSidebarOpen(false); }}>
          <RiGroupLine /><span>Group Sessions</span>
        </div>
      </nav>

      <div className="sidebar__bottom">
        <a href={HOME_URL} className="sidebar__homeBtn">
          <FiHome /> Return to Homepage
        </a>
      </div>
    </aside>
  );
}
