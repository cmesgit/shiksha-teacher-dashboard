import { useNavigate } from "react-router-dom";

export default function LiveSessionCard({ id, subject, topic, startsIn, timing, live }) {
  const navigate = useNavigate();

  return (
    <div className="live-card">
      <div className="live-card-body">
        <h5>{subject}</h5>
        <p>{topic}</p>
        <p>Batch/Class ID</p>
        <p className="live-card-spacer"></p>
        <p className="starts-in">{startsIn}</p>
        <p className="time">{timing}</p>
        {id && (
          <button
            type="button"
            className="live-card__btn"
            onClick={() => navigate(`/teacher/live/${id}`)}
          >
            {live ? "Rejoin" : "Start class"}
          </button>
        )}
      </div>
    </div>
  );
}
