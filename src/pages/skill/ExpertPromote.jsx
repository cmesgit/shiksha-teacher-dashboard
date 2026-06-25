/**
 * src/pages/skill/ExpertPromote.jsx  (NEW)
 *
 * The guest-expert advertising subscription. Wired to:
 *   GET    /skill/subscription/                → status
 *   POST   /skill/subscription/                → subscribe / start
 *   POST   /skill/subscription/submit-payment/ → submit UPI proof (paid phase)
 *   DELETE /skill/subscription/                → cancel
 *
 * Two phases driven by the backend `billing_mode`:
 *   • free → one tap, instantly advertised, no payment.
 *   • paid → start → pay the platform UPI → submit reference → admin verifies.
 */
import { useEffect, useState } from "react";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

export default function ExpertPromote() {
  const [s, setS]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState("");
  const [ref, setRef]       = useState("");
  const [vpa, setVpa]       = useState("");

  const load = () =>
    api.get("/skill/subscription/").then(r => setS(r.data)).catch(() => setErr("Couldn't load subscription."));

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const act = (fn) => { setErr(""); setBusy(true); fn().then(load)
    .catch(e => setErr(e?.response?.data?.detail || "Something went wrong."))
    .finally(() => setBusy(false)); };

  const subscribe   = () => act(() => api.post("/skill/subscription/"));
  const cancel      = () => act(() => api.delete("/skill/subscription/"));
  const submitProof = () => {
    if (!ref.trim()) { setErr("Enter your payment reference (UTR)."); return; }
    act(() => api.post("/skill/subscription/submit-payment/", { upi_reference: ref, payer_vpa: vpa }));
  };

  if (loading) return <div className="sk-page"><div className="sk-empty">Loading…</div></div>;
  if (!s)      return <div className="sk-page"><div className="sk-empty">{err || "Unavailable."}</div></div>;

  const free      = s.billing_mode === "free";
  const active    = s.active;
  const pending   = s.status === "pending";
  const submitted = s.status === "submitted";

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Promote my profile</div>
          <div className="sk-head__sub">Get advertised across ShikshaCom and grow your reach.</div>
        </div>
      </div>

      {/* Status hero */}
      <div className="rd-card teacher" style={{
        background: active ? "#0a4d55" : "#fff",
        color: active ? "#fff" : "inherit",
        border: active ? "none" : undefined,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: 0, color: active ? "#fff" : undefined }}>
            {s.is_advertised ? "You're being advertised" : "Not advertised yet"}
          </h4>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 100,
            background: active ? "rgba(255,255,255,.18)" : "#9aa9af22",
            color: active ? "#fff" : "#6b7c83",
          }}>
            {active ? (free ? "Live · free" : "Active") : submitted ? "Verifying" : "Inactive"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
          <span style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 34,
            letterSpacing: "-.8px", color: active ? "#fff" : "#1a2c33",
          }}>
            {(s.reach_count ?? 0).toLocaleString("en-IN")}
          </span>
          <span style={{ fontSize: 13, opacity: active ? .8 : .6, fontWeight: 700 }}>reach</span>
        </div>
        {s.period_end && active && !free && (
          <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>
            Renews / ends {new Date(s.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}
      </div>

      {/* Action zone */}
      <div className="rd-card teacher">
        {free ? (
          <>
            <h4>Launch period — promotion is free</h4>
            <p style={{ fontSize: 13, color: "#6b7c83", lineHeight: 1.6 }}>
              While ShikshaCom is in its launch period, every expert is advertised for free.
              {active ? " You're already live." : " Activate it with one tap."}
            </p>
            {!active && (
              <button className="sk-btn" onClick={subscribe} disabled={busy} style={{ marginTop: 6 }}>
                <Icon.spark size={14} /> {busy ? "Activating…" : "Advertise me — free"}
              </button>
            )}
          </>
        ) : active ? (
          <>
            <h4>Your subscription is active</h4>
            <p style={{ fontSize: 13, color: "#6b7c83", lineHeight: 1.6 }}>
              You're promoted across the site. If you cancel, your profile stops being
              advertised and your reach will drop.
            </p>
            <button className="sk-btn sk-btn--ghost" onClick={cancel} disabled={busy}
                    style={{ marginTop: 6, color: "#c0492f", borderColor: "#e7c3bb" }}>
              {busy ? "Cancelling…" : "Cancel subscription"}
            </button>
          </>
        ) : (
          <>
            <h4>Monthly advertising · ₹{s.price_rupees}/mo</h4>
            <p style={{ fontSize: 13, color: "#6b7c83", lineHeight: 1.6 }}>
              Subscribe to be advertised consistently for {s.period_days} days. Pay the platform
              UPI below, then submit your payment reference — we'll verify and switch you on.
            </p>

            {!pending && !submitted && (
              <button className="sk-btn" onClick={subscribe} disabled={busy}>
                <Icon.spark size={14} /> {busy ? "Starting…" : `Subscribe · ₹${s.price_rupees}/mo`}
              </button>
            )}

            {(pending || submitted) && s.pay_to_platform && (
              <div style={{ marginTop: 8 }}>
                <div className="sk-field">
                  <label>Pay to (platform UPI)</label>
                  <div className="sk-input" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{s.pay_to_platform.vpa || "—"}</span>
                    <span style={{ color: "#6b7c83" }}>{s.pay_to_platform.payee_name}</span>
                  </div>
                </div>
                {submitted ? (
                  <div style={{ color: "#b46a00", fontSize: 12.5, fontWeight: 700 }}>
                    Payment submitted — awaiting verification.
                  </div>
                ) : (
                  <>
                    <div className="sk-field">
                      <label>Payment reference (UTR)</label>
                      <input className="sk-input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="12-digit UTR" />
                    </div>
                    <div className="sk-field">
                      <label>Your UPI (optional)</label>
                      <input className="sk-input" value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="payer@upi" />
                    </div>
                    <button className="sk-btn" onClick={submitProof} disabled={busy}>
                      <Icon.check size={14} /> {busy ? "Submitting…" : "I've paid — submit reference"}
                    </button>
                  </>
                )}
                <button className="sk-btn sk-btn--ghost" onClick={cancel} disabled={busy} style={{ marginTop: 8 }}>
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
        {err && <div style={{ color: "#c0492f", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{err}</div>}
      </div>

      {/* How it works */}
      <div className="rd-card teacher">
        <h4>How promotion works</h4>
        {[
          "Listed for free — every approved expert appears in the directory.",
          "Subscribe to be advertised: you're floated to the top and featured on the homepage.",
          "Your reach grows while you're advertised and on every completed session.",
          "Cancel anytime — promotion stops and your reach decays.",
        ].map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
            <span style={{ color: "#13899b", flexShrink: 0 }}><Icon.check size={14} /></span>
            <span style={{ fontSize: 12.5, color: "#6b7c83", lineHeight: 1.5 }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
