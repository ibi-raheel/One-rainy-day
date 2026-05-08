import { useState } from "react";
import { Modal } from "@/components/design/Modal";
import { I } from "@/components/design/Icons";

interface Props { onClose: () => void; }

interface Row {
  raw: string;
  matched: string | null;
  qty: string;
  price: number;
  status: "matched" | "flagged";
  suggest?: string;
  priceDelta?: number;
}

const INITIAL: Row[] = [
  { raw: "WHL MILK 1GAL",  matched: "Whole milk",       qty: "1 gal",  price:  3.48, status: "matched", priceDelta: -2.1 },
  { raw: "HVY CRM QT",     matched: "Heavy cream",      qty: "1 qt",   price:  4.98, status: "matched", priceDelta:  3.2 },
  { raw: "EGGS 5DZ",       matched: "Eggs (large)",     qty: "5 doz",  price: 14.20, status: "matched", priceDelta:  1.4 },
  { raw: "BUTTER UNSL",    matched: "Butter, unsalted", qty: "1 lb",   price:  5.40, status: "matched" },
  { raw: "BREAD FLR 50#",  matched: "Bread flour",      qty: "50 lb",  price: 21.80, status: "matched" },
  { raw: "VAN EXT 16OZ",   matched: null,               qty: "1",      price: 11.20, status: "flagged", suggest: "Vanilla extract" },
  { raw: "CHOC 70% 5#",    matched: null,               qty: "5 lb",   price: 32.10, status: "flagged", suggest: "Dark chocolate 70%" },
];

export function ReviewModal({ onClose }: Props) {
  const [rows, setRows] = useState<Row[]>(INITIAL);
  const accept = (i: number) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, matched: r.suggest ?? null, status: "matched" } : r)));
  const flagged = rows.filter((r) => r.status === "flagged").length;

  return (
    <Modal
      title="Review receipt items"
      sub={`Restaurant Depot · 14 line items · ${flagged} need attention`}
      onClose={onClose}
      width={780}
      footer={
        <>
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>
            {flagged === 0 ? "All matched · ready to log" : `${flagged} unmatched`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Save draft</button>
            <button className="btn primary" onClick={onClose}>Log invoice <I.Check /></button>
          </div>
        </>
      }
    >
      <div className="review-list">
        {rows.map((r, i) => (
          <div key={i} className={`review-row ${r.status}`}>
            <span className="match-icon">{r.status === "matched" ? "✓" : "?"}</span>
            <div>
              <div className="raw">{r.raw}</div>
              <div className="matched-to">
                {r.matched ? <>→ {r.matched}</> : <span style={{ color: "var(--accent)" }}>Suggest: {r.suggest}?</span>}
              </div>
            </div>
            <div className="qty">{r.qty}</div>
            <div className="price">
              ${r.price.toFixed(2)}
              {r.priceDelta != null && (
                <div style={{
                  fontSize: 10,
                  color: r.priceDelta > 0 ? "var(--error)" : "var(--success)",
                  fontFamily: "Inter",
                }}>
                  {r.priceDelta > 0 ? "+" : ""}{r.priceDelta}%
                </div>
              )}
            </div>
            <div>
              {r.status === "flagged" ? (
                <button
                  className="btn primary"
                  style={{ fontSize: 11, padding: "4px 10px" }}
                  onClick={() => accept(i)}
                >
                  Accept
                </button>
              ) : (
                <button
                  className="btn ghost"
                  style={{ fontSize: 11, padding: "4px 8px", color: "var(--text-2)" }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 14, padding: "10px 14px",
        background: "rgba(168, 111, 61, 0.08)",
        border: "1px solid rgba(168, 111, 61, 0.22)",
        borderRadius: 8, fontSize: 12.5, color: "var(--text)",
      }}>
        <strong>Logging will:</strong> add $182.40 to May spend, bump on-hand for 14 items, update price history (3 changes), and notify Huda's iPhone.
      </div>
    </Modal>
  );
}
