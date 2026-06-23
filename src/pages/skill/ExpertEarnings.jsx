/**
 * src/pages/skill/ExpertEarnings.jsx
 * Wired to GET /skill/teacher/earnings/
 * Falls back to zero-state UI gracefully.
 */
import { useState, useEffect } from "react";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

const EMPTY = {
  available: 0, pending: 0, lifetime: 0,
  month_earned: 0, month_sessions: 0, month_goal: 25000,
  rows: [],
};

export default function ExpertEarnings() {
  const [data,    setData]    = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/skill/teacher/earnings/")
      .then(r => setData({ ...EMPTY, ...r.data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { available, pending, lifetime, month_sessions, rows } = data;

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Earnings</div>
          <div className="sk-head__sub">Your balance, payouts and transaction history</div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }} className="sk-earn-summary">
        <div className="sk-earn-card">
          <div className="sk-earn-card__label">Available to withdraw</div>
          <div className="sk-earn-card__big">
            {loading ? "—" : `₹${available.toLocaleString("en-IN")}`}
          </div>
          <div className="sk-earn-card__sub">Payouts wired when gateway is live</div>
          <button className="sk-earn-card__btn" disabled>Withdraw to bank</button>
        </div>

        <div className="rd-card teacher" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11.5, color: "#6b7c83", fontWeight: 600 }}>Pending clearance</div>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#d97706", marginTop: 4 }}>
            {loading ? "—" : `₹${pending.toLocaleString("en-IN")}`}
          </div>
          <div style={{ fontSize: 11, color: "#6b7c83", marginTop: 6 }}>Clears in 2–3 days</div>
        </div>

        <div className="rd-card teacher" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11.5, color: "#6b7c83", fontWeight: 600 }}>Lifetime earnings</div>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#1a2c33", marginTop: 4 }}>
            {loading ? "—" : `₹${lifetime.toLocaleString("en-IN")}`}
          </div>
          <div style={{ fontSize: 11, color: "#6b7c83", marginTop: 6 }}>
            Across {month_sessions} sessions this month
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rd-card teacher">
        <h4>Transactions</h4>
        {loading ? (
          <div className="sk-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="sk-empty">No transactions yet. Completed sessions will appear here.</div>
        ) : rows.map((g) => (
          <div key={g.day}>
            <div className="rd-daygroup">{g.day}</div>
            {g.items.map((it, i) => {
              const isOut = it.amt < 0;
              return (
                <div key={it.who + i} className="sk-txn">
                  <span className="sk-txn__icon">
                    <Icon.shield size={16} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2c33" }}>{it.who}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7c83" }}>{it.what}</div>
                  </div>
                  <span className={`sk-txn__badge sk-txn__badge--${it.status}`}>{it.status}</span>
                  <div className={`sk-txn__amt ${isOut ? "sk-txn__amt--out" : "sk-txn__amt--in"}`}>
                    {isOut ? "−" : "+"}₹{Math.abs(it.amt).toLocaleString("en-IN")}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
