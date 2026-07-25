import { useState } from "react";
import api from "../../api/apiClient";
import "./ReviewModal.css";

function Stars({ value, onChange }) {
  return (
    <div className="reviewModal__stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`reviewModal__star${n <= value ? " is-filled" : ""}`}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// Shown when leaving a live/private class (never group — see spec section 10).
// Rating is optional to skip. `sessionType` picks the endpoint — Live and
// Private sessions are backed by different Django apps with different URL
// prefixes, so there's no single shared path.
const REVIEW_URL = {
  live: (id) => `/livestream/sessions/${id}/review/`,
  private: (id) => `/sessions/${id}/review/`,
};

export default function ReviewModal({ sessionId, onDone, sessionType = "live" }) {
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await api.post(REVIEW_URL[sessionType](sessionId), { rating, description });
    } catch (e) {
      console.error("Failed to submit review", e);
    } finally {
      setSubmitting(false);
      onDone();
    }
  };

  return (
    <div className="reviewModal__overlay">
      <div className="reviewModal__panel">
        <h2 className="reviewModal__title">How was the class?</h2>
        <p className="reviewModal__sub">Rate the session — your feedback helps improve future classes.</p>

        <Stars value={rating} onChange={setRating} />

        <textarea
          className="reviewModal__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Anything you'd like to share? (optional)"
          rows={3}
        />

        <div className="reviewModal__footer">
          <button type="button" className="reviewModal__btn reviewModal__btn--outline" onClick={onDone}>
            Skip
          </button>
          <button
            type="button"
            className="reviewModal__btn reviewModal__btn--primary"
            disabled={rating === 0 || submitting}
            onClick={submit}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
