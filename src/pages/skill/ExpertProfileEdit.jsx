/**
 * PLACEMENT: src/pages/skill/ExpertProfileEdit.jsx
 * ACTION:    Replace the entire file.
 *
 * Wired to GET/PATCH /skill/teacher/profile/ (TeacherProfileUpdateView).
 * This is the single place a guest expert fills in EVERY profile field the
 * spec requires — and the same place they edit it later. The server keeps the
 * profile UNLISTED until it is complete, then flips is_listed automatically.
 *
 * Collected here (spec "skill dev guest expert profile"):
 *   • Personal — full name, date of birth, phone, profile photo
 *   • Teaching — subject (category or free-text description), languages,
 *                about-you
 *   • Location — class mode (home / travel / online) + exact location for the
 *                two offline modes, with pincode / city / district / state
 *
 * Pricing/payment is intentionally NOT collected: booking is free at launch
 * and toggled globally from admin, so there is no rate or UPI-payee field.
 *
 * A live checklist mirrors the backend's completeness rule so the expert can
 * see exactly what's still needed to get listed. Partial saves are allowed —
 * the dashboard gate keeps them on this page until everything is filled.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import { useBunnyUpload } from "../../hooks/useBunnyUpload";
import "../../styles/skillDev.css";
import { LoadingState } from "../../components/StateViews";

const MODES = [
  { v: "online", label: "Online only" },
  { v: "home",   label: "At my place" },
  { v: "travel", label: "I travel" },
];

const OFFLINE = new Set(["home", "travel"]);

// Friendly labels for the field names the backend returns in `missing`.
const MISSING_LABELS = {
  subject_description: "Subject & description",
  languages:          "Languages",
  bio:                "About you",
  class_mode:         "Class mode",
  class_location:     "Class location",
  full_name:          "Full name",
  date_of_birth:      "Date of birth",
  phone:              "Phone number",
  profile_photo:      "Profile photo",
};

const BLANK = {
  // teaching — `categories` is the full multi-subject set; `category` stays
  // as its first entry for backward compatibility with older consumers.
  category: "", categories: [], subject_description: "", bio: "", languages: "",
  availability: "",
  // location
  class_mode: "online", class_location: "",
  pincode: "", state: "", district: "", city: "",
  // personal
  full_name: "", date_of_birth: "", phone: "",
};

export default function ExpertProfileEdit() {
  const navigate = useNavigate();
  // The layout supplies refreshGate so a save here lifts the dashboard gate.
  const ctx = useOutletContext() || {};
  const refreshGate = ctx.refreshGate;

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [err, setErr]           = useState("");
  const [cats, setCats]         = useState([]);
  const [f, setF]               = useState(BLANK);
  const [photoUrl, setPhotoUrl] = useState("");   // existing photo from server
  const [photoFile, setPhotoFile] = useState(null); // newly chosen file
  const [photoPreview, setPhotoPreview] = useState(""); // object URL for preview

  // Intro video — a short clip advertising what this expert teaches. One
  // per profile, uploaded via Bunny, same pattern as Academy recordings.
  const [introVideoUrl, setIntroVideoUrl] = useState("");     // ready embed URL, or ""
  const [introVideoPending, setIntroVideoPending] = useState(false); // uploaded, still transcoding
  const {
    upload: uploadIntroVideo,
    progress: introProgress,
    uploading: introUploading,
  } = useBunnyUpload({
    createUrl: "/skill/teacher/intro-video/create/",
    signUrl: "/skill/teacher/intro-video/upload-url/",
  });

  // ── Load categories (optional) + the current profile ──────────────────────
  useEffect(() => {
    let alive = true;

    api.get("/skill/categories/")
      .then((r) => { if (alive) setCats(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { /* category list is optional — free-text still works */ });

    api.get("/skill/teacher/profile/")
      .then((r) => {
        if (!alive) return;
        const d = r.data || {};
        setF({
          ...BLANK,
          ...d,
          category:   d.category || "",
          categories: Array.isArray(d.categories) && d.categories.length
                        ? d.categories
                        : (d.category ? [d.category] : []),
          languages:  Array.isArray(d.languages) ? d.languages.join(", ") : (d.languages || ""),
        });
        setPhotoUrl(d.photo || "");
        setIntroVideoUrl(d.intro_video_embed_url || "");
        setIntroVideoPending(!!d.intro_video_bunny_id && !d.intro_video_embed_url);
      })
      .catch(() => setErr("Couldn't load your profile."))
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, []);

  const onIntroVideoFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const allowed = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowed.includes(file.type)) {
      setErr("Only MP4, WebM, or MOV files are allowed.");
      return;
    }
    if (file.size > 4 * 1024 * 1024 * 1024) {
      setErr("File is too large (max 4 GB).");
      return;
    }
    setErr("");
    try {
      const videoId = await uploadIntroVideo(file, { title: `intro-${f.full_name || "expert"}` });
      await api.post("/skill/teacher/intro-video/save/", { video_id: videoId });
      // Bunny still needs to transcode — not playable immediately.
      setIntroVideoPending(true);
    } catch {
      setErr("Video upload failed. Please try again.");
    }
  };

  // Revoke the preview object URL when it changes / on unmount.
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const set = (k) => (e) => { setSaved(false); setF((p) => ({ ...p, [k]: e.target.value })); };
  const offline = OFFLINE.has(f.class_mode);
  const hasPhoto = !!(photoFile || photoUrl);

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setSaved(false);
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // ── Live completeness — mirrors skills/profile_ops.py so the checklist
  //    matches what the server will decide. ──────────────────────────────────
  const missing = useMemo(() => {
    const m = [];
    const hasSubject = !!((f.categories || []).length || f.category || (f.subject_description || "").trim());
    if (!hasSubject)                       m.push("subject_description");
    if (!(f.languages || "").trim())       m.push("languages");
    if (!(f.bio || "").trim())             m.push("bio");
    if (!MODES.some((x) => x.v === f.class_mode)) m.push("class_mode");
    if (OFFLINE.has(f.class_mode) && !(f.class_location || "").trim()) m.push("class_location");
    if (!(f.full_name || "").trim())       m.push("full_name");
    if (!(f.date_of_birth || "").trim())   m.push("date_of_birth");
    if (!(f.phone || "").trim())           m.push("phone");
    if (!hasPhoto)                         m.push("profile_photo");
    return m;
  }, [f, hasPhoto]);

  const complete = missing.length === 0;

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = () => {
    setErr(""); setSaved(false);
    if (offline && !(f.class_location || "").trim()) {
      setErr("Add your class location — it's required for offline teaching.");
      return;
    }
    setSaving(true);

    // Fields common to both encodings. languages goes as a comma string;
    // the backend accepts either a CSV string or a list.
    const fields = {
      categories:          f.categories || [],
      category:            (f.categories && f.categories[0]) || f.category || "",
      subject_description: f.subject_description || "",
      bio:                 f.bio || "",
      availability:        f.availability || "",
      class_mode:          f.class_mode,
      class_location:      f.class_location || "",
      pincode:             f.pincode || "",
      state:               f.state || "",
      district:            f.district || "",
      city:                f.city || "",
      full_name:           f.full_name || "",
      date_of_birth:       f.date_of_birth || "",
      phone:               f.phone || "",
    };

    let request;
    if (photoFile) {
      // multipart so the new profile photo rides along
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
      fd.append("languages", (f.languages || "").trim());
      fd.append("profile_photo", photoFile);
      request = api.patch("/skill/teacher/profile/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } else {
      request = api.patch("/skill/teacher/profile/", {
        ...fields,
        languages: (f.languages || "").split(",").map((s) => s.trim()).filter(Boolean),
      });
    }

    request
      .then((r) => {
        const d = r.data || {};
        setSaved(true);
        if (d.photo) { setPhotoUrl(d.photo); setPhotoFile(null);
          if (photoPreview) { URL.revokeObjectURL(photoPreview); setPhotoPreview(""); } }
        // Lift the dashboard gate with the server's authoritative status.
        if (typeof refreshGate === "function") refreshGate(d);
        // Fully complete → drop them onto the dashboard.
        if (d.is_complete) navigate("/teacher/expert");
      })
      .catch((e) => setErr(
        e?.response?.data?.class_location ||
        e?.response?.data?.detail ||
        "Couldn't save. Please try again."
      ))
      .finally(() => setSaving(false));
  };

  if (loading) return <LoadingState label="Loading your profile" />;

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">My profile</div>
          <div className="sk-head__sub">How learners see you on your public listing.</div>
        </div>
      </div>

      {/* Completeness checklist — what's left before you get listed */}
      {!complete ? (
        <div className="rd-card teacher" style={{ borderLeft: "3px solid #c9a227", marginBottom: 14 }}>
          <h4 style={{ marginTop: 0 }}>Finish your profile to get listed</h4>
          <div style={{ fontSize: 12.5, color: "#6b7c83", marginBottom: 10, lineHeight: 1.5 }}>
            Your profile stays hidden from learners until these are filled in. You can save
            progress any time.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {missing.map((k) => (
              <span key={k} style={{
                fontSize: 12, fontWeight: 600, color: "#8a6d1f",
                background: "#fbf4dd", border: "1px solid #ecdca4",
                borderRadius: 999, padding: "4px 10px",
              }}>
                {MISSING_LABELS[k] || k}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rd-card teacher" style={{ borderLeft: "3px solid #2f9d42", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2f9d42", fontWeight: 700, fontSize: 13 }}>
            <Icon.check size={16} /> Your profile is complete — you're listed for learners to find.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="sk-dash-grid">

        {/* ── Column 1: About you + what you teach ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Personal */}
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4><Icon.user size={14} /> &nbsp;About you</h4>

            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 4 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", overflow: "hidden",
                background: "#eef2ef", flexShrink: 0, border: "1px solid #dce5df",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {(photoPreview || photoUrl)
                  ? <img src={photoPreview || photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Icon.user size={26} />}
              </div>
              <div className="sk-field" style={{ flex: 1, margin: 0 }}>
                <label>Profile photo</label>
                <input className="sk-input" type="file" accept="image/*" onChange={onPhoto} />
              </div>
            </div>

            <div className="sk-field">
              <label>Intro video <span style={{ fontWeight: 500, color: "#9aa9af" }}>— a short clip advertising what you teach</span></label>
              {introVideoUrl ? (
                <div style={{ marginTop: 4 }}>
                  <iframe
                    src={introVideoUrl}
                    title="Your intro video"
                    style={{ width: "100%", aspectRatio: "16/9", border: "none", borderRadius: 10 }}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                  <label className="sk-btn sk-btn--ghost" style={{ display: "inline-flex", marginTop: 8, cursor: "pointer" }}>
                    Replace video
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onIntroVideoFile} style={{ display: "none" }} />
                  </label>
                </div>
              ) : introUploading ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 8, borderRadius: 999, background: "#e9eef0", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${introProgress}%`, background: "var(--skill)", transition: "width .2s" }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "#9aa9af", marginTop: 4 }}>Uploading… {introProgress}%</div>
                </div>
              ) : introVideoPending ? (
                <div style={{ fontSize: 11.5, color: "#9aa9af", marginTop: 4 }}>
                  Processing your video — check back in a few minutes.
                </div>
              ) : (
                <input className="sk-input" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onIntroVideoFile} />
              )}
            </div>

            <div className="sk-field">
              <label>Full name</label>
              <input className="sk-input" value={f.full_name} onChange={set("full_name")} placeholder="Your name as learners should see it" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="sk-field"><label>Date of birth</label>
                <input className="sk-input" type="date" value={f.date_of_birth} onChange={set("date_of_birth")} /></div>
              <div className="sk-field"><label>Phone number</label>
                <input className="sk-input" value={f.phone} onChange={set("phone")} placeholder="10-digit mobile" /></div>
            </div>
          </div>

          {/* What you teach */}
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4><Icon.cap size={14} /> &nbsp;What you teach</h4>

            {cats.length > 0 && (
              <div className="sk-field">
                <label>Subjects <span style={{ fontWeight: 500, color: "#9aa9af" }}>— pick every subject you teach</span></label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {cats.map((c) => {
                    const slug = c.slug || c.id;
                    const on = (f.categories || []).includes(slug);
                    return (
                      <button key={slug} type="button"
                        onClick={() => {
                          setSaved(false);
                          setF((prev) => {
                            const cur = prev.categories || [];
                            const next = on ? cur.filter((x) => x !== slug) : [...cur, slug];
                            return { ...prev, categories: next, category: next[0] || "" };
                          });
                        }}
                        style={{
                          fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: 100,
                          cursor: "pointer", transition: "all .15s",
                          border: on ? "1.5px solid var(--skill-ink)" : "1.5px solid #e3dccf",
                          background: on ? "#e7f3f4" : "#fff",
                          color: on ? "var(--skill-ink)" : "#6b7c83",
                        }}>
                        {on ? "✓ " : ""}{c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="sk-field">
              <label>{cats.length > 0 ? "Describe what you offer" : "Subject / what you offer"}</label>
              <textarea className="sk-input" rows={3} value={f.subject_description}
                        onChange={set("subject_description")}
                        placeholder="e.g. Hindustani vocal for beginners to intermediate" />
            </div>
            <div className="sk-field">
              <label>About you</label>
              <textarea className="sk-input" rows={3} value={f.bio} onChange={set("bio")}
                        placeholder="A short intro learners will read on your profile" />
            </div>
            <div className="sk-field">
              <label>Languages (comma-separated)</label>
              <input className="sk-input" value={f.languages} onChange={set("languages")} placeholder="English, Hindi, Manipuri" />
            </div>
            <div className="sk-field"><label>Availability note</label>
              <input className="sk-input" value={f.availability} onChange={set("availability")} placeholder="e.g. Evenings & weekends" /></div>
          </div>
        </div>

        {/* ── Column 2: Location ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>Where you teach</h4>
            <div className="sk-field">
              <label>Class mode</label>
              <div className="sk-seg">
                {MODES.map((m) => (
                  <button key={m.v} className={f.class_mode === m.v ? "on" : ""}
                          onClick={() => { setSaved(false); setF((p) => ({ ...p, class_mode: m.v })); }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {offline && (
              <>
                <div className="sk-field">
                  <label>Class location <span style={{ color: "#c0492f" }}>*</span></label>
                  <input className="sk-input" value={f.class_location} onChange={set("class_location")}
                         placeholder="Area / landmark where the class is held" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="sk-field"><label>Pincode</label>
                    <input className="sk-input" value={f.pincode} onChange={set("pincode")} /></div>
                  <div className="sk-field"><label>City</label>
                    <input className="sk-input" value={f.city} onChange={set("city")} /></div>
                  <div className="sk-field"><label>District</label>
                    <input className="sk-input" value={f.district} onChange={set("district")} /></div>
                  <div className="sk-field"><label>State</label>
                    <input className="sk-input" value={f.state} onChange={set("state")} /></div>
                </div>
                <div style={{ fontSize: 11.5, color: "#9aa9af", lineHeight: 1.5 }}>
                  Nearby learners searching for offline lessons will find you by pincode / district / state.
                </div>
              </>
            )}
            {!offline && (
              <div style={{ fontSize: 11.5, color: "#9aa9af", lineHeight: 1.5 }}>
                Online classes are held over video — no address needed.
              </div>
            )}
          </div>
        </div>
      </div>

      {err && <div style={{ color: "#c0492f", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{err}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button className="sk-btn" onClick={save} disabled={saving}>
          <Icon.check size={14} /> {saving ? "Saving…" : (complete ? "Save profile" : "Save progress")}
        </button>
        {saved && <span style={{ color: "#2f9d42", fontSize: 12.5, fontWeight: 700 }}>Saved ✓</span>}
      </div>
    </div>
  );
}
