/**
 * src/pages/skill/ExpertEarnings.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * "Earnings" — available-to-withdraw card + pending + lifetime, plus a
 * grouped transaction history. Ported from the prototype's txn tab.
 *
 * Route: /teacher/expert/earnings
 * API TODO: EARNINGS → GET /api/skill/teacher/earnings/
 *           withdraw → POST /api/skill/teacher/payouts/
 */
import { Icon } from "../../components/SkillIcons";
import { EARNINGS, STUDENTS } from "../../data/skillMockData";
import "../../styles/skillDev.css";

export default function ExpertEarnings() {
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
          <div className="sk-earn-card__big">₹{EARNINGS.available.toLocaleString("en-IN")}</div>
          <div className="sk-earn-card__sub">Next payout · Mon 9 Jun</div>
          {/* API TODO: POST /api/skill/teacher/payouts/ */}
          <button className="sk-earn-card__btn">Withdraw to bank</button>
        </div>

        <div className="rd-card teacher" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11.5, color: "#6b7c83", fontWeight: 600 }}>Pending clearance</div>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#d97706", marginTop: 4 }}>
            ₹{EARNINGS.pending.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "#6b7c83", marginTop: 6 }}>Clears in 2–3 days</div>
        </div>

        <div className="rd-card teacher" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11.5, color: "#6b7c83", fontWeight: 600 }}>Lifetime earnings</div>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#1a2c33", marginTop: 4 }}>
            ₹{EARNINGS.lifetime.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: 11, color: "#6b7c83", marginTop: 6 }}>Across {STUDENTS.completed} sessions</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rd-card teacher">
        <h4>Transactions</h4>
        {EARNINGS.rows.map((g) => (
          <div key={g.day}>
            <div className="rd-daygroup">{g.day}</div>
            {g.items.map((it, i) => {
              const isOut = it.amt < 0;
              return (
                <div key={it.who + i} className="sk-txn">
                  {it.img ? (
                    <img src={it.img} alt="" className="sk-txn__img" />
                  ) : (
                    <span className="sk-txn__icon"><Icon.shield size={16} /></span>
                  )}
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
