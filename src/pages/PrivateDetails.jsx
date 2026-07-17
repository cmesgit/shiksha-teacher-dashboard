import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiLock, FiCalendar, FiFileText, FiChevronDown, FiX } from "react-icons/fi";
import api from "../api/apiClient";
import "../styles/private-details.css";
import { LoadingState } from "../components/StateViews";

/* ────────────────────────────────────────────────────────────
   VALUE FORMATTERS
   ──────────────────────────────────────────────────────────── */

function formatDob(dob) {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function getFileName(url) {
  if (!url || typeof url !== "string") return null;
  return decodeURIComponent(url.split("/").pop());
}

function titleCase(s) {
  if (!s || typeof s !== "string") return s;
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatExperienceRange(v) {
  if (!v) return v;
  const known = {
    "0": "New Teacher (0 years)", "new": "New Teacher (0 years)",
    "1_2": "1-2 years", "1-2": "1-2 years",
    "1_3": "1-3 years", "1-3": "1-3 years",
    "3_5": "3-5 years", "3-5": "3-5 years",
    "6_10": "6-10 years", "6-10": "6-10 years",
    "10_plus": "10+ years", "10+": "10+ years",
  };
  if (known[v]) return known[v];
  if (/^\d+_\d+$/.test(v)) return v.replace("_", "-") + " years";
  return v;
}

function formatEmploymentStatus(v) {
  if (!v) return v;
  const known = {
    "fulltime": "Full-time", "full_time": "Full-time", "full-time": "Full-time",
    "parttime": "Part-time", "part_time": "Part-time", "part-time": "Part-time",
    "freelance": "Freelance / Independent",
    "unemployed": "Unemployed / Looking for opportunities",
    "looking": "Unemployed / Looking for opportunities",
  };
  return known[v?.toLowerCase()] || titleCase(v);
}

function formatGovtId(v) {
  if (!v) return v;
  const known = {
    "aadhaar": "Aadhar Card", "aadhar": "Aadhar Card",
    "voter_id": "Voter's ID", "voters_id": "Voter's ID", "voter": "Voter's ID",
    "pan": "PAN Card", "pan_card": "PAN Card", "passport": "Passport",
    "driving_license": "Driving License", "dl": "Driving License",
  };
  return known[v?.toLowerCase()] || titleCase(v);
}

function formatCert(v) {
  if (!v) return v;
  const known = {
    "bed": "B.Ed", "b.ed": "B.Ed", "med": "M.Ed", "m.ed": "M.Ed",
    "ctet": "CTET", "state_tet": "State TET",
    "statetet": "State TET", "tet": "State TET",
  };
  return known[v?.toLowerCase()] || v.toUpperCase();
}

function formatBoard(v) {
  if (!v) return v;
  return String(v).toUpperCase();
}

function formatClass(v) {
  if (!v) return v;
  const s = String(v).replace(/class[_\s-]?/i, "").trim();
  if (/^\d+$/.test(s)) return `Class ${s}`;
  return v;
}

function FileDisplay({ file, size }) {
  const name = getFileName(file);
  if (!name) return <div className="pd-value pd-value--muted">—</div>;
  return (
    <div className="pd-file-item">
      <FiFileText className="pd-file-svg" />
      <span className="pd-file-name">{name}</span>
      {size && <span className="pd-file-size">({size})</span>}
    </div>
  );
}

function CheckList({ items, formatter }) {
  if (!items || items.length === 0)
    return <div className="pd-value pd-value--muted">—</div>;
  return (
    <div className="pd-checks-row">
      {items.map((item) => (
        <label key={item} className="pd-check-item">
          <input type="checkbox" checked readOnly className="pd-checkbox" />
          <span>{formatter ? formatter(item) : item}</span>
        </label>
      ))}
    </div>
  );
}

const DEGREE_OPTIONS = [
  "High School / Secondary", "Diploma", "Bachelor's Degree",
  "Master's Degree", "PhD / Doctorate", "Other",
];
const CERT_OPTIONS = ["B.Ed", "M.Ed", "CTET", "State TET", "Other"];
const EXPERIENCE_OPTIONS = [
  "New Teacher (0 years)", "1-2 years", "3-5 years", "6-10 years", "10+ years",
];
const EMPLOYMENT_STATUS_OPTIONS = [
  "Unemployed/Looking for opportunities", "Employed Full-time",
  "Employed Part-time", "Freelance/Independent", "Other",
];
const GOVT_ID_OPTIONS = [
  "Aadhar Card", "Voter's ID", "PAN Card", "Passport", "Driving License", "Other",
];
const RELATED_SUBJECT_OPTIONS = [
  "Mathematics", "Science", "Physics", "Chemistry", "Biology",
  "English", "Social Studies", "History", "Geography",
  "Computer Science", "Arts", "Music", "Physical Education", "Others",
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: currentYear - 1950 + 1 },
  (_, i) => currentYear - i
);

export default function PrivateDetails() {
  const navigate = useNavigate();
  const qualFileInputRef = useRef(null);
  const skillFileInputRef = useRef(null);
  const activeSkillFileIdx = useRef(null);
  const idFileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editState, setEditState] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPinCode, setEditPinCode] = useState("");
  const [editExperienceRange, setEditExperienceRange] = useState("");
  const [editEmploymentStatus, setEditEmploymentStatus] = useState("");
  const [editIsCurrentlyEmployed, setEditIsCurrentlyEmployed] = useState(false);
  const [editInstitutionName, setEditInstitutionName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editGovtIdType, setEditGovtIdType] = useState("");
  const [editIdNumber, setEditIdNumber] = useState("");
  const [editIdFile, setEditIdFile] = useState(null);
  const [editIdFileRemoved, setEditIdFileRemoved] = useState(false);
  const [editSkills, setEditSkills] = useState([]);
  const [editHighestDegree, setEditHighestDegree] = useState("");
  const [editFieldOfStudy, setEditFieldOfStudy] = useState("");
  const [editYearOfCompletion, setEditYearOfCompletion] = useState("");
  const [editTeachingCerts, setEditTeachingCerts] = useState([]);
  const [editQualFile, setEditQualFile] = useState(null);
  const [editQualFileRemoved, setEditQualFileRemoved] = useState(false);

  const populateEditFields = (p) => {
    setEditFirstName(p.first_name || "");
    setEditLastName(p.last_name || "");
    setEditPhone(p.phone || p.phone_number || "");
    setEditDob(p.date_of_birth || p.dob || "");
    setEditGender(p.gender || "");
    setEditState(p.state || "");
    setEditDistrict(p.district || "");
    setEditCity(p.city || "");
    setEditPinCode(p.pin_code || "");
    setEditExperienceRange(p.experience_range || "");
    setEditEmploymentStatus(p.employment_status || "");
    setEditIsCurrentlyEmployed(p.is_currently_employed || false);
    setEditInstitutionName(p.institution_name || "");
    setEditPosition(p.position || "");
    setEditHighestDegree(p.highest_degree || "");
    setEditFieldOfStudy(p.field_of_study || "");
    setEditYearOfCompletion(p.year_of_completion || "");
    setEditTeachingCerts(p.teaching_certifications || []);
    setEditQualFile(null);
    setEditQualFileRemoved(false);
    setEditGovtIdType(p.government_id_type || "");
    setEditIdNumber(p.id_number || "");
    setEditIdFile(null);
    setEditIdFileRemoved(false);
    setEditSkills(
      (p.skill_applications || []).map((s) => ({
        skill_description: s.skill_description || s.description || "",
        related_subject: s.related_subject || "",
        newFile: null,
        fileRemoved: false,
      }))
    );
  };

  useEffect(() => {
    Promise.all([
      api.get("/accounts/teacher/profile/"),
      api.get("/accounts/form-fillup/"),
    ])
      .then(([profRes, formRes]) => {
        const p = profRes.data;
        const f = formRes.data;
        const courseApp = f.course_applications?.[0] || {};
        const merged = {
          name: p.name, photo: p.photo, is_approved: p.is_approved,
          languages: p.languages, spoken_languages: p.spoken_languages,
          username: f.username, email: f.email,
          first_name: f.first_name, last_name: f.last_name,
          phone: f.phone, date_of_birth: f.date_of_birth, gender: f.gender,
          state: f.state, district: f.district, city: f.city_town, pin_code: f.pin_code,
          highest_degree: f.highest_degree, field_of_study: f.field_of_study,
          year_of_completion: f.year_of_completion,
          teaching_certifications: f.teaching_certifications,
          qualification_certificate: f.qualification_certificate,
          experience_range: f.experience_range,
          employment_status: f.employment_status,
          is_currently_employed: f.currently_employed,
          institution_name: f.current_institution,
          position: f.current_position,
          government_id_type: f.govt_id_type, id_number: f.id_number,
          id_document: f.id_proof_front || f.id_proof_back,
          subject: courseApp.subject, boards: courseApp.boards, classes: courseApp.classes,
          skill_applications: p.skill_applications || f.skill_applications || [],
        };
        setProfile(merged);
        populateEditFields(merged);
      })
      .catch(() => setError("Failed to load private details."))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = () => {
    if (profile) populateEditFields(profile);
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (profile) populateEditFields(profile);
    setIsEditing(false);
  };

  const updateSkillField = (idx, field, value) => {
    setEditSkills((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const handleSkillFileClick = (idx) => {
    activeSkillFileIdx.current = idx;
    skillFileInputRef.current?.click();
  };

  const handleIdFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setEditIdFile(file);
    e.target.value = "";
  };

  const handleSkillFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && activeSkillFileIdx.current !== null) {
      updateSkillField(activeSkillFileIdx.current, "newFile", file);
    }
    e.target.value = "";
    activeSkillFileIdx.current = null;
  };

  const toggleCert = (cert) => {
    setEditTeachingCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const handleQualFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setEditQualFile(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = {
      first_name: editFirstName, last_name: editLastName,
      phone: editPhone, date_of_birth: editDob, gender: editGender,
      state: editState, district: editDistrict,
      city_town: editCity, pin_code: editPinCode,
      experience_range: editExperienceRange,
      employment_status: editEmploymentStatus,
      currently_employed: editIsCurrentlyEmployed,
      current_institution: editInstitutionName,
      current_position: editPosition,
      highest_degree: editHighestDegree,
      field_of_study: editFieldOfStudy,
      year_of_completion: editYearOfCompletion,
      teaching_certifications: editTeachingCerts,
      govt_id_type: editGovtIdType, id_number: editIdNumber,
    };
    try {
      await api.patch("/accounts/teacher/profile/", updates);
      setProfile((prev) => ({ ...prev, ...updates }));

      if (editQualFile) {
        const formData = new FormData();
        formData.append("qualification_certificate", editQualFile);
        const res = await api.patch("/accounts/teacher/profile/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setProfile(res.data);
      } else if (editQualFileRemoved) {
        const res = await api.patch("/accounts/teacher/profile/", {
          qualification_certificate: null,
        });
        setProfile(res.data);
      }

      if (editIdFile) {
        const fd = new FormData();
        fd.append("id_proof_front", editIdFile);
        const res = await api.patch("/accounts/teacher/profile/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setProfile(res.data);
      } else if (editIdFileRemoved) {
        const res = await api.patch("/accounts/teacher/profile/", { id_proof_front: null });
        setProfile(res.data);
      }

      for (let idx = 0; idx < editSkills.length; idx++) {
        const es = editSkills[idx];
        const skillId = profile.skill_applications?.[idx]?.id;
        if (es.newFile && skillId) {
          const fd = new FormData();
          fd.append("skill_file", es.newFile);
          await api.patch(`/accounts/teacher/skill/${skillId}/`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      }
    } catch (err) {
      console.error("Failed to save private details:", err);
    }
    setSaving(false);
    setIsEditing(false);
  };

  if (loading) {
    return <LoadingState label="Loading your details" />;
  }

  if (error || !profile) {
    return <div className="pd-page"><p className="pd-error">{error || "Profile not found."}</p></div>;
  }

  const prefix =
    profile.gender === "female" ? "Miss" :
    profile.gender === "male" ? "Mr." : "";
  const displayName = prefix ? `${prefix} ${profile.name}` : (profile.name || "Teacher");

  const languages =
    profile.languages?.join(", ") ||
    profile.spoken_languages?.join(", ") ||
    "";

  const phone = profile.phone || profile.phone_number || "";
  const dob = profile.date_of_birth || profile.dob || "";
  const gender = profile.gender
    ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
    : "";

  const skills = profile.skill_applications || [];
  const existingQualFile = !editQualFileRemoved
    ? (profile.qualification_certificate || null)
    : null;

  return (
    <div className="pd-page">

      {/* ===== TOP CARD (uses pd-top-* — self-contained, no profile.css dep) ===== */}
      <div className="pd-top-card">
        <div className="pd-top-left">
          <div className="pd-top-avatar">
            {profile.photo
              ? <img src={profile.photo} alt={profile.name} />
              : <span className="pd-top-avatar-placeholder">{profile.name?.charAt(0) || "T"}</span>
            }
          </div>
          <div className="pd-top-info">
            <h1 className="pd-top-name">{displayName}</h1>
            <div className="pd-top-pills">
              {profile.is_approved && (
                <span className="pd-top-pill pd-top-pill--available">
                  <span className="pd-top-pill-dot" />
                  Available
                </span>
              )}
              {languages && (
                <span className="pd-top-pill pd-top-pill--lang">{languages}</span>
              )}
            </div>
          </div>
        </div>

        <div className="pd-top-actions">
          {isEditing ? (
            <>
              <button className="pd-top-btn" onClick={handleCancel} disabled={saving}>Cancel</button>
              <button className="pd-top-btn" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button className="pd-top-btn" onClick={() => navigate("/teacher/profile")}>Back</button>
              <button className="pd-top-btn" onClick={handleEdit}>Edit Profile</button>
            </>
          )}
        </div>
      </div>

      {/* ===== DETAILS CONTENT ===== */}
      <div className="pd-content">

        {/* Basic Details */}
        <div className="pd-section">
          <h2 className="pd-section-title">Basic Details</h2>
          <div className="pd-grid">
            <div className="pd-field pd-full-width">
              <label className="pd-label">Username</label>
              <div className="pd-value pd-value--muted">{profile.username || "—"}</div>
            </div>
            <div className="pd-field">
              <label className="pd-label">First Name</label>
              {isEditing ? (
                <input className="pd-input" value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)} placeholder="First name" />
              ) : (
                <div className="pd-value">{profile.first_name || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">Last Name</label>
              {isEditing ? (
                <input className="pd-input" value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)} placeholder="Last name" />
              ) : (
                <div className="pd-value">{profile.last_name || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">Email</label>
              <div className="pd-value-row">
                <span className="pd-value-text">{profile.email || "—"}</span>
                <FiLock className="pd-field-icon" />
              </div>
            </div>
            <div className="pd-field">
              <label className="pd-label">Phone Number</label>
              {isEditing ? (
                <input className="pd-input" value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone number" />
              ) : (
                <div className="pd-value">{phone || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">Date of Birth</label>
              {isEditing ? (
                <input className="pd-input" type="date" value={editDob}
                  onChange={(e) => setEditDob(e.target.value)} />
              ) : (
                <div className="pd-value-row">
                  <span className="pd-value-text">{formatDob(dob) || "—"}</span>
                  <FiCalendar className="pd-field-icon" />
                </div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">Gender</label>
              {isEditing ? (
                <select className="pd-input" value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <div className="pd-value">{gender || "—"}</div>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="pd-section">
          <h2 className="pd-section-title">Address</h2>
          <div className="pd-grid">
            <div className="pd-field">
              <label className="pd-label">State</label>
              {isEditing ? (
                <input className="pd-input" value={editState}
                  onChange={(e) => setEditState(e.target.value)} placeholder="State" />
              ) : (
                <div className="pd-value">{titleCase(profile.state) || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">District</label>
              {isEditing ? (
                <input className="pd-input" value={editDistrict}
                  onChange={(e) => setEditDistrict(e.target.value)} placeholder="District" />
              ) : (
                <div className="pd-value">{titleCase(profile.district) || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">City</label>
              {isEditing ? (
                <input className="pd-input" value={editCity}
                  onChange={(e) => setEditCity(e.target.value)} placeholder="City" />
              ) : (
                <div className="pd-value">{titleCase(profile.city) || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">Pin Code</label>
              {isEditing ? (
                <input className="pd-input" value={editPinCode}
                  onChange={(e) => setEditPinCode(e.target.value)} placeholder="Pin code" />
              ) : (
                <div className="pd-value">{profile.pin_code || "—"}</div>
              )}
            </div>
          </div>
        </div>

        {/* Educational Qualifications */}
        <div className="pd-section">
          <h2 className="pd-section-title">Educational Qualifications</h2>
          <div className="pd-grid">
            <div className="pd-field">
              <label className="pd-label">Highest Degree</label>
              {isEditing ? (
                <div className="pd-select-wrap">
                  <select className="pd-input pd-select" value={editHighestDegree}
                    onChange={(e) => setEditHighestDegree(e.target.value)}>
                    <option value="">Select degree</option>
                    {DEGREE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <FiChevronDown className="pd-select-icon" />
                </div>
              ) : (
                <div className="pd-value">{profile.highest_degree || "—"}</div>
              )}
            </div>
            <div className="pd-field" />
            <div className="pd-field">
              <label className="pd-label">Field of Study</label>
              {isEditing ? (
                <div className="pd-input-wrap">
                  <input className="pd-input pd-input-clearable" value={editFieldOfStudy}
                    onChange={(e) => setEditFieldOfStudy(e.target.value)}
                    placeholder="e.g. Civil Engineering" />
                  {editFieldOfStudy && (
                    <button className="pd-input-clear-btn"
                      onClick={() => setEditFieldOfStudy("")} type="button">
                      <FiX />
                    </button>
                  )}
                </div>
              ) : (
                <div className="pd-value">{titleCase(profile.field_of_study) || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">Year of Completion</label>
              {isEditing ? (
                <div className="pd-select-wrap">
                  <select className="pd-input pd-select" value={editYearOfCompletion}
                    onChange={(e) => setEditYearOfCompletion(e.target.value)}>
                    <option value="">Select year</option>
                    {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <FiChevronDown className="pd-select-icon" />
                </div>
              ) : (
                <div className="pd-value">{profile.year_of_completion || "—"}</div>
              )}
            </div>
            <div className="pd-field pd-full-width">
              <label className="pd-label">Teaching Certificate</label>
              {isEditing ? (
                <div className="pd-cert-options">
                  {CERT_OPTIONS.map((cert) => (
                    <label key={cert} className="pd-cert-option">
                      <input type="checkbox" className="pd-cert-checkbox"
                        checked={editTeachingCerts.includes(cert)}
                        onChange={() => toggleCert(cert)} />
                      <span>{cert}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <CheckList items={profile.teaching_certifications} formatter={formatCert} />
              )}
            </div>
            <div className="pd-field pd-full-width">
              <label className="pd-label">Upload Qualification Certificate</label>
              {isEditing ? (
                <div className="pd-file-edit-list">
                  {existingQualFile && !editQualFile && (
                    <div className="pd-file-edit-item">
                      <FiFileText className="pd-file-svg" />
                      <span className="pd-file-name">{getFileName(existingQualFile)}</span>
                      <button className="pd-file-remove-btn" type="button"
                        onClick={() => setEditQualFileRemoved(true)}>
                        <FiX />
                      </button>
                    </div>
                  )}
                  {editQualFile && (
                    <div className="pd-file-edit-item">
                      <FiFileText className="pd-file-svg" />
                      <span className="pd-file-name">{editQualFile.name}</span>
                      <span className="pd-file-size">
                        ({(editQualFile.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                      <button className="pd-file-remove-btn" type="button"
                        onClick={() => setEditQualFile(null)}>
                        <FiX />
                      </button>
                    </div>
                  )}
                  {!editQualFile && (
                    <div className="pd-file-add-btn"
                      onClick={() => qualFileInputRef.current?.click()}>
                      <FiFileText className="pd-file-svg" />
                      <span>[ + Add file ]</span>
                      <span className="pd-file-add-note">(Max 50 MB)</span>
                    </div>
                  )}
                  <input ref={qualFileInputRef} type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    style={{ display: "none" }} onChange={handleQualFileChange} />
                </div>
              ) : (
                <FileDisplay file={profile.qualification_certificate} />
              )}
            </div>
          </div>
        </div>

        {/* Teaching Experience */}
        <div className="pd-section">
          <h2 className="pd-section-title">Teaching Experience</h2>
          <div className="pd-grid">
            <div className="pd-field">
              <label className="pd-label">Years of Teaching Experience</label>
              {isEditing ? (
                <div className="pd-select-wrap">
                  <select className="pd-input pd-select" value={editExperienceRange}
                    onChange={(e) => setEditExperienceRange(e.target.value)}>
                    <option value="">Select experience</option>
                    {EXPERIENCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <FiChevronDown className="pd-select-icon" />
                </div>
              ) : (
                <div className="pd-value">{formatExperienceRange(profile.experience_range) || "—"}</div>
              )}
            </div>
            <div className="pd-field">
              <label className="pd-label">Current Employment Status</label>
              {isEditing ? (
                <div className="pd-select-wrap">
                  <select className="pd-input pd-select" value={editEmploymentStatus}
                    onChange={(e) => setEditEmploymentStatus(e.target.value)}>
                    <option value="">Select status</option>
                    {EMPLOYMENT_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <FiChevronDown className="pd-select-icon" />
                </div>
              ) : (
                <div className="pd-value">{formatEmploymentStatus(profile.employment_status) || "—"}</div>
              )}
            </div>
          </div>
        </div>

        {/* Currently Employed */}
        <div className="pd-section">
          <h2 className="pd-section-title">Currently Employed?</h2>
          <div className="pd-grid">
            <div className="pd-field pd-full-width">
              {isEditing ? (
                <div className="pd-yn-row">
                  <button type="button"
                    className={`pd-yn-btn ${editIsCurrentlyEmployed ? "pd-yn-btn--active" : ""}`}
                    onClick={() => setEditIsCurrentlyEmployed(true)}>Yes</button>
                  <button type="button"
                    className={`pd-yn-btn ${!editIsCurrentlyEmployed ? "pd-yn-btn--active" : ""}`}
                    onClick={() => setEditIsCurrentlyEmployed(false)}>No</button>
                </div>
              ) : (
                <div className="pd-yn-row">
                  <span className={`pd-yn-btn ${profile.is_currently_employed ? "pd-yn-btn--active" : ""}`}>Yes</span>
                  <span className={`pd-yn-btn ${!profile.is_currently_employed ? "pd-yn-btn--active" : ""}`}>No</span>
                </div>
              )}
            </div>
            {(isEditing ? editIsCurrentlyEmployed : profile.is_currently_employed) && (
              <>
                <div className="pd-field">
                  <label className="pd-label">School/Institution Name</label>
                  {isEditing ? (
                    <input className="pd-input" value={editInstitutionName}
                      onChange={(e) => setEditInstitutionName(e.target.value)}
                      placeholder="School or institution name" />
                  ) : (
                    <div className="pd-value">{profile.institution_name || "—"}</div>
                  )}
                </div>
                <div className="pd-field">
                  <label className="pd-label">Position/Role</label>
                  {isEditing ? (
                    <input className="pd-input" value={editPosition}
                      onChange={(e) => setEditPosition(e.target.value)}
                      placeholder="e.g. Math Teacher" />
                  ) : (
                    <div className="pd-value">{titleCase(profile.position) || "—"}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Course Application */}
        <div className="pd-section">
          <h2 className="pd-section-title">
            Course Application <FiLock className="pd-title-lock" />
          </h2>
          <div className="pd-grid">
            <div className="pd-field pd-full-width">
              <label className="pd-label">Subject</label>
              <div className="pd-value">{titleCase(profile.subject) || "—"}</div>
            </div>
            <div className="pd-field pd-full-width">
              <label className="pd-label">Boards</label>
              <CheckList items={profile.boards} formatter={formatBoard} />
            </div>
            <div className="pd-field pd-full-width">
              <label className="pd-label">Classes</label>
              <CheckList items={profile.classes} formatter={formatClass} />
            </div>
          </div>
        </div>

        {/* Specialized Skill */}
        <div className="pd-section">
          <h2 className="pd-section-title">Specialized Skill</h2>
          {skills.length === 0 ? (
            <div className="pd-grid">
              <div className="pd-field"><label className="pd-label">Skill Name</label><div className="pd-value pd-value--muted">—</div></div>
              <div className="pd-field" />
              <div className="pd-field pd-full-width"><label className="pd-label">Skill Description</label><div className="pd-value pd-value--muted">—</div></div>
              <div className="pd-field"><label className="pd-label">Related Subject</label><div className="pd-value pd-value--muted">—</div></div>
              <div className="pd-field" />
              <div className="pd-field pd-full-width"><label className="pd-label">File Related to Skill</label><div className="pd-value pd-value--muted">—</div></div>
            </div>
          ) : (
            skills.map((skill, idx) => {
              const es = editSkills[idx] || {};
              const existingSkillFile = !es.fileRemoved ? (skill.skill_file || skill.file || null) : null;
              return (
                <div key={idx} className={idx > 0 ? "pd-skill-divider" : ""}>
                  <div className="pd-grid">
                    <div className="pd-field">
                      <label className="pd-label">Skill Name</label>
                      <div className="pd-value-row">
                        <span className="pd-value-text">{skill.skill_name || skill.name || "—"}</span>
                        {isEditing && <FiLock className="pd-field-icon" />}
                      </div>
                    </div>
                    <div className="pd-field" />
                    <div className="pd-field pd-full-width">
                      <label className="pd-label">Skill Description</label>
                      {isEditing ? (
                        <div className="pd-input-wrap">
                          <input className="pd-input pd-input-clearable"
                            value={es.skill_description || ""}
                            onChange={(e) => updateSkillField(idx, "skill_description", e.target.value)}
                            placeholder="Describe the skill" />
                          {es.skill_description && (
                            <button className="pd-input-clear-btn" type="button"
                              onClick={() => updateSkillField(idx, "skill_description", "")}>
                              <FiX />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="pd-value">{skill.skill_description || skill.description || "—"}</div>
                      )}
                    </div>
                    <div className="pd-field">
                      <label className="pd-label">Related Subject</label>
                      {isEditing ? (
                        <div className="pd-select-wrap">
                          <select className="pd-input pd-select"
                            value={es.related_subject || ""}
                            onChange={(e) => updateSkillField(idx, "related_subject", e.target.value)}>
                            <option value="">Select subject</option>
                            {RELATED_SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <FiChevronDown className="pd-select-icon" />
                        </div>
                      ) : (
                        <div className="pd-value">{skill.related_subject || "—"}</div>
                      )}
                    </div>
                    <div className="pd-field" />
                    <div className="pd-field pd-full-width">
                      <label className="pd-label">File Related to Skill</label>
                      {isEditing ? (
                        <div className="pd-file-edit-list">
                          {existingSkillFile && !es.newFile && (
                            <div className="pd-file-edit-item">
                              <FiFileText className="pd-file-svg" />
                              <span className="pd-file-name">{getFileName(existingSkillFile)}</span>
                              <button className="pd-file-remove-btn" type="button"
                                onClick={() => updateSkillField(idx, "fileRemoved", true)}>
                                <FiX />
                              </button>
                            </div>
                          )}
                          {es.newFile && (
                            <div className="pd-file-edit-item">
                              <FiFileText className="pd-file-svg" />
                              <span className="pd-file-name">{es.newFile.name}</span>
                              <span className="pd-file-size">
                                ({(es.newFile.size / (1024 * 1024)).toFixed(1)} MB)
                              </span>
                              <button className="pd-file-remove-btn" type="button"
                                onClick={() => updateSkillField(idx, "newFile", null)}>
                                <FiX />
                              </button>
                            </div>
                          )}
                          {!es.newFile && (
                            <div className="pd-file-add-btn" onClick={() => handleSkillFileClick(idx)}>
                              <FiFileText className="pd-file-svg" />
                              <span>[ + Add file ]</span>
                              <span className="pd-file-add-note">(Max 50 MB)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <FileDisplay file={skill.skill_file || skill.file} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <input ref={skillFileInputRef} type="file"
          style={{ display: "none" }} onChange={handleSkillFileChange} />

        {/* Documents Verification */}
        <div className="pd-section">
          <h2 className="pd-section-title">Documents Verification</h2>
          <div className="pd-grid">
            <div className="pd-field">
              <label className="pd-label">Government ID Type</label>
              {isEditing ? (
                <div className="pd-select-wrap">
                  <select className="pd-input pd-select" value={editGovtIdType}
                    onChange={(e) => setEditGovtIdType(e.target.value)}>
                    <option value="">Select ID type</option>
                    {GOVT_ID_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <FiChevronDown className="pd-select-icon" />
                </div>
              ) : (
                <div className="pd-value">{formatGovtId(profile.government_id_type) || "—"}</div>
              )}
            </div>
            <div className="pd-field" />
            <div className="pd-field pd-full-width">
              <label className="pd-label">Id Number</label>
              {isEditing ? (
                <input className="pd-input" value={editIdNumber}
                  onChange={(e) => setEditIdNumber(e.target.value)}
                  placeholder="e.g. XXXX XXXX XXXX" />
              ) : (
                <div className="pd-value">{profile.id_number || "—"}</div>
              )}
            </div>
            <div className="pd-field pd-full-width">
              <label className="pd-label">Upload ID Proof</label>
              {isEditing ? (
                <div className="pd-file-edit-list">
                  {profile.id_document && !editIdFileRemoved && !editIdFile && (
                    <div className="pd-file-edit-item">
                      <FiFileText className="pd-file-svg" />
                      <span className="pd-file-name">{getFileName(profile.id_document)}</span>
                      <button className="pd-file-remove-btn" type="button"
                        onClick={() => setEditIdFileRemoved(true)}>
                        <FiX />
                      </button>
                    </div>
                  )}
                  {editIdFile && (
                    <div className="pd-file-edit-item">
                      <FiFileText className="pd-file-svg" />
                      <span className="pd-file-name">{editIdFile.name}</span>
                      <span className="pd-file-size">
                        ({(editIdFile.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                      <button className="pd-file-remove-btn" type="button"
                        onClick={() => setEditIdFile(null)}>
                        <FiX />
                      </button>
                    </div>
                  )}
                  {!editIdFile && (
                    <div className="pd-file-add-btn"
                      onClick={() => idFileInputRef.current?.click()}>
                      <FiFileText className="pd-file-svg" />
                      <span>[ + Add file ]</span>
                      <span className="pd-file-add-note">(Max 5 MB)</span>
                    </div>
                  )}
                  <input ref={idFileInputRef} type="file"
                    accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                    onChange={handleIdFileChange} />
                </div>
              ) : (
                <FileDisplay file={profile.id_document} />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
