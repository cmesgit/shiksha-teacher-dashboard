// src/pages/StudyMaterials.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Study Materials" (teacher) — ONE flat, subject-filtered list of
// every material across the classes this teacher owns. Matches the design
// handoff's Study Materials screen (Academy Dashboard.dc.html lines
// 1155–1213), teacher branches: a "+ Upload material" head button, and a
// per-row "Manage ▾" dropdown (Download file / Delete file) beside View.
//
// There is no class-picker step any more. The screen used to be scoped to a
// route :subjectId and was only reachable through StudyMaterialsLanding; it
// now renders every subject at once and filters with the design's pill row.
// :subjectId is still read, optionally, so older deep links land here with
// that subject's pill preselected instead of 404-ing.
//
// Data:
//   · subjects  — TeacherClassesContext (ONE shared GET /courses/teacher/
//                 my-classes/, made by the provider, not by this screen).
//   · materials — GET /materials/subjects/:subjectId/materials/, fanned out
//                 with Promise.all: exactly one request per DISTINCT subject
//                 the teacher teaches, flattened client-side. A subject that
//                 fails degrades to an empty list rather than taking the
//                 whole screen down; only an all-subjects failure is an error.
//   · delete    — DELETE /materials/materials/:id/delete/ (unchanged, still
//                 behind a confirm — now the shared ConfirmDialog).
//
// There is no course-wide teacher endpoint to collapse the fan-out into (the
// student app has one: /materials/student/courses/:courseId/materials/). If
// one ever lands, this is the place to swap it in.
// ──────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/apiClient";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";
import "../styles/academyScreens.css";
import "../styles/study-materials.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getFileExt(name = "") {
  const ext = name.split(".").pop();
  if (!ext) return "FILE";
  const upper = ext.toUpperCase();
  return upper.length <= 5 ? upper : "FILE";
}

function triggerDownload(file) {
  if (!file?.file_url) return false;
  const a = document.createElement("a");
  a.href = file.file_url;
  a.download = file.file_name || "";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

// Head-button menu id — shares the one "which menu is open" slot with the
// row menus so opening either closes the other.
const UPLOAD_MENU = "upload-menu";

export default function StudyMaterials() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { classes, loading: classesLoading, error: classesError, reload } =
    useTeacherClasses();

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // "" = All subjects. Seeded from the route so a deep link preselects.
  const [subjectFilter, setSubjectFilter] = useState(subjectId ? String(subjectId) : "");
  const [sortOrder, setSortOrder] = useState("newest");
  const [openMenu, setOpenMenu] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // One entry per subject actually taught. The payload can repeat a subject
  // across courses/boards; a repeat would be a duplicate request AND duplicate
  // rows, so collapse on subjectId first.
  const subjects = useMemo(() => {
    const seen = new Map();
    for (const c of classes || []) {
      if (!c?.subjectId) continue;
      const key = String(c.subjectId);
      if (!seen.has(key)) seen.set(key, c);
    }
    return [...seen.values()];
  }, [classes]);

  useEffect(() => {
    setSubjectFilter(subjectId ? String(subjectId) : "");
  }, [subjectId]);

  useEffect(() => {
    if (classesLoading) return;
    if (subjects.length === 0) {
      setMaterials([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const toRow = (item, cls) => {
      const created = new Date(item.created_at);
      return {
        id: item.id,
        subjectId: String(cls.subjectId),
        subjectName: cls.subjectName || item.subject_name || "Subject",
        // The design's sub-line is "subject · batch", but the materials
        // serializer exposes no batch (StudyMaterial.batch exists on the model
        // and is simply not serialised). Chapter is the nearest thing it does
        // return and is what a teacher scans for, so it stands in until/unless
        // the API grows a batch field — at which point this picks it up.
        scope: item.batch_name || item.chapter_title || "No chapter",
        title: item.title,
        date: created.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        dateRaw: created.getTime(),
        files: item.files || [],
        isNew: Date.now() - created.getTime() < WEEK_MS,
      };
    };

    // ONE request for every subject the teacher is assigned to. The
    // per-subject fan-out below is kept only as a fallback for backends that
    // predate /materials/teacher/materials/all/ — 404 only, so a real failure
    // still surfaces rather than being retried through a different door.
    async function fetchAll() {
      setLoading(true);
      setError(false);
      const byId = new Map(subjects.map((c) => [String(c.subjectId), c]));
      try {
        const res = await api.get("/materials/teacher/materials/all/");
        if (cancelled) return;
        setMaterials(
          (res.data || []).map((item) =>
            // The batched endpoint names its own subject; fall back to the
            // context entry for the teacher-facing label.
            toRow(item, byId.get(String(item.subject_id)) || {
              subjectId: item.subject_id,
              subjectName: item.subject_name,
            })
          )
        );
        setLoading(false);
        return;
      } catch (err) {
        if (err?.response?.status !== 404) {
          if (cancelled) return;
          console.error("Failed to load materials", err);
          setError(true);
          setMaterials([]);
          setLoading(false);
          return;
        }
      }

      // Legacy: one GET per distinct subject, in parallel.
      const settled = await Promise.all(
        subjects.map((cls) =>
          api
            .get(`/materials/subjects/${cls.subjectId}/materials/`)
            .then((res) => ({
              ok: true,
              rows: (res.data || []).map((item) => toRow(item, cls)),
            }))
            .catch((err) => {
              console.error(
                `Failed to load materials for subject ${cls.subjectId}:`,
                err
              );
              return { ok: false, rows: [] };
            })
        )
      );
      if (cancelled) return;
      // A single flaky subject just contributes nothing; everything failing
      // means the screen has nothing truthful to show.
      if (settled.every((r) => !r.ok)) {
        setError(true);
        setMaterials([]);
      } else {
        setMaterials(settled.flatMap((r) => r.rows));
      }
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [subjects, classesLoading]);

  // Dropdowns close on outside click and on Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e) => {
      if (!e.target.closest?.(".ac-menuWrap")) setOpenMenu(null);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // Only offer a pill for subjects that actually have material.
  const subjectsWithMaterial = useMemo(() => {
    const ids = new Set(materials.map((m) => m.subjectId));
    return subjects.filter((s) => ids.has(String(s.subjectId)));
  }, [subjects, materials]);

  const rows = useMemo(
    () =>
      materials
        .filter((m) => !subjectFilter || m.subjectId === subjectFilter)
        .sort((a, b) =>
          sortOrder === "oldest" ? a.dateRaw - b.dateRaw : b.dateRaw - a.dateRaw
        ),
    [materials, subjectFilter, sortOrder]
  );

  const goUpload = useCallback(
    (sid) => {
      setOpenMenu(null);
      navigate(`/teacher/classes/${sid}/study-materials/upload`);
    },
    [navigate]
  );

  // Upload is per-subject (UploadMaterial reads :subjectId for its chapter
  // list and its POST). With a pill selected — or only one class to begin
  // with — the target is unambiguous; otherwise the head button opens the
  // same dropdown shape the rows use, to pick a class first.
  const uploadSubjectId =
    subjectFilter || (subjects.length === 1 ? String(subjects[0].subjectId) : null);

  const handleView = (item) => {
    setOpenMenu(null);
    navigate(`/teacher/classes/${item.subjectId}/study-materials/${item.id}`);
  };

  const handleDownload = (item) => {
    setOpenMenu(null);
    // A material can carry several files; only a single one can be handed
    // straight to the browser. Anything else goes to the detail page to pick.
    if (item.files.length === 1 && triggerDownload(item.files[0])) return;
    navigate(`/teacher/classes/${item.subjectId}/study-materials/${item.id}`);
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/materials/materials/${confirmTarget.id}/delete/`);
      setMaterials((prev) => prev.filter((m) => m.id !== confirmTarget.id));
      setConfirmTarget(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  };

  if (classesLoading || loading) {
    return (
      <div className="ac-screen">
        <LoadingState label="Loading study materials" />
      </div>
    );
  }

  if (classesError) {
    return (
      <div className="ac-screen">
        <ErrorState message={classesError} onRetry={reload} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ac-screen">
        <ErrorState message="Couldn't load your study materials. Please try again in a moment." />
      </div>
    );
  }

  const subCopy = subjects.length === 0
    ? "Notes, worksheets and handouts you share with your classes."
    : `${materials.length} ${materials.length === 1 ? "material" : "materials"} across ${subjects.length} ${subjects.length === 1 ? "class" : "classes"}.`;

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Study Materials</h1>
          <p className="ac-head__sub">{subCopy}</p>
        </div>

        {subjects.length > 0 && (
          <div className="ac-head__actions">
            <div className="ac-menuWrap">
              <button
                type="button"
                className="ac-headBtn"
                aria-haspopup={uploadSubjectId ? undefined : "menu"}
                aria-expanded={uploadSubjectId ? undefined : openMenu === UPLOAD_MENU}
                onClick={() =>
                  uploadSubjectId
                    ? goUpload(uploadSubjectId)
                    : setOpenMenu((cur) => (cur === UPLOAD_MENU ? null : UPLOAD_MENU))
                }
              >
                + Upload material
              </button>

              {openMenu === UPLOAD_MENU && (
                <div className="ac-menu stm-menu--subjects" role="menu">
                  <p className="stm-menu__label">Upload to…</p>
                  {subjects.map((s) => (
                    <button
                      key={s.subjectId}
                      type="button"
                      role="menuitem"
                      className="ac-menu__item"
                      onClick={() => goUpload(s.subjectId)}
                    >
                      {s.subjectName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon="book"
          title="No classes assigned"
          message="Once a class is assigned to you, the material you upload for it shows up here."
        />
      ) : materials.length === 0 ? (
        <EmptyState
          icon="file"
          title="No study materials yet"
          message="Notes, PDFs and worksheets you upload for your classes will appear here."
        />
      ) : (
        <>
          <div className="ac-filterBar">
            <div className="ac-pills">
              <button
                type="button"
                className={`ac-pill${subjectFilter === "" ? " is-active" : ""}`}
                onClick={() => setSubjectFilter("")}
              >
                All
              </button>
              {subjectsWithMaterial.map((s) => (
                <button
                  key={s.subjectId}
                  type="button"
                  className={`ac-pill${subjectFilter === String(s.subjectId) ? " is-active" : ""}`}
                  onClick={() => setSubjectFilter(String(s.subjectId))}
                >
                  {s.subjectName}
                </button>
              ))}
            </div>
            <select
              className="ac-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              aria-label="Sort study materials"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {rows.length === 0 ? (
            <section className="ac-listCard">
              <div className="ac-emptyRow">No material for this subject</div>
            </section>
          ) : (
            <section className="ac-listCard ac-listCard--flush">
              {rows.map((item) => {
                const singleFile = item.files.length === 1 ? item.files[0] : null;
                const multiCount = item.files.length > 1 ? item.files.length : 0;
                const ext = singleFile
                  ? getFileExt(singleFile.file_name)
                  : multiCount ? "DOCS" : "FILE";
                const isPdf = ext === "PDF";
                const sizeLabel = singleFile
                  ? singleFile.file_size || "—"
                  : multiCount ? `${multiCount} files` : "—";

                return (
                  <div key={item.id} className="ac-row ac-row--flush">
                    <div className={`ac-fileBadge${isPdf ? " ac-fileBadge--pdf" : ""}`}>
                      {ext}
                    </div>

                    <div className="ac-row__body">
                      <div className="ac-row__topic stm-topic">
                        {item.title}
                        {item.isNew && <span className="stm-newTag">NEW</span>}
                      </div>
                      <div className="ac-row__sub">
                        {item.subjectName} · {item.scope}
                      </div>
                    </div>

                    <span className="ac-row__col">{sizeLabel}</span>
                    <span className="ac-row__col">{item.date}</span>

                    <button
                      type="button"
                      className="ac-btn"
                      onClick={() => handleView(item)}
                    >
                      View
                    </button>

                    <div className="ac-menuWrap">
                      <button
                        type="button"
                        className="ac-btn ac-btn--withIcon"
                        aria-haspopup="menu"
                        aria-expanded={openMenu === item.id}
                        onClick={() =>
                          setOpenMenu((cur) => (cur === item.id ? null : item.id))
                        }
                      >
                        Manage
                        <svg
                          className="ac-btn__icon"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {openMenu === item.id && (
                        <div className="ac-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="ac-menu__item"
                            onClick={() => handleDownload(item)}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download file
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="ac-menu__item ac-menu__item--danger"
                            onClick={() => {
                              setOpenMenu(null);
                              setConfirmTarget(item);
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete file
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        dialog={
          confirmTarget && {
            title: "Delete this material?",
            message: `“${confirmTarget.title}” and its attached files will be removed for every student in ${confirmTarget.subjectName}. This can't be undone.`,
            confirmLabel: "Delete",
            cancelLabel: "Cancel",
            danger: true,
            busy: deleting,
            onConfirm: handleDelete,
          }
        }
        onClose={() => { if (!deleting) setConfirmTarget(null); }}
      />
    </div>
  );
}
