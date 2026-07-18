import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import "../styles/live-session-create.css";
import toast from "react-hot-toast";

// ✅ NEW
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/* =====================================
   🔥 TIME HELPERS
===================================== */

// ✅ safer rounding (no 60 min bug)
function roundToSlot(date) {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const remainder = minutes % 15;

  if (remainder !== 0) {
    d.setMinutes(minutes + (15 - remainder));
  }

  d.setSeconds(0);
  d.setMilliseconds(0);

  return d;
}

export default function TeacherCreateLiveSession() {
  const { subjectId } = useParams();
  const navigate = useNavigate();

  const now = roundToSlot(new Date());

  const [form, setForm] = useState({
    title: "",
    description: "",
    start_time: now, // ✅ Date object
    duration: 60,
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Batch picker: a live session now belongs to a specific batch (the
  // backend requires batch_id). Fetch the batches this teacher can schedule
  // this subject for, and default to the first one.
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/courses/subjects/${subjectId}/batches/`)
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setBatches(list);
        if (list.length) setBatchId(String(list[0].id));
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  /* =====================================
     🔥 START NOW
  ===================================== */
  const handleStartNow = async () => {
    if (!form.title) {
      setError("Please enter a session title.");
      toast.error("Please enter a session title");
      return;
    }

    if (!batchId) {
      setError("Please select a batch.");
      toast.error("Please select a batch");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const start = new Date();
      const end = new Date(start.getTime() + form.duration * 60000);

      const res = await api.post("/livestream/sessions/", {
        title: form.title,
        description: form.description,
        subject_id: subjectId,
        batch_id: batchId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        force_live: true,
      });

      toast.success("Session started!");
      navigate(`/teacher/live/${res.data.id}`);
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Failed to start session.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* =====================================
     🔥 HANDLE SUBMIT
  ===================================== */
  const handleSubmit = async () => {
    setError(null);

    if (!form.title || !form.start_time || !batchId) {
      setError("Please fill all required fields.");
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);

      const start = form.start_time;
      const end = new Date(start.getTime() + form.duration * 60000);

      await api.post("/livestream/sessions/", {
        title: form.title,
        description: form.description,
        subject_id: subjectId,
        batch_id: batchId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        force_live: true
      });

      toast.success("✅ Live session created!");

      setTimeout(() => {
        navigate(`/teacher/classes/${subjectId}/live-sessions`);
      }, 800);

    } catch (err) {
      console.error(err);

      const msg =
        err.response?.data?.detail ||
        err.response?.data?.start_time?.[0] ||
        err.response?.data?.end_time?.[0] ||
        err.response?.data?.subject_id?.[0] ||
        err.response?.data?.batch_id?.[0] ||
        err.response?.data?.non_field_errors?.[0] ||
        "Failed to create session.";

      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* =====================================
     🔥 UI
  ===================================== */

  const durationOptions = [
    { label: "+30 min", value: 30 },
    { label: "+1 hr", value: 60 },
    { label: "+2 hr", value: 120 },
    { label: "+3 hr", value: 180 },
    { label: "+4 hr", value: 240 },
  ];

  return (
    <div className="lsc-page">

      <button className="lsc-back-btn" onClick={() => navigate(`/teacher/classes/${subjectId}/live-sessions`)}>
        <IoChevronBack /> Back
      </button>

      <div className="lsc-card">
        <h2 className="lsc-title">Schedule Live Session</h2>

        {error && <div className="lsc-error">⚠ {error}</div>}

        <div className="lsc-form">

          {/* BATCH */}
          <div className="lsc-field">
            <label>Batch *</label>
            {batches.length === 0 ? (
              <div className="lsc-error">
                No active batch found for this subject. Create a batch first.
              </div>
            ) : (
              <select
                className="lsc-input"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                    {b.year ? ` — ${b.year}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* TITLE */}
          <div className="lsc-field">
            <label>Session Title *</label>
            <input
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
            />
          </div>

          {/* DESCRIPTION */}
          <div className="lsc-field">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <hr />

          {/* START TIME */}
          <div className="lsc-field">
            <label>Start Time (15-min slots)</label>

            <DatePicker
              selected={form.start_time}
              onChange={(date) =>
                setForm({
                  ...form,
                  start_time: roundToSlot(date),
                })
              }
              showTimeSelect
              timeIntervals={15} // 🔥 15-min enforced
              timeCaption="Time"
              dateFormat="dd-MM-yyyy HH:mm"
              minDate={new Date()}
              className="lsc-input"
            />

            {/* ✅ START NOW BUTTON */}
            <button
              type="button"
              onClick={handleStartNow}
              style={{
                marginTop: "8px",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                cursor: "pointer",
              }}
            >
              Start Now
            </button>
          </div>

          {/* DURATION */}
          <div className="lsc-field">
            <label>Duration</label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {durationOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm({ ...form, duration: opt.value })
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border:
                      form.duration === opt.value
                        ? "2px solid #2563eb"
                        : "1px solid #ccc",
                    background:
                      form.duration === opt.value ? "#e0edff" : "white",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* SUBMIT */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="lsc-submit"
          >
            {loading ? "Creating..." : "Create Live Session"}
          </button>

        </div>
      </div>
    </div>
  );
}