/**
 * ExpertSkills.jsx — "My skills", rewritten for multiple listings.
 *
 * Replaces the read-only subject/skills/about summary this page used to be. A
 * teacher now has N SkillListing rows, each priced and booked separately, each
 * pausable without hiding the rest of the profile.
 *
 *   GET   /skill/teacher/listings/               → SkillListing[]
 *   PATCH /skill/teacher/listings/<id>/          → { is_active }
 *
 * Chrome (sidebar, .sk-page, .rd-card, .sk-btn) comes from the existing
 * SkillDevLayout + styles/skillDev.css — not restyled here.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import { RatingSummary } from "../../components/skill/RatingStars";
import api from "../../shared/apiClient";
import { useSkillToast } from "../../components/useSkillToast";
import { LoadingState, ErrorState } from "../../components/StateViews";
import "../../styles/skillDev.css";
import "../../styles/skillListings.css";

const VIDEO_STATE = {
  1: { label: "Video uploading", bg: "#fef3ec", fg: "#c2701c" },
  2: { label: "Video processing", bg: "#fef3ec", fg: "#c2701c" },
  3: { label: "Video transcoding", bg: "#fef3ec", fg: "#c2701c" },
  4: { label: "Intro video live", bg: "#ecf8ee", fg: "#2f7d3f" },
  5: { label: "Video failed", bg: "#fef2f2", fg: "#dc2626" },
};
const NO_VIDEO = { label: "No intro video", bg: "#f3f4f6", fg: "#6b7c83" };

export default function ExpertSkills() {
  const navigate = useNavigate();
  const showToast = useSkillToast();

  const [listings, setListings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [busyId, setBusyId]     = useState(null);

  const load = () => {
    setLoading(true);
    setError(false);
    api.get("/skill/teacher/listings/")
      .then((r) => setListings(Array.isArray(r.data) ? r.data : r.data.results || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const togglePause = async (l) => {
    setBusyId(l.id);
    const next = !l.is_active;
    // Optimistic — a pause toggle that waits on the network feels broken.
    setListings((rows) => rows.map((r) => (r.id === l.id ? { ...r, is_active: next } : r)));
    try {
      await api.patch(`/skill/teacher/listings/${l.id}/`, { is_active: next });
      showToast(next
        ? `${l.title} is live again.`
        : `${l.title} paused — existing bookings are unaffected.`);
    } catch {
      setListings((rows) => rows.map((r) => (r.id === l.id ? { ...r, is_active: !next } : r)));
      showToast("Could not update that skill.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading your skills" />;
  if (error) return <ErrorState title="Couldn't load your skills" onRetry={load} />;

  const liveCount = listings.filter((l) => l.is_active).length;

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">My skills</div>
          <div className="sk-head__sub">
            {listings.length} {listings.length === 1 ? "skill" : "skills"} · {liveCount} live.
            Each one is priced and booked separately.
          </div>
        </div>
        <button className="sk-btn" onClick={() => navigate("/teacher/expert/skills/new")}>
          <Icon.plus size={14} /> Add a skill
        </button>
      </div>

      {listings.length === 0 ? (
        <button className="sk-emptyadd" onClick={() => navigate("/teacher/expert/skills/new")}>
          You haven't listed a skill yet. Add your first one — it goes live immediately.
        </button>
      ) : (
        <div className="sk-listings">
          {listings.map((l) => {
            const v = VIDEO_STATE[l.intro_video_status] || NO_VIDEO;
            return (
              <article key={l.id} className={`rd-card sk-listing${l.is_active ? "" : " sk-listing--paused"}`}>
                <header className="sk-listing__head">
                  <div className="sk-listing__id">
                    <div className="sk-listing__titlerow">
                      <h3>{l.title}</h3>
                      <span className="sk-listing__cat">{l.category_label}</span>
                      <span className={`sk-listing__status${l.is_active ? " on" : ""}`}>
                        {l.is_active ? "LIVE" : "PAUSED"}
                      </span>
                      {l.is_suspended && (
                        <span className="sk-listing__status sk-listing__status--susp">SUSPENDED</span>
                      )}
                    </div>
                    <p>{l.description}</p>
                    <div className="sk-listing__tags">
                      {(l.skill_tags || []).map((t) => <span key={t}>{t}</span>)}
                    </div>
                  </div>

                  <div className="sk-listing__price">
                    <div>
                      <b>{l.price_rupees === 0 ? "Free" : `₹${l.price_rupees}`}</b>
                      <span>per 60-min session</span>
                    </div>
                    <button
                      type="button"
                      className={`sk-switch${l.is_active ? " on" : ""}`}
                      onClick={() => togglePause(l)}
                      disabled={busyId === l.id || l.is_suspended}
                      aria-pressed={l.is_active}
                      aria-label={l.is_active ? `Pause ${l.title}` : `Resume ${l.title}`}
                      title={l.is_suspended ? "An admin suspended this skill — contact support to lift it." : undefined}
                    >
                      <i />
                    </button>
                  </div>
                </header>

                <footer className="sk-listing__foot">
                  <RatingSummary value={Number(l.rating)} count={l.reviews_count} size={12} />
                  <span><Icon.users size={13} /> {l.sessions_count} sessions taught</span>
                  <span><Icon.clock size={13} /> {l.open_slots ? `${l.open_slots} open slots` : "No slots set"}</span>
                  <span><Icon.spark size={13} /> {l.mastery_target} sessions to mastery</span>
                  <span className="sk-listing__vid" style={{ background: v.bg, color: v.fg }}>{v.label}</span>
                  <span className="sk-listing__actions">
                    <button onClick={() => navigate(`/teacher/expert/skills/${l.id}`)}>Edit</button>
                    <button onClick={() => navigate("/teacher/expert/availability")}>Slots</button>
                  </span>
                </footer>
              </article>
            );
          })}

          <button className="sk-emptyadd" onClick={() => navigate("/teacher/expert/skills/new")}>
            + Add another skill — no limit, and each goes live immediately
          </button>
        </div>
      )}
    </div>
  );
}
