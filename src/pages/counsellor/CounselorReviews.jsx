// PLACEMENT: src/pages/counsellor/CounselorReviews.jsx   (NEW FILE — teacher dashboard)
//
// Workflow §11 "Reviews" — the ratings students left on completed sessions.
//
// Reads the same public endpoint the directory uses, so a counsellor sees
// exactly what a visitor browsing their profile sees — including the
// abbreviated student names ("Aditya M."). Showing them full names here
// would be a quieter version of publishing them.

import React, { useEffect, useState } from "react";
import { getCounselorReviews } from "../../api/counselorService";
import { useCounselor } from "../../layout/CounselorContext";
import "../../styles/counsellor.css";

const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN",
    { day: "numeric", month: "short", year: "numeric" }) : "";

function Stars({ value }) {
  return (
    <span className="co-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "co-star co-star--on" : "co-star"}>★</span>
      ))}
    </span>
  );
}

export default function CounselorReviews() {
  const { me } = useCounselor() || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me?.id) return;
    getCounselorReviews(me.id)
      .then(setData)
      .catch(() => setError("Couldn't load your reviews — please refresh."));
  }, [me?.id]);

  const reviews = data?.results || [];

  // Distribution across the 5 buckets, for the summary bars.
  const spread = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }));
  const maxCount = Math.max(1, ...spread.map((s) => s.count));

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">Reviews</h1>
          <p className="co-sub">
            What students said after their sessions. This is the same list
            visitors see on your public profile.
          </p>
        </div>
      </div>

      {error && <div className="co-error">{error}</div>}

      {data === null ? (
        <div className="co-skel" style={{ height: 140 }} />
      ) : reviews.length === 0 ? (
        <div className="co-empty">
          <div className="co-empty-title">No reviews yet</div>
          Students can rate a session once it is marked completed.
        </div>
      ) : (
        <>
          <div className="co-card co-rv-summary">
            <div className="co-rv-score">
              <strong>{Number(data.avg_rating).toFixed(1)}</strong>
              <Stars value={Math.round(data.avg_rating)} />
              <span className="co-sub">
                {data.rating_count} review{data.rating_count === 1 ? "" : "s"}
              </span>
            </div>
            <div className="co-rv-bars">
              {spread.map(({ n, count }) => (
                <div key={n} className="co-rv-bar">
                  <span className="co-rv-bar-n">{n}★</span>
                  <span className="co-rv-bar-track">
                    <i style={{ width: `${(count / maxCount) * 100}%` }} />
                  </span>
                  <span className="co-rv-bar-c">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="co-list">
            {reviews.map((r) => (
              <div key={r.id} className="co-card">
                <div className="co-rv-head">
                  <Stars value={r.rating} />
                  <strong className="co-rv-who">{r.student_name}</strong>
                  <span className="co-sub">{fmtDay(r.session_date)}</span>
                </div>
                {r.topic && <div className="co-note co-note--inline">"{r.topic}"</div>}
                {r.comment && <p className="co-rv-text">{r.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
