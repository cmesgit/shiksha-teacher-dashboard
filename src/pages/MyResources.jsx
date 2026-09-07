// src/pages/MyResources.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "My Resources" (teacher) — ONE list of everything this teacher has
// to look after: study materials, assignments, quizzes and recordings, side by
// side, filterable by type / class / batch / status / author.
//
// WHY THIS SCREEN EXISTS
//   The four CONTENT and LIVE nav items each show one type. Answering "what
//   have I got on Class 10 Physics?" meant opening four screens and holding
//   the answer in your head, and "what have I made?" was not answerable at all
//   — Assignment had no author column until this shipped.
//
//   This does NOT replace those four screens. They own the per-type actions
//   (build a quiz, grade a submission, trim a recording); this is the index,
//   and every row links back into the screen that owns it.
//
// Data:
//   · GET /dashboard/teacher/resources/ — the server-side union. ONE request,
//     already normalized to a single row shape and already scoped: each type
//     keeps its own pre-existing teacher scope rule there (assignments are
//     batch-aware, the other three are subject-level), so what this screen
//     lists always matches what the per-type mutation endpoints will allow.
//     Do NOT re-derive scope here.
//   · subjects — TeacherClassesContext, for the class pills only.
//
// The server owns filtering and paging, not this component: `count` is the
// unpaginated total and `totals` counts every type even while one type chip is
// selected (otherwise the unselected chips would all read 0, which looks
// exactly like "you have none of those").
// ──────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import "../styles/academyScreens.css";
import "../styles/my-resources.css";

const PAGE_SIZE = 50;

// The four types, in the order the chips read. `to` builds the link back into
// the screen that owns that type — this screen never edits anything itself.
//
// Every one of these deep-links to the ROW, not to that type's list. An index
// whose links land you on an unfiltered list has made you find the thing twice,
// and the rows are keyboard-activatable, so it reads as a broken link rather
// than a deliberate hand-off. All four target routes already exist in
// TeacherRoutes.jsx — check there before changing a path here.
const TYPES = [
  {
    key: "material",
    label: "Materials",
    one: "Material",
    icon: "clip",
    to: (row) =>
      `/teacher/classes/${row.subject_id}/study-materials/${row.id}`,
  },
  {
    key: "assignment",
    label: "Assignments",
    one: "Assignment",
    icon: "file",
    to: (row) => `/teacher/classes/${row.subject_id}/assignments/${row.id}`,
  },
  {
    key: "quiz",
    label: "Quizzes",
    one: "Quiz",
    icon: "help",
    // Quizzes live at a FLAT /teacher/quizzes/:quizId — the
    // classes/:subjectId/quizzes/:quizId form is a legacy redirect.
    to: (row) => `/teacher/quizzes/${row.id}`,
  },
  {
    key: "recording",
    label: "Recordings",
    one: "Recording",
    icon: "play",
    // "session-recordings", not "recordings": the nav item is /teacher/recordings
    // but the per-item player route is nested under the class.
    to: (row) =>
      `/teacher/classes/${row.subject_id}/session-recordings/${row.id}`,
  },
];

const TYPE_BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t]));

// The server's normalized status vocabulary. `live` deliberately reads
// "Visible to students" rather than "Published": materials have no publish
// flag at all (uploading IS publishing), so "Published" would imply an action
// that does not exist for a third of these rows.
const STATUS = {
  live: { label: "Visible to students", tag: "ac-tag--success" },
  draft: { label: "Draft", tag: "ac-tag--neutral" },
  processing: { label: "Processing", tag: "ac-tag--warning" },
  error: { label: "Upload failed", tag: "ac-tag--danger" },
};

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// The one-line summary under a row's title. Each type has different numbers
// worth showing, and an empty string is better than a zero that means nothing.
function metaLine(row) {
  const meta = row.meta || {};
  switch (row.type) {
    case "material": {
      const n = meta.file_count || 0;
      return n ? `${n} ${n === 1 ? "file" : "files"}` : "No files attached";
    }
    case "assignment": {
      const n = meta.submission_count || 0;
      const due = meta.due_date ? `Due ${formatDate(meta.due_date)}` : null;
      const subs = `${n} ${n === 1 ? "submission" : "submissions"}`;
      return [due, subs].filter(Boolean).join(" · ");
    }
    case "quiz": {
      const n = meta.question_count || 0;
      return n
        ? `${n} ${n === 1 ? "question" : "questions"}`
        : "No questions yet";
    }
    case "recording": {
      const dur = formatDuration(meta.duration_seconds);
      const when = meta.session_date ? formatDate(meta.session_date) : null;
      return [when, dur].filter(Boolean).join(" · ") || "Recording";
    }
    default:
      return "";
  }
}

export default function MyResources() {
  const navigate = useNavigate();
  const { classes, loading: classesLoading } = useTeacherClasses();

  const [typeFilter, setTypeFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [search, setSearch] = useState("");
  // Debounced copy of `search`. Typing must not fire one request per keypress.
  const [query, setQuery] = useState("");

  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [totals, setTotals] = useState({});
  const [truncated, setTruncated] = useState(false);
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Guards against an out-of-order response overwriting a newer one: a slow
  // request for "phy" must not land after the faster one for "physics" and
  // repopulate the list with stale rows.
  const requestRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change resets to the first page — staying on page 3 of a
  // narrower result set silently shows an empty list.
  //
  // Done in the setters, NOT in an effect on the filter values. As an effect it
  // ran in the same commit as the fetch effect below, so a filter changed while
  // on page 2 fired the request TWICE: once with the new filter and the stale
  // offset, then again after setPage(0) committed. requestRef discarded the
  // first response, but only after the server had done the whole four-leg scan.
  const applyFilter = useCallback((setter) => (value) => {
    setter(value);
    setPage(0);
  }, []);

  const chooseType = applyFilter(setTypeFilter);
  const chooseSubject = applyFilter(setSubjectFilter);
  const chooseStatus = applyFilter(setStatusFilter);
  const chooseMine = applyFilter(setMineOnly);

  // `query` is the debounced search, so it changes on a timer rather than from
  // a handler — it keeps an effect, and it is the only one that needs one.
  useEffect(() => {
    setPage(0);
  }, [query]);

  const load = useCallback(async () => {
    const ticket = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (typeFilter) params.type = typeFilter;
      if (subjectFilter) params.subject_id = subjectFilter;
      if (statusFilter) params.status = statusFilter;
      if (mineOnly) params.mine = "true";
      if (query) params.q = query;

      const { data } = await api.get("/dashboard/teacher/resources/", { params });
      if (ticket !== requestRef.current) return;

      setRows(Array.isArray(data?.results) ? data.results : []);
      setCount(data?.count || 0);
      setTotals(data?.totals || {});
      setTruncated(Boolean(data?.truncated));
    } catch (err) {
      if (ticket !== requestRef.current) return;
      setError(
        err?.response?.data?.detail ||
          "Could not load your resources. Please try again."
      );
      setRows([]);
    } finally {
      if (ticket === requestRef.current) setLoading(false);
    }
  }, [page, typeFilter, subjectFilter, statusFilter, mineOnly, query]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Refresh still-transcoding recordings ────────────────────────────────
  //
  // SessionRecording.status is a SNAPSHOT, not a live value. There is no Bunny
  // webhook: the column only advances when a client GETs
  // /courses/recordings/:id/status/, which is what asks Bunny. Rendering the
  // stored value alone means a recording that finished transcoding minutes ago
  // reads "Processing" forever — across reloads, across sessions — and the
  // "Processing" status filter keeps matching it, while students can already
  // watch it because is_published defaults True.
  //
  // Same mechanism SessionRecordings.jsx uses, keyed the same way: the set of
  // pending ids, so the effect is rebuilt only when that set changes and torn
  // down when the last one is ready. ONE pass, not an interval — this is an
  // index, and a teacher watching a specific upload finish belongs on the
  // Recordings screen, which polls continuously.
  const pendingKey = useMemo(
    () =>
      rows
        .filter((r) => r.type === "recording" && r.status === "processing")
        .map((r) => r.id)
        .sort()
        .join(","),
    [rows]
  );

  useEffect(() => {
    if (!pendingKey) return undefined;
    let cancelled = false;

    (async () => {
      const ids = pendingKey.split(",");
      const updates = await Promise.all(
        ids.map((id) =>
          api
            .get(`/courses/recordings/${id}/status/`)
            .then((res) => ({ id, data: res.data }))
            .catch(() => null)
        )
      );
      if (cancelled) return;

      // Re-derive the hub's normalized word from the fresh payload, using the
      // SAME rule the server uses (dashboard/teacher_resources.py
      // _row_recording): transcode state first, then the publish flag. A
      // finished recording the teacher has not published is a draft, not live —
      // resolving every ready row to "live" would tell them a private
      // recording was visible to the class.
      const settled = new Map();
      updates.filter(Boolean).forEach(({ id, data }) => {
        if (!data) return;
        const code = Number(data.status);
        if (code === 5) settled.set(String(id), "error");
        else if (code === 4) {
          settled.set(String(id), data.is_published ? "live" : "draft");
        }
        // Anything else is still transcoding — leave the row as it is.
      });
      if (settled.size === 0) return;

      // MERGE into the normalized row shape rather than replacing it: the
      // status payload is the bare recording serializer and knows nothing
      // about the subject/course/owner fields the hub attached.
      setRows((prev) =>
        prev.map((r) =>
          r.type === "recording" && settled.has(String(r.id))
            ? { ...r, status: settled.get(String(r.id)) }
            : r
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingKey]);

  const subjects = useMemo(
    () =>
      (classes || []).filter(
        (s, i, arr) => arr.findIndex((x) => x.subjectId === s.subjectId) === i
      ),
    [classes]
  );

  const grandTotal = useMemo(
    () => TYPES.reduce((sum, t) => sum + (totals[t.key] || 0), 0),
    [totals]
  );

  const hasFilters =
    Boolean(typeFilter || subjectFilter || statusFilter || query) || mineOnly;

  const clearFilters = () => {
    setTypeFilter("");
    setSubjectFilter("");
    setStatusFilter("");
    setMineOnly(false);
    setSearch("");
    setPage(0);
  };

  const lastPage = Math.max(0, Math.ceil(count / PAGE_SIZE) - 1);

  const subCopy = truncated
    ? `Showing the most recent ${grandTotal.toLocaleString()}+ items across your classes.`
    : `${grandTotal.toLocaleString()} ${
        grandTotal === 1 ? "item" : "items"
      } across your classes.`;

  if (classesLoading && loading && rows.length === 0) {
    return <LoadingState label="Loading your resources" />;
  }

  return (
    <div className="ac-screen mres-page">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">My Resources</h1>
          <p className="ac-head__sub">{subCopy}</p>
        </div>
      </div>

      {/* Type chips. Counts come from `totals`, which the server computes
          IGNORING the type filter, so a chip keeps its number while another
          chip is active. */}
      <div className="ac-tabs ac-tabs--tight mres-tabs">
        <button
          type="button"
          className={`ac-tab${typeFilter === "" ? " is-active" : ""}`}
          onClick={() => chooseType("")}
        >
          Everything
          <span className="ac-tab__count">{grandTotal}</span>
        </button>
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`ac-tab${typeFilter === t.key ? " is-active" : ""}`}
            onClick={() => chooseType(t.key)}
          >
            {t.label}
            <span className="ac-tab__count">{totals[t.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="ac-searchRow mres-controls">
        <input
          className="ac-searchInput"
          type="search"
          value={search}
          placeholder="Search by title…"
          aria-label="Search your resources"
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="ac-select"
          value={subjectFilter}
          aria-label="Filter by class"
          onChange={(e) => chooseSubject(e.target.value)}
        >
          <option value="">All classes</option>
          {subjects.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {[s.subjectName, s.courseTitle].filter(Boolean).join(" · ")}
            </option>
          ))}
        </select>

        <select
          className="ac-select"
          value={statusFilter}
          aria-label="Filter by status"
          onChange={(e) => chooseStatus(e.target.value)}
        >
          <option value="">Any status</option>
          <option value="live">Visible to students</option>
          <option value="draft">Drafts</option>
          <option value="processing">Processing</option>
          <option value="error">Upload failed</option>
        </select>

        {/* "Mine" is a filing question, never a permission one — a co-teacher's
            content stays fully editable whether this is on or off. */}
        <div className="ac-seg mres-seg" role="group" aria-label="Author">
          <button
            type="button"
            className={`ac-seg__btn${!mineOnly ? " is-active" : ""}`}
            onClick={() => chooseMine(false)}
          >
            Everyone
          </button>
          <button
            type="button"
            className={`ac-seg__btn${mineOnly ? " is-active" : ""}`}
            onClick={() => chooseMine(true)}
          >
            Only mine
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <LoadingState label="Loading your resources" />
      ) : rows.length === 0 ? (
        hasFilters ? (
          <section className="ac-listCard">
            <div className="ac-emptyRow">
              Nothing matches those filters.{" "}
              <button
                type="button"
                className="mres-linkBtn"
                onClick={clearFilters}
              >
                Clear them
              </button>
            </div>
          </section>
        ) : (
          <EmptyState
            icon="book"
            title="Nothing here yet"
            message="Material, assignments, quizzes and recordings you add for your classes all show up here."
          />
        )
      ) : (
        <>
          <section
            className={`ac-listCard ac-listCard--flush${
              loading ? " mres-list--busy" : ""
            }`}
          >
            {rows.map((row) => {
              const type = TYPE_BY_KEY[row.type];
              const status = STATUS[row.status] || STATUS.draft;
              const where = [row.subject_name, row.course_title]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={`${row.type}-${row.id}`}
                  className="ac-row ac-row--flush mres-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => type && navigate(type.to(row))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      type && navigate(type.to(row));
                    }
                  }}
                >
                  <span className="ac-tag ac-tag--info mres-typeTag">
                    {type?.one || row.type}
                  </span>

                  <div className="ac-row__body">
                    <div className="ac-row__topic mres-title">{row.title}</div>
                    <div className="ac-row__sub">
                      {where}
                      {row.chapter_name ? ` · ${row.chapter_name}` : ""}
                      {" · "}
                      {metaLine(row)}
                    </div>
                  </div>

                  {/* NULL author is a real, permanent state — rows that predate
                      the author column have none. "Unknown" is the honest
                      label; attributing them to the viewer would be a lie. */}
                  <span className="ac-row__col mres-owner">
                    {row.is_mine ? "You" : row.owner_name || "Unknown"}
                  </span>

                  <span className="ac-row__col mres-batch">
                    {row.batch_name || "All batches"}
                  </span>

                  <span className={`ac-tag ${status.tag} mres-status`}>
                    {status.label}
                  </span>

                  <span className="ac-row__col mres-date">
                    {formatDate(row.created_at)}
                  </span>
                </div>
              );
            })}
          </section>

          {count > PAGE_SIZE && (
            <div className="mres-pager">
              <button
                type="button"
                className="ac-btn"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Newer
              </button>
              <span className="mres-pager__label">
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, count)} of{" "}
                {count.toLocaleString()}
              </span>
              <button
                type="button"
                className="ac-btn"
                disabled={page >= lastPage || loading}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              >
                Older →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
