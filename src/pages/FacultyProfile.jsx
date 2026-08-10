/**
 * FacultyProfile — the ONE place an Academy (Faculty) teacher views and edits
 * their teaching identity. Replaces the old Profile.jsx + PrivateDetails.jsx
 * split (both routes now land here; /teacher/private-details redirects).
 *
 * Data
 * ────
 *   GET  /accounts/teacher/profile/   display data: name, photo, rating,
 *                                     subjects, active courses, bio
 *   GET  /accounts/form-fillup/       RAW field values for every editable
 *                                     field + verification document URLs
 *   PATCH /accounts/teacher/profile/  saves — accepts any subset of fields,
 *                                     multipart when files are attached
 *
 * Editing model: each section card has its own Edit → Save/Cancel cycle and
 * PATCHes only its own fields, so a failed save in one section never clobbers
 * another. Verification documents lock read-only once the academy track is
 * approved (compliance: approved credentials can't be silently swapped).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCamera, FiEdit2, FiLock, FiFileText, FiExternalLink, FiX, FiPlus,
} from "react-icons/fi";
import api from "../api/apiClient";
import { useAuth } from "../contexts/AuthContext";
import { LoadingState } from "../components/StateViews";
import "../styles/faculty-profile.css";

/* ── choice catalogues (mirror accounts.models.TeacherProfile) ── */
const DEGREES = [
  ["10th_pass", "10th Pass"], ["12th_pass", "12th Pass"], ["diploma", "Diploma"],
  ["bachelors", "Bachelor's Degree"], ["masters", "Master's Degree"],
  ["phd", "Ph.D."], ["other", "Other"],
];
const EXPERIENCE = [
  ["0", "New Teacher (0 years)"], ["lt1", "Less than 1 year"],
  ["1_3", "1–3 years"], ["3_5", "3–5 years"], ["5_10", "5–10 years"],
  ["10plus", "10+ years"],
];
const EMPLOYMENT = [
  ["fulltime", "Full-time teacher at school"], ["parttime", "Part-time teacher"],
  ["private_tutor", "Private tutor"],
  ["unemployed", "Unemployed / looking for opportunities"],
  ["retired", "Retired teacher"],
];
const GOVT_IDS = [
  ["aadhaar", "Aadhaar Card"], ["pan", "PAN Card"],
  ["voter_id", "Voter ID"], ["driving_license", "Driving License"],
];
const GENDERS = [
  ["", "Prefer not to specify"], ["male", "Male"], ["female", "Female"],
  ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"],
];
const CERT_SUGGESTIONS = ["B.Ed", "M.Ed", "CTET", "State TET"];

const label = (catalogue, value) =>
  catalogue.find(([v]) => v === value)?.[1] || value || "—";

const fileName = (url) => {
  if (!url || typeof url !== "string") return null;
  try { return decodeURIComponent(url.split("/").pop().split("?")[0]); }
  catch { return url.split("/").pop(); }
};

/* ── tiny building blocks ── */

function StatusChip({ status }) {
  const map = {
    approved: ["fp-chip--ok", "Approved faculty"],
    pending:  ["fp-chip--wait", "Under review"],
    rejected: ["fp-chip--bad", "Application rejected"],
  };
  const [cls, text] = map[status] || ["fp-chip--wait", "Not applied"];
  return <span className={`fp-chip ${cls}`}>{text}</span>;
}

function Field({ name, children }) {
  return (
    <div className="fp-field">
      <span className="fp-field__label">{name}</span>
      {children}
    </div>
  );
}

/* Read-only value line inside a section that isn't in edit mode. */
function ValueRow({ name, value }) {
  return (
    <div className="fp-vrow">
      <span className="fp-vrow__label">{name}</span>
      <span className={`fp-vrow__value ${!value || value === "—" ? "fp-vrow__value--empty" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

/* Existing-document row: filename + view link (locked sections show these). */
function DocRow({ name, url }) {
  return (
    <div className="fp-doc">
      <FiFileText className="fp-doc__icon" />
      <div className="fp-doc__meta">
        <span className="fp-doc__name">{name}</span>
        <span className="fp-doc__file">{fileName(url) || "Not uploaded"}</span>
      </div>
      {url && (
        <a className="fp-doc__view" href={url} target="_blank" rel="noreferrer">
          View <FiExternalLink />
        </a>
      )}
    </div>
  );
}

/* Section card shell with its own Edit / Save / Cancel lifecycle. */
function Section({ title, hint, locked, editing, onEdit, onCancel, onSave, saving, error, children }) {
  return (
    <section className="fp-card">
      <header className="fp-card__head">
        <div>
          <h2 className="fp-card__title">{title}</h2>
          {hint && <p className="fp-card__hint">{hint}</p>}
        </div>
        {locked ? (
          <span className="fp-lockmark"><FiLock /> Locked</span>
        ) : !editing ? (
          <button type="button" className="fp-btn fp-btn--ghost" onClick={onEdit}>
            <FiEdit2 /> Edit
          </button>
        ) : null}
      </header>

      <div className="fp-card__body">{children}</div>

      {editing && (
        <footer className="fp-card__foot">
          {error && <span className="fp-inline-err">{error}</span>}
          <button type="button" className="fp-btn fp-btn--ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="fp-btn fp-btn--solid" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      )}
    </section>
  );
}

/* ════════════════════════════════ page ════════════════════════════════ */
export default function FacultyProfile() {
  const navigate = useNavigate();
  const { teacherInfo } = useAuth();

  const [display, setDisplay] = useState(null);  // /accounts/teacher/profile/
  const [raw, setRaw] = useState(null);          // /accounts/form-fillup/
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  /* which section is in edit mode: null | 'about' | 'quals' | 'exp' | 'personal' | 'docs' */
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [certDraft, setCertDraft] = useState("");

  const [photoPreview, setPhotoPreview] = useState(null);
  const photoRef = useRef(null);

  const academyStatus =
    teacherInfo?.tracks?.academy ||
    (display?.is_approved ? "approved" : "pending");
  const docsLocked = academyStatus === "approved";

  const load = async () => {
    try {
      const [d, r] = await Promise.all([
        api.get("/accounts/teacher/profile/"),
        api.get("/accounts/form-fillup/"),
      ]);
      setDisplay(d.data);
      setRaw(r.data);
    } catch (e) {
      console.error(e);
      setLoadError("Couldn't load your faculty profile. Please refresh.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const beginEdit = (section, fields) => {
    setForm(fields);
    setFiles({});
    setSaveError("");
    setCertDraft("");
    setEditing(section);
  };

  const cancelEdit = () => {
    setEditing(null); setForm({}); setFiles({}); setSaveError("");
  };

  const saveSection = async () => {
    setSaving(true); setSaveError("");
    try {
      const hasFiles = Object.keys(files).length > 0;
      let payload = form;
      if (hasFiles) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v ?? "");
        });
        Object.entries(files).forEach(([k, f]) => fd.append(k, f));
        payload = fd;
      }
      const res = await api.patch("/accounts/teacher/profile/", payload,
        hasFiles ? { headers: { "Content-Type": "multipart/form-data" } } : undefined);
      setDisplay(res.data);
      // Raw values changed server-side (files get new URLs) — refetch them.
      const r = await api.get("/accounts/form-fillup/");
      setRaw(r.data);
      cancelEdit();
    } catch (e) {
      console.error("Faculty profile save failed:", e);
      const d = e?.response?.data;
      setSaveError(
        typeof d === "string" ? d
          : Object.values(d || {}).flat().join(" ") || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  /* Photo saves immediately on pick — it's the one edit that shouldn't need
     entering a section first. */
  const onPickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPhotoPreview(URL.createObjectURL(f));
    try {
      const fd = new FormData();
      fd.append("photo", f);
      const res = await api.patch("/accounts/teacher/profile/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDisplay(res.data);
      if (res.data?.photo) {
        window.dispatchEvent(new CustomEvent("avatar-updated", { detail: res.data.photo }));
      }
    } catch (err) {
      console.error("Photo upload failed:", err);
      setPhotoPreview(null);
    }
  };

  if (loading) return <LoadingState label="Loading faculty profile" />;
  if (loadError || !display || !raw) {
    return <div className="fp-page"><p className="fp-load-err">{loadError || "Profile not found."}</p></div>;
  }

  /* ── profile completeness (drives the rail meter) ── */
  const completenessChecks = [
    display.photo, display.bio,
    raw.highest_degree, raw.field_of_study,
    raw.experience_range, raw.employment_status,
    raw.first_name, raw.phone, raw.date_of_birth, raw.state,
    raw.govt_id_type, raw.id_proof_front, raw.qualification_certificate,
  ];
  const completeness = Math.round(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  const certs = raw.teaching_certifications || [];
  const subjects = [...new Set((display.subjects || []).map((s) => s.name))];

  return (
    <div className="fp-page">
      <header className="fp-pagehead">
        <div>
          <h1 className="fp-pagehead__title">Faculty profile</h1>
          <p className="fp-pagehead__sub">
            How you appear to students and admins on the Academy track.
          </p>
        </div>
        <StatusChip status={academyStatus} />
      </header>

      <div className="fp-grid">
        {/* ══ identity rail ══ */}
        <aside className="fp-rail">
          <div className="fp-idcard">
            <div className="fp-idcard__photo">
              {(photoPreview || display.photo)
                ? <img src={photoPreview || display.photo} alt={display.name || "Faculty"} />
                : <span className="fp-idcard__initial">{(display.name || "T").charAt(0)}</span>}
              <button type="button" className="fp-idcard__cam"
                title="Change photo" onClick={() => photoRef.current?.click()}>
                <FiCamera />
              </button>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            </div>
            <div className="fp-idcard__name">{display.name || "Unnamed faculty"}</div>
            <div className="fp-idcard__role">Faculty · Academy</div>
            {display.rating != null && (
              <div className="fp-idcard__rating">★ {Number(display.rating).toFixed(1)}</div>
            )}

            {subjects.length > 0 && (
              <div className="fp-idcard__tags">
                {subjects.map((s) => <span key={s} className="fp-tag">{s}</span>)}
              </div>
            )}

            <div className="fp-meter">
              <div className="fp-meter__head">
                <span>Profile completeness</span><b>{completeness}%</b>
              </div>
              <div className="fp-meter__track">
                <div className="fp-meter__fill" style={{ width: `${completeness}%` }} />
              </div>
              {completeness < 100 && (
                <p className="fp-meter__hint">
                  Complete profiles are prioritised in student-facing listings.
                </p>
              )}
            </div>

            {(display.active_courses || []).length > 0 && (
              <div className="fp-courses">
                <div className="fp-courses__title">Teaching now</div>
                {display.active_courses.map((c) => (
                  <button key={c.id} type="button" className="fp-courses__item"
                    onClick={() => navigate("/teacher/classes")}>
                    {c.title}
                    <span>{(c.subjects || []).join(" · ")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ══ sections ══ */}
        <div className="fp-main">

          {/* ── About ── */}
          <Section
            title="About"
            hint="Shown on your public teacher card."
            editing={editing === "about"}
            onEdit={() => beginEdit("about", { bio: display.bio || "" })}
            onCancel={cancelEdit} onSave={saveSection}
            saving={saving} error={editing === "about" ? saveError : ""}
          >
            {editing === "about" ? (
              <textarea className="fp-input fp-input--area" rows={4}
                placeholder="Tell students who you are, how you teach, and what they can expect."
                value={form.bio} onChange={(e) => set("bio", e.target.value)} />
            ) : (
              <p className={`fp-bio ${!display.bio ? "fp-bio--empty" : ""}`}>
                {display.bio || "No bio yet — a short introduction helps students pick your classes."}
              </p>
            )}
          </Section>

          {/* ── Your name ── */}
          <Section
            title="Your name"
            hint="Shown on your public teacher card and across this dashboard."
            editing={editing === "name"}
            onEdit={() => beginEdit("name", {
              first_name: raw.first_name || "",
              last_name: raw.last_name || "",
            })}
            onCancel={cancelEdit} onSave={saveSection}
            saving={saving} error={editing === "name" ? saveError : ""}
          >
            {editing === "name" ? (
              <div className="fp-formgrid">
                <Field name="First name">
                  <input className="fp-input" value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)} />
                </Field>
                <Field name="Last name">
                  <input className="fp-input" value={form.last_name}
                    onChange={(e) => set("last_name", e.target.value)} />
                </Field>
              </div>
            ) : (
              <ValueRow name="Name"
                value={[raw.first_name, raw.last_name].filter(Boolean).join(" ")} />
            )}
          </Section>

          {/* ── Qualifications ── */}
          <Section
            title="Qualifications"
            editing={editing === "quals"}
            onEdit={() => beginEdit("quals", {
              highest_degree: raw.highest_degree || "",
              field_of_study: raw.field_of_study || "",
              year_of_completion: raw.year_of_completion || "",
              teaching_certifications: certs,
            })}
            onCancel={cancelEdit} onSave={saveSection}
            saving={saving} error={editing === "quals" ? saveError : ""}
          >
            {editing === "quals" ? (
              <div className="fp-formgrid">
                <Field name="Highest degree">
                  <select className="fp-input" value={form.highest_degree}
                    onChange={(e) => set("highest_degree", e.target.value)}>
                    <option value="">—</option>
                    {DEGREES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field name="Field of study">
                  <input className="fp-input" value={form.field_of_study}
                    placeholder="e.g. Mathematics"
                    onChange={(e) => set("field_of_study", e.target.value)} />
                </Field>
                <Field name="Year of completion">
                  <input className="fp-input" type="number" min="1950" max="2100"
                    value={form.year_of_completion}
                    onChange={(e) => set("year_of_completion", e.target.value)} />
                </Field>
                <Field name="Teaching certifications">
                  <div className="fp-chips">
                    {(form.teaching_certifications || []).map((c) => (
                      <span key={c} className="fp-chipedit">
                        {c}
                        <button type="button" aria-label={`Remove ${c}`}
                          onClick={() => set("teaching_certifications",
                            form.teaching_certifications.filter((x) => x !== c))}>
                          <FiX />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="fp-chipadd">
                    <input className="fp-input" value={certDraft}
                      placeholder="Add certification (e.g. B.Ed)"
                      onChange={(e) => setCertDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && certDraft.trim()) {
                          e.preventDefault();
                          if (!form.teaching_certifications.includes(certDraft.trim()))
                            set("teaching_certifications",
                              [...form.teaching_certifications, certDraft.trim()]);
                          setCertDraft("");
                        }
                      }} />
                    <button type="button" className="fp-btn fp-btn--ghost"
                      disabled={!certDraft.trim()}
                      onClick={() => {
                        if (!form.teaching_certifications.includes(certDraft.trim()))
                          set("teaching_certifications",
                            [...form.teaching_certifications, certDraft.trim()]);
                        setCertDraft("");
                      }}>
                      <FiPlus /> Add
                    </button>
                  </div>
                  <div className="fp-chip-suggest">
                    {CERT_SUGGESTIONS.filter((s) => !(form.teaching_certifications || []).includes(s))
                      .map((s) => (
                        <button key={s} type="button" className="fp-tag fp-tag--btn"
                          onClick={() => set("teaching_certifications",
                            [...form.teaching_certifications, s])}>
                          + {s}
                        </button>
                      ))}
                  </div>
                </Field>
              </div>
            ) : (
              <>
                <ValueRow name="Highest degree" value={label(DEGREES, raw.highest_degree)} />
                <ValueRow name="Field of study" value={raw.field_of_study} />
                <ValueRow name="Year of completion" value={raw.year_of_completion} />
                <ValueRow name="Certifications" value={certs.length ? certs.join(" · ") : ""} />
              </>
            )}
          </Section>

          {/* ── Experience ── */}
          <Section
            title="Teaching experience"
            editing={editing === "exp"}
            onEdit={() => beginEdit("exp", {
              experience_range: raw.experience_range || "",
              employment_status: raw.employment_status || "",
              currently_employed: !!raw.currently_employed,
              current_institution: raw.current_institution || "",
              current_position: raw.current_position || "",
            })}
            onCancel={cancelEdit} onSave={saveSection}
            saving={saving} error={editing === "exp" ? saveError : ""}
          >
            {editing === "exp" ? (
              <div className="fp-formgrid">
                <Field name="Experience">
                  <select className="fp-input" value={form.experience_range}
                    onChange={(e) => set("experience_range", e.target.value)}>
                    <option value="">—</option>
                    {EXPERIENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field name="Employment status">
                  <select className="fp-input" value={form.employment_status}
                    onChange={(e) => set("employment_status", e.target.value)}>
                    <option value="">—</option>
                    {EMPLOYMENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field name="Currently employed?">
                  <label className="fp-check">
                    <input type="checkbox" checked={form.currently_employed}
                      onChange={(e) => set("currently_employed", e.target.checked)} />
                    Yes, I currently teach at an institution
                  </label>
                </Field>
                {form.currently_employed && (
                  <>
                    <Field name="Institution">
                      <input className="fp-input" value={form.current_institution}
                        onChange={(e) => set("current_institution", e.target.value)} />
                    </Field>
                    <Field name="Position">
                      <input className="fp-input" value={form.current_position}
                        placeholder="e.g. PGT Mathematics"
                        onChange={(e) => set("current_position", e.target.value)} />
                    </Field>
                  </>
                )}
              </div>
            ) : (
              <>
                <ValueRow name="Experience" value={label(EXPERIENCE, raw.experience_range)} />
                <ValueRow name="Employment status" value={label(EMPLOYMENT, raw.employment_status)} />
                {raw.currently_employed && (
                  <>
                    <ValueRow name="Institution" value={raw.current_institution} />
                    <ValueRow name="Position" value={raw.current_position} />
                  </>
                )}
              </>
            )}
          </Section>

          {/* ── Personal details ── */}
          <Section
            title="Personal details"
            hint="Private — visible to admins only, never on your public card."
            editing={editing === "personal"}
            onEdit={() => beginEdit("personal", {
              phone: raw.phone || "",
              gender: raw.gender || "",
              date_of_birth: raw.date_of_birth || "",
              state: raw.state || "",
              district: raw.district || "",
              city_town: raw.city_town || "",
              pin_code: raw.pin_code || "",
            })}
            onCancel={cancelEdit} onSave={saveSection}
            saving={saving} error={editing === "personal" ? saveError : ""}
          >
            {editing === "personal" ? (
              <div className="fp-formgrid">
                <Field name="Phone">
                  <input className="fp-input" value={form.phone}
                    onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field name="Date of birth">
                  <input className="fp-input" type="date" value={form.date_of_birth}
                    onChange={(e) => set("date_of_birth", e.target.value)} />
                </Field>
                <Field name="Gender">
                  <select className="fp-input" value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}>
                    {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field name="State">
                  <input className="fp-input" value={form.state}
                    onChange={(e) => set("state", e.target.value)} />
                </Field>
                <Field name="District">
                  <input className="fp-input" value={form.district}
                    onChange={(e) => set("district", e.target.value)} />
                </Field>
                <Field name="City / town">
                  <input className="fp-input" value={form.city_town}
                    onChange={(e) => set("city_town", e.target.value)} />
                </Field>
                <Field name="PIN code">
                  <input className="fp-input" value={form.pin_code}
                    onChange={(e) => set("pin_code", e.target.value)} />
                </Field>
              </div>
            ) : (
              <>
                <ValueRow name="Phone" value={raw.phone} />
                <ValueRow name="Date of birth" value={raw.date_of_birth} />
                <ValueRow name="Gender" value={label(GENDERS, raw.gender)} />
                <ValueRow name="Location"
                  value={[raw.city_town, raw.district, raw.state, raw.pin_code]
                    .filter(Boolean).join(", ")} />
              </>
            )}
          </Section>

          {/* ── Verification documents ── */}
          <Section
            title="Verification documents"
            hint={docsLocked
              ? "Verified with your approved application. Contact the admin team to change these."
              : "Used by the admin team to verify your faculty application."}
            locked={docsLocked}
            editing={editing === "docs"}
            onEdit={() => beginEdit("docs", {
              govt_id_type: raw.govt_id_type || "",
              id_number: raw.id_number || "",
            })}
            onCancel={cancelEdit} onSave={saveSection}
            saving={saving} error={editing === "docs" ? saveError : ""}
          >
            {editing === "docs" && !docsLocked ? (
              <div className="fp-formgrid">
                <Field name="Government ID type">
                  <select className="fp-input" value={form.govt_id_type}
                    onChange={(e) => set("govt_id_type", e.target.value)}>
                    <option value="">—</option>
                    {GOVT_IDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field name="ID number">
                  <input className="fp-input" value={form.id_number}
                    onChange={(e) => set("id_number", e.target.value)} />
                </Field>
                <Field name="ID proof (front)">
                  <input className="fp-input" type="file" accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] &&
                      setFiles((f) => ({ ...f, id_proof_front: e.target.files[0] }))} />
                </Field>
                <Field name="ID proof (back)">
                  <input className="fp-input" type="file" accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] &&
                      setFiles((f) => ({ ...f, id_proof_back: e.target.files[0] }))} />
                </Field>
                <Field name="Qualification certificate">
                  <input className="fp-input" type="file" accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] &&
                      setFiles((f) => ({ ...f, qualification_certificate: e.target.files[0] }))} />
                </Field>
                <Field name="Signed faculty agreement">
                  <input className="fp-input" type="file" accept=".pdf,image/*"
                    onChange={(e) => e.target.files?.[0] &&
                      setFiles((f) => ({ ...f, signed_agreement: e.target.files[0] }))} />
                </Field>
              </div>
            ) : (
              <>
                <ValueRow name="Government ID"
                  value={raw.govt_id_type
                    ? `${label(GOVT_IDS, raw.govt_id_type)}${raw.id_number ? ` · ${raw.id_number}` : ""}`
                    : ""} />
                <div className="fp-doclist">
                  <DocRow name="ID proof (front)" url={raw.id_proof_front} />
                  <DocRow name="ID proof (back)" url={raw.id_proof_back} />
                  <DocRow name="Qualification certificate" url={raw.qualification_certificate} />
                  <DocRow name="Signed faculty agreement" url={raw.signed_agreement} />
                </div>
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
