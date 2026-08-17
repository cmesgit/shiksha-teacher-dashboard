/**
 * SkillListingForm.jsx — add or edit one SkillListing.
 *
 * Routes: /teacher/expert/skills/new  and  /teacher/expert/skills/:id
 *
 *   POST  /skill/teacher/listings/            → create
 *   PATCH /skill/teacher/listings/<id>/       → update
 *
 * The intro video is per LISTING, not per expert — the whole point of
 * multi-skill is that a guitar clip does not advertise a welding class. It can
 * only be uploaded after the listing exists, so a new skill is saved first.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../shared/apiClient";
import { useSkillToast } from "../../components/useSkillToast";
import IntroVideoUpload from "../../components/skill/IntroVideoUpload";
import { LoadingState } from "../../components/StateViews";
import "../../styles/skillDev.css";
import "../../styles/skillListings.css";

const BLANK = {
  title: "", category: "", price_rupees: "", description: "",
  skill_tags: [], mastery_target: 3, is_active: true,
};

/** DRF returns {field: ["message", …]}; the form renders one string. */
const firstError = (v) => (Array.isArray(v) ? v[0] : typeof v === "string" ? v : null);

export default function SkillListingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useSkillToast();

  const [form, setForm]         = useState(BLANK);
  const [categories, setCats]   = useState([]);
  const [tagDraft, setTagDraft] = useState("");
  const [loading, setLoading]   = useState(Boolean(id));
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState({});

  useEffect(() => {
    api.get("/skill/categories/").then((r) => setCats(r.data || [])).catch(() => {});
    if (!id) return;
    setLoading(true);
    api.get(`/skill/teacher/listings/${id}/`)
      .then((r) => setForm({ ...BLANK, ...r.data }))
      .catch(() => showToast("Could not load that skill."))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: null }));
  };

  const addTag = (raw) => {
    const t = raw.trim();
    if (!t || form.skill_tags.includes(t)) { setTagDraft(""); return; }
    set("skill_tags", [...form.skill_tags, t]);
    setTagDraft("");
  };

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 4)   e.title = "Give the skill a title students will recognise.";
    if (!form.category)                 e.category = "Pick a category.";
    if (form.price_rupees === "" ||
        Number(form.price_rupees) < 0)  e.price_rupees = "Enter a price, or 0 for free.";
    if (!form.description.trim())       e.description = "Two or three sentences a student can decide from.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      title: form.title,
      category: form.category,
      description: form.description,
      skill_tags: form.skill_tags,
      price_rupees: Number(form.price_rupees),
      mastery_target: Number(form.mastery_target) || 3,
      is_active: form.is_active,
    };
    try {
      const res = id
        ? await api.patch(`/skill/teacher/listings/${id}/`, payload)
        : await api.post("/skill/teacher/listings/", payload);
      showToast(id ? "Skill updated." : `${res.data.title} is live.`);
      // A new skill goes straight to its own edit screen so the intro video —
      // which needs an id to upload against — can be added without hunting.
      navigate(id ? "/teacher/expert/skills" : `/teacher/expert/skills/${res.data.id}`);
    } catch (err) {
      const data = err?.response?.data || {};
      setErrors(Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, firstError(v)])
      ));
      showToast(firstError(data.detail) || "Could not save that skill.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading skill" />;

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">{id ? "Edit skill" : "Add a skill"}</div>
          <div className="sk-head__sub">Students book this separately from your other skills.</div>
        </div>
      </div>

      <div className="rd-card">
        <div className="sk-form">
          <Field label="Skill title" error={errors.title}>
            <input className="sk-input" value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Piano & church accompaniment" maxLength={120} />
          </Field>

          <div className="sk-form__row" data-tour="expert-listing.category-price">
            <Field label="Category" error={errors.category}>
              <select className="sk-input" value={form.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">Choose…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Price per session" error={errors.price_rupees}>
              <input className="sk-input" value={form.price_rupees} inputMode="numeric"
                onChange={(e) => set("price_rupees", e.target.value.replace(/\D/g, ""))}
                placeholder="700" />
            </Field>
          </div>

          <Field label="What you teach in it" error={errors.description}>
            <textarea className="sk-input" rows={3} value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Two or three sentences a student can decide from." />
          </Field>

          <Field label="Skill tags" error={errors.skill_tags}>
            <div className="sk-tagfield" data-tour="expert-listing.skill-tags">
              {form.skill_tags.map((t) => (
                <span key={t} className="sk-tagfield__tag">
                  {t}
                  <button type="button" aria-label={`Remove ${t}`}
                    onClick={() => set("skill_tags", form.skill_tags.filter((x) => x !== t))}>✕</button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagDraft); } }}
                onBlur={() => addTag(tagDraft)}
                placeholder="Type and press enter…"
              />
            </div>
          </Field>

          <Field label="Intro video for this skill">
            <IntroVideoUpload listingId={id} status={form.intro_video_status} />
          </Field>

          <div className="sk-form__row">
            <Field label="Sessions to mastery" error={errors.mastery_target}>
              <input className="sk-input" value={form.mastery_target} inputMode="numeric"
                onChange={(e) => set("mastery_target", e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Availability">
              {/* Slots stay on the PROFILE, not the listing — per-listing grids
                  can double-book the same human. */}
              <button type="button" className="sk-btn sk-btn--ghost sk-btn--block"
                onClick={() => navigate("/teacher/expert/availability")}>
                Set your weekly slots →
              </button>
            </Field>
          </div>
        </div>

        <div className="sk-form__foot">
          <span>Goes live immediately. An admin can suspend it later.</span>
          <span>
            <button className="sk-btn sk-btn--ghost" onClick={() => navigate("/teacher/expert/skills")}>Cancel</button>
            <button className="sk-btn" onClick={submit} disabled={saving} data-tour="expert-listing.publish">
              {saving ? "Saving…" : id ? "Save changes" : "Publish skill"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div className="sk-field">
      <div className="sk-field__label">{label}</div>
      {children}
      {error && <div className="sk-field__err">{error}</div>}
    </div>
  );
}
