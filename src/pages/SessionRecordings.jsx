// src/pages/SessionRecordings.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Recordings" (teacher) — ONE flat, subject-filtered grid of every
// recording across every class the teacher takes. Matches the design handoff's
// Recordings screen (Academy Dashboard.dc.html lines 1096–1154), teacher
// branch: an "+ Upload recording" head button, subject pills above a 3-up card
// grid, and a red delete button sitting to the LEFT of each card's primary
// action. A recording that is still processing shows "Pending" and no delete.
//
// There is no class-picker step any more. The screen is reached straight from
// the nav with no :subjectId; the param is still read so the old deep link
// /teacher/classes/:subjectId/session-recordings simply preselects that
// subject's pill.
//
// Data: the subject list comes from TeacherClassesContext (one shared
// GET /courses/teacher/my-classes/, already made by the provider — this screen
// must not repeat it). Recordings then come from ONE
// GET /courses/teacher/recordings/all/ covering every subject the teacher is
// assigned to. The old per-DISTINCT-subject fan-out survives as a 404-only
// fallback for backends that predate it — see api/batchedList.js.
//
// Bunny processes an upload asynchronously, so every recording that has not
// reached STATUS_READY is re-polled on GET /courses/recordings/:id/status/ —
// unchanged, except the poll now spans subjects and MERGES the response into
// the existing row so the subjectId/subjectName tags survive the update.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";
import api from "../api/apiClient";
import { fetchBatchedOrFanOut, fanOutPerSubject } from "../api/batchedList";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";
import { subjectChipSlot } from "../utils/subjectChips";
import "../styles/academyScreens.css";
import "../styles/session-recordings.css";

// Bunny's pipeline states, as the backend stores them.
const STATUS_LABELS = {
  0: "Created",
  1: "Uploaded",
  2: "Processing",
  3: "Transcoding",
  4: "Ready",
  5: "Error",
};

const STATUS_READY = 4;
const STATUS_ERROR = 5;

// The design's card footer carries a progress bar. A teacher has no "watched"
// figure of their own, so the bar tracks the thing they actually wait on: how
// far through Bunny's pipeline the upload is.
const STATUS_PROGRESS = { 0: 8, 1: 30, 2: 55, 3: 80, 4: 100, 5: 100 };

const POLL_MS = 10000;

const fmtDate = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

function fmtDuration(secs) {
  if (!secs) return null;
  const mins = Math.round(secs / 60);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export default function SessionRecordings() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { classes, loading: classesLoading, error: classesError } = useTeacherClasses();

  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // "" = all subjects. Seeded from the route so a deep link preselects.
  const [subjectFilter, setSubjectFilter] = useState(subjectId ? String(subjectId) : "");

  const [deletingId, setDeletingId] = useState(null); // which card is mid-delete
  const [confirmDlg, setConfirmDlg] = useState(null);  // ConfirmDialog state
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const uploadMenuRef = useRef(null);

  useEffect(() => {
    setSubjectFilter(subjectId ? String(subjectId) : "");
  }, [subjectId]);

  // One entry per DISTINCT subject — my-classes can list the same subject under
  // more than one course/board row, and that must not fan out twice.
  const subjects = useMemo(() => {
    const seen = new Map();
    (classes || []).forEach((c) => {
      if (c.subjectId && !seen.has(String(c.subjectId))) seen.set(String(c.subjectId), c);
    });
    return [...seen.values()];
  }, [classes]);

  // ── Fetch: one request per subject, in parallel, flattened ──────────────
  useEffect(() => {
    if (classesLoading) return undefined;
    if (subjects.length === 0) {
      setRecordings([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        // ONE request for every subject the teacher is assigned to; the
        // per-subject fan-out is a 404-only fallback (see api/batchedList.js).
        const byId = new Map(subjects.map((c) => [String(c.subjectId), c]));
        const perSubject = await fetchBatchedOrFanOut(
          "/courses/teacher/recordings/all/",
          (r) => {
            const c = byId.get(String(r.subject)) || {};
            return {
              ...r,
              subjectId: r.subject,
              subjectName: r.subject_name || c.subjectName,
              courseTitle: c.courseTitle,
            };
          },
          () =>
            fanOutPerSubject(
              subjects,
              (c) => `/courses/subjects/${c.subjectId}/recordings/`,
              (r, c) => ({
                ...r,
                subjectId: c.subjectId,
                subjectName: c.subjectName,
                courseTitle: c.courseTitle,
              })
            )
        );
        if (cancelled) return;
        const flat = perSubject.flat();
        flat.sort(
          (a, b) => new Date(b.session_date || 0) - new Date(a.session_date || 0)
        );
        setRecordings(flat);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load recordings", err);
        setError("Failed to load recordings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [subjects, classesLoading]);

  // ── Poll the unfinished ones ────────────────────────────────────────────
  // The key is the set of still-processing ids, so the interval is rebuilt only
  // when that set actually changes (not on every unrelated re-render) and torn
  // down the moment the last one goes Ready — or the screen unmounts.
  const pendingKey = useMemo(
    () =>
      recordings
        .filter((r) => r.status < STATUS_READY)
        .map((r) => r.id)
        .sort()
        .join(","),
    [recordings]
  );

  useEffect(() => {
    if (!pendingKey) return undefined;
    const ids = pendingKey.split(",");
    let cancelled = false;

    const tick = async () => {
      const updates = await Promise.all(
        ids.map((id) =>
          api
            .get(`/courses/recordings/${id}/status/`)
            .then((res) => res.data)
            .catch(() => null)
        )
      );
      if (cancelled) return;
      const byId = new Map(updates.filter(Boolean).map((u) => [String(u.id), u]));
      setRecordings((prev) =>
        prev.map((rec) => {
          const update = byId.get(String(rec.id));
          // MERGE, don't replace: the status payload is the bare serializer and
          // knows nothing about the subjectId/subjectName/courseTitle tags this
          // screen attached when it flattened the subjects together.
          return update ? { ...rec, ...update } : rec;
        })
      );
    };

    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingKey]);

  // Close the "+ Upload recording" subject menu on an outside click / Escape.
  useEffect(() => {
    if (!uploadMenuOpen) return undefined;
    const onDown = (e) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target)) {
        setUploadMenuOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setUploadMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [uploadMenuOpen]);

  // Only offer a pill for subjects that actually have a recording.
  const subjectsWithRecordings = useMemo(() => {
    const ids = new Set(recordings.map((r) => String(r.subjectId)));
    return subjects.filter((c) => ids.has(String(c.subjectId)));
  }, [subjects, recordings]);

  const cards = useMemo(
    () =>
      recordings.filter((r) => !subjectFilter || String(r.subjectId) === subjectFilter),
    [recordings, subjectFilter]
  );

  // ── Upload / play / delete ──────────────────────────────────────────────
  const uploadFor = (sid) =>
    navigate(`/teacher/classes/${sid}/session-recordings/upload`);

  // Uploading needs a subject. If a pill is active (or there's only one class)
  // that's unambiguous; otherwise the button opens a subject menu.
  const uploadSubjectId =
    subjectFilter || (subjects.length === 1 ? subjects[0].subjectId : null);

  const handleUploadClick = () => {
    if (uploadSubjectId) uploadFor(uploadSubjectId);
    else setUploadMenuOpen((o) => !o);
  };

  const openPlayer = (rec) => {
    if (rec.status !== STATUS_READY) return;
    navigate(
      `/teacher/classes/${rec.subjectId}/session-recordings/${rec.id}/${rec.bunny_video_id}`
    );
  };

  const handleDeleteConfirm = async (recordingId) => {
    setDeletingId(recordingId);
    try {
      await api.delete(`/courses/recordings/${recordingId}/delete/`);
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
      toast.success("Recording deleted.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed.");
    } finally {
      setDeletingId(null);
      setConfirmDlg(null);
    }
  };

  const askDelete = (rec) =>
    setConfirmDlg({
      title: "Delete recording?",
      message: `“${rec.title}” will be removed for every student. This can't be undone.`,
      confirmLabel: "Delete recording",
      danger: true,
      onConfirm: () => handleDeleteConfirm(rec.id),
    });

  // ── States ──────────────────────────────────────────────────────────────
  if (classesLoading || loading) {
    return <div className="ac-screen"><LoadingState label="Loading recordings" /></div>;
  }
  if (classesError || error) {
    return <div className="ac-screen"><ErrorState message={classesError || error} /></div>;
  }
  if (subjects.length === 0) {
    return (
      <div className="ac-screen">
        <EmptyState
          icon="video"
          title="No classes yet"
          message="You aren't assigned to any classes, so there's nothing to record."
        />
      </div>
    );
  }

  const activeSubjectName = subjectFilter
    ? subjects.find((c) => String(c.subjectId) === subjectFilter)?.subjectName
    : null;
  const sub = activeSubjectName
    ? `${cards.length} recording${cards.length === 1 ? "" : "s"} in ${activeSubjectName}.`
    : `${recordings.length} recording${recordings.length === 1 ? "" : "s"} across ${subjects.length} class${subjects.length === 1 ? "" : "es"}.`;

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Recordings</h1>
          <p className="ac-head__sub">{sub}</p>
        </div>

        <div className="ac-head__actions">
          <div className="ac-menuWrap" ref={uploadMenuRef}>
            <button
              type="button"
              className="ac-headBtn"
              onClick={handleUploadClick}
              aria-haspopup={uploadSubjectId ? undefined : "menu"}
              aria-expanded={uploadSubjectId ? undefined : uploadMenuOpen}
            >
              + Upload recording
            </button>
            {uploadMenuOpen && !uploadSubjectId && (
              <div className="ac-menu" role="menu">
                {subjects.map((c) => (
                  <button
                    key={c.subjectId}
                    type="button"
                    role="menuitem"
                    className="ac-menu__item"
                    onClick={() => { setUploadMenuOpen(false); uploadFor(c.subjectId); }}
                  >
                    {c.subjectName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {recordings.length === 0 ? (
        <EmptyState
          icon="video"
          title="No recordings yet"
          message="Upload a session recording and it'll show up here, grouped by subject."
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
              {subjectsWithRecordings.map((c) => (
                <button
                  key={c.subjectId}
                  type="button"
                  className={`ac-pill${subjectFilter === String(c.subjectId) ? " is-active" : ""}`}
                  onClick={() => setSubjectFilter(String(c.subjectId))}
                >
                  {c.subjectName}
                </button>
              ))}
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="ac-emptyRow">No recordings for this subject yet.</div>
          ) : (
            <div className="recGrid">
              {cards.map((rec) => {
                const ready = rec.status === STATUS_READY;
                const failed = rec.status === STATUS_ERROR;
                // "Still processing" means no delete (design line 1137); a
                // failed transcode is finished, and is exactly the one a
                // teacher needs to clear away.
                const canDelete = ready || failed;
                const deleting = deletingId === rec.id;
                const duration = fmtDuration(rec.duration_seconds);
                const thumb =
                  ready &&
                  (rec.thumbnail_url ||
                    (import.meta.env.VITE_BUNNY_CDN_HOST && rec.bunny_video_id
                      ? `https://${import.meta.env.VITE_BUNNY_CDN_HOST}/${rec.bunny_video_id}/thumbnail.jpg`
                      : null));
                const meta = [rec.uploaded_by_name, rec.courseTitle]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={rec.id}
                    className={`recCard${ready ? "" : " recCard--pending"}`}
                    role={ready ? "button" : undefined}
                    tabIndex={ready ? 0 : undefined}
                    onClick={() => openPlayer(rec)}
                    onKeyDown={(e) => {
                      if (ready && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        openPlayer(rec);
                      }
                    }}
                  >
                    <div
                      className="recCard__thumb"
                      style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                    >
                      {ready ? (
                        <>
                          <span className="recCard__play" aria-hidden="true">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="7 4 20 12 7 20 7 4" />
                            </svg>
                          </span>
                          {duration && <span className="recCard__duration">{duration}</span>}
                        </>
                      ) : (
                        <span className="recCard__pendingLabel">
                          {STATUS_LABELS[rec.status] || "Processing"}
                          {failed ? "" : "…"}
                        </span>
                      )}
                    </div>

                    <div className="recCard__body">
                      <div className="recCard__top">
                        <span className={`subj-chip subj-chip--${subjectChipSlot(rec.subjectName)}`}>
                          {rec.subjectName}
                        </span>
                        <span className="recCard__date">{fmtDate(rec.session_date)}</span>
                      </div>

                      <div>
                        <div className="recCard__topic">{rec.title}</div>
                        {meta && <div className="recCard__meta">{meta}</div>}
                      </div>

                      <div className="recCard__footer">
                        <div className="recCard__progressWrap">
                          <div className="recCard__progressBar">
                            <div
                              className={`recCard__progressFill${failed ? " recCard__progressFill--error" : ""}`}
                              style={{ width: `${STATUS_PROGRESS[rec.status] ?? 0}%` }}
                            />
                          </div>
                          <span className="recCard__progressLabel">
                            {STATUS_LABELS[rec.status] || "Unknown"}
                          </span>
                        </div>

                        <div className="recCard__actions">
                          {canDelete && (
                            <button
                              type="button"
                              className="recCard__btn recCard__btn--danger"
                              aria-label={`Delete ${rec.title}`}
                              disabled={deleting}
                              onClick={(e) => { e.stopPropagation(); askDelete(rec); }}
                            >
                              <FiTrash2 aria-hidden="true" />
                              Delete
                            </button>
                          )}
                          <button
                            type="button"
                            className="recCard__btn"
                            disabled={!ready}
                            onClick={(e) => { e.stopPropagation(); openPlayer(rec); }}
                          >
                            {ready ? "Watch" : "Pending"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        dialog={confirmDlg && { ...confirmDlg, busy: deletingId != null }}
        onClose={() => setConfirmDlg(null)}
      />
    </div>
  );
}
