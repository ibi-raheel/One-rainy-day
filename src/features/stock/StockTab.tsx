import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { I } from "@/components/design/Icons";
import { CountUp } from "@/components/design/CountUp";
import { Rainfield } from "@/components/design/Rain";

type Status = "ok" | "low" | "critical";
type Filter = "all" | Status;

interface StockRow {
  id: string;
  name: string;
  on: number;
  unit: string;
  reorder: number;
  status: Status;
  lastRestock: string;
}

/** Demo stock seed used until ingredients carry on_hand_qty / reorder_point fields. */
const DEFAULT_STOCK: StockRow[] = [
  { id: "1", name: "Whole milk",       on: 5.2,  unit: "gal",  reorder: 3,    status: "ok",       lastRestock: "May 6" },
  { id: "2", name: "Heavy cream",      on: 0.8,  unit: "L",    reorder: 2,    status: "critical", lastRestock: "May 3" },
  { id: "3", name: "Eggs",             on: 36,   unit: "ct",   reorder: 60,   status: "low",      lastRestock: "May 5" },
  { id: "4", name: "Espresso beans",   on: 4.1,  unit: "kg",   reorder: 2,    status: "ok",       lastRestock: "May 7" },
  { id: "5", name: "Chicken thigh",    on: 11.2, unit: "lb",   reorder: 6,    status: "ok",       lastRestock: "May 5" },
  { id: "6", name: "Turkey ham",       on: 1.8,  unit: "lb",   reorder: 2,    status: "low",      lastRestock: "May 2" },
  { id: "7", name: "Vanilla syrup",    on: 1.2,  unit: "L",    reorder: 0.5,  status: "ok",       lastRestock: "May 6" },
  { id: "8", name: "Matcha (Rishi)",   on: 0.42, unit: "kg",   reorder: 0.3,  status: "ok",       lastRestock: "Apr 30" },
  { id: "9", name: "Chai concentrate", on: 0.8,  unit: "L",    reorder: 0.5,  status: "ok",       lastRestock: "May 7" },
];

export function StockTab() {
  const ingredients = useApp((s) => s.ingredients);
  const [filter, setFilter] = useState<Filter>("all");
  const [drag, setDrag] = useState(false);

  // If real ingredients exist, derive a stock row per ingredient using package
  // amount + a heuristic status (low if cost_per_base flagged otherwise ok).
  // Else fall back to demo data so the page is meaningful.
  const stockData: StockRow[] = useMemo(() => {
    if (ingredients.length === 0) return DEFAULT_STOCK;
    return ingredients.slice(0, 12).map((i, idx) => {
      // No on-hand fields yet — assign demo status based on hash for variety
      const seed = (i.name.length * 7 + idx) % 7;
      const status: Status = seed === 0 ? "critical" : seed < 2 ? "low" : "ok";
      const onAmt = Math.max(0.4, i.package_quantity * (status === "critical" ? 0.2 : status === "low" ? 0.6 : 1.4));
      return {
        id: i.id,
        name: i.name,
        on: Number(onAmt.toFixed(2)),
        unit: i.package_unit,
        reorder: Number((i.package_quantity * 0.5).toFixed(2)),
        status,
        lastRestock: ["May 2","May 3","May 5","May 6","May 7","Apr 30"][idx % 6],
      };
    });
  }, [ingredients]);

  const list = stockData.filter((s) => filter === "all" || s.status === filter);
  const counts = {
    all: stockData.length,
    critical: stockData.filter((s) => s.status === "critical").length,
    low: stockData.filter((s) => s.status === "low").length,
    ok: stockData.filter((s) => s.status === "ok").length,
  };

  return (
    <div className="view">
      <div className="page-head fade-up">
        <Rainfield count={14} />
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>Stock</h1>
            <p className="subtle">What's on hand, what's running thin, what to put on the next order.</p>
          </div>
          <div className="head-stats">
            <div className="head-stat">
              <span className="v" style={{ color: "var(--error)" }}><CountUp to={counts.critical} /></span>
              <span className="l">critical</span>
            </div>
            <div className="head-stat">
              <span className="v" style={{ color: "var(--warning)" }}><CountUp to={counts.low} delay={100} /></span>
              <span className="l">low</span>
            </div>
            <div className="head-stat">
              <span className="v" style={{ color: "var(--success)" }}><CountUp to={counts.ok} delay={200} /></span>
              <span className="l">ok</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row-2" style={{ marginBottom: 22 }}>
        <div className="card fade-up">
          <div className="card-head">
            <h3>On hand</h3>
            <div className="right">
              <div className="segmented">
                <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All ({counts.all})</button>
                <button className={filter === "critical" ? "on" : ""} onClick={() => setFilter("critical")}>Critical</button>
                <button className={filter === "low" ? "on" : ""} onClick={() => setFilter("low")}>Low</button>
                <button className={filter === "ok" ? "on" : ""} onClick={() => setFilter("ok")}>OK</button>
              </div>
            </div>
          </div>
          <table className="tbl nums">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th className="r">On hand</th>
                <th className="r">Reorder at</th>
                <th className="r">Status</th>
                <th className="r">Last restock</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const ratio = Math.min(1, s.on / Math.max(s.reorder * 2, s.on));
                return (
                  <tr key={s.id}>
                    <td className="name-cell">{s.name}</td>
                    <td className="r">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <div style={{
                          width: 60, height: 4,
                          background: "var(--bg-surface-alt)",
                          borderRadius: 2, overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${ratio * 100}%`,
                            height: "100%",
                            background:
                              s.status === "critical" ? "var(--error)"
                              : s.status === "low" ? "var(--warning)"
                              : "var(--success)",
                            transition: "width 1s var(--ease)",
                          }}/>
                        </div>
                        <span>{s.on} {s.unit}</span>
                      </div>
                    </td>
                    <td className="r muted">{s.reorder} {s.unit}</td>
                    <td className="r">
                      <span className={`stock-pill ${s.status}`}>
                        <span className="d" />
                        {s.status === "ok" ? "OK" : s.status}
                      </span>
                    </td>
                    <td className="r muted">{s.lastRestock}</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Nothing matches that filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            className="card fade-up"
            style={{
              animationDelay: ".15s",
              padding: 24,
              border: drag ? "1.5px dashed var(--accent)" : "1.5px dashed var(--border-strong)",
              background: drag ? "var(--accent-mist)" : "var(--bg-surface)",
              transition: "all .2s var(--ease)",
              textAlign: "center",
              cursor: "pointer",
            }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--accent-mist)",
              color: "var(--accent-deep)",
              display: "grid", placeItems: "center",
              margin: "0 auto 10px",
            }}>
              <I.Camera />
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>Drop a delivery receipt</h3>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              We'll OCR it, match line items to ingredients, and bump on-hand + price history.
            </p>
            <button className="btn primary" onClick={() => window.openModal?.("scan")}>
              <I.Camera /> Scan receipt
            </button>
          </div>

          <div className="card fade-up" style={{ animationDelay: ".22s" }}>
            <div className="card-head"><h3>Pending review</h3><span className="card-sub">2 receipts</span></div>
            <div style={{ padding: "12px 20px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 6,
                  background: "repeating-linear-gradient(135deg, rgba(168,111,61,.18) 0 4px, rgba(168,111,61,.10) 4px 8px), var(--accent-mist)",
                }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Restaurant Depot · May 7</div>
                  <div className="muted" style={{ fontSize: 12 }}>$182.40 · 14 line items · 12 matched</div>
                </div>
                <button className="btn" onClick={() => window.openModal?.("review")}>Review</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 6,
                  background: "repeating-linear-gradient(135deg, rgba(80,107,69,.18) 0 4px, rgba(80,107,69,.10) 4px 8px), var(--success-soft)",
                }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Sam's Club · May 7</div>
                  <div className="muted" style={{ fontSize: 12 }}>$96.18 · 8 line items · 7 matched</div>
                </div>
                <button className="btn" onClick={() => window.openModal?.("review")}>Review</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card fade-up" style={{ animationDelay: ".30s" }}>
        <div className="card-head">
          <h3>Order soon</h3>
          <span className="card-sub">grouped by supplier</span>
          <div className="right">
            <button className="btn">Copy list</button>
            <button className="btn primary" onClick={() => window.openModal?.("order")}>
              <I.Plus /> New order
            </button>
          </div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div className="label-cap" style={{ marginBottom: 10 }}>Sam's Club</div>
            <span className="tag" style={{ marginRight: 6 }}>Heavy cream × 4 half-gal</span>
            <span className="tag" style={{ marginRight: 6 }}>Eggs × 1 flat</span>
          </div>
          <div>
            <div className="label-cap" style={{ marginBottom: 10 }}>Restaurant Depot</div>
            <span className="tag" style={{ marginRight: 6 }}>Turkey ham × 1 tray</span>
          </div>
        </div>
      </div>
    </div>
  );
}
