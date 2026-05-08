import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { I } from "@/components/design/Icons";
import { CountUp } from "@/components/design/CountUp";
import { Rainfield } from "@/components/design/Rain";
import { unitLabel } from "@/lib/units";
import type { Ingredient } from "@/db/types";

type Status = "ok" | "low" | "critical";
type Filter = "all" | Status;

async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/**
 * Derive a status from on-hand qty vs reorder point.
 * - critical: ≤ 30% of reorder, or 0 with reorder set
 * - low: ≤ reorder
 * - ok: above reorder, or no reorder set yet
 */
function statusOf(on_hand: number, reorder: number): Status {
  if (reorder <= 0) return "ok";
  if (on_hand <= reorder * 0.3) return "critical";
  if (on_hand <= reorder) return "low";
  return "ok";
}

export function StockTab() {
  const ingredients = useApp((s) => s.ingredients);
  const upsert = useApp((s) => s.upsertIngredient);
  const [filter, setFilter] = useState<Filter>("all");
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);

  // Local edit buffers — keyed by ingredient id, used while typing.
  // Commit on blur. Avoids a re-render on every keystroke.
  const [drafts, setDrafts] = useState<Record<string, { on_hand?: string; reorder?: string }>>({});

  const stockRows = useMemo(() => {
    return ingredients
      .map((i) => {
        const onHand = i.on_hand_qty ?? 0;
        const reorder = i.reorder_point ?? 0;
        return { ingredient: i, status: statusOf(onHand, reorder) };
      })
      .sort((a, b) => {
        const order = { critical: 0, low: 1, ok: 2 } as const;
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.ingredient.name.localeCompare(b.ingredient.name);
      });
  }, [ingredients]);

  const list = stockRows.filter((s) => filter === "all" || s.status === filter);
  const counts = {
    all: stockRows.length,
    critical: stockRows.filter((s) => s.status === "critical").length,
    low: stockRows.filter((s) => s.status === "low").length,
    ok: stockRows.filter((s) => s.status === "ok").length,
  };

  const commit = async (ingredient: Ingredient, field: "on_hand" | "reorder", raw: string) => {
    const num = raw === "" ? 0 : parseFloat(raw);
    if (!isFinite(num) || num < 0) {
      // bad input, snap back
      setDrafts((d) => { const n = { ...d }; delete n[ingredient.id]; return n; });
      return;
    }
    const next: Ingredient = {
      ...ingredient,
      ...(field === "on_hand"
        ? { on_hand_qty: num, last_restocked_at: num > (ingredient.on_hand_qty ?? 0) ? new Date().toISOString() : ingredient.last_restocked_at }
        : { reorder_point: num }),
    };
    setDrafts((d) => { const n = { ...d }; delete n[ingredient.id]; return n; });
    await upsert(next as any);
  };

  const restock = async (ingredient: Ingredient) => {
    // Restock to 2× reorder, or 1 unit if no reorder set
    const target = ingredient.reorder_point && ingredient.reorder_point > 0
      ? ingredient.reorder_point * 2
      : (ingredient.package_quantity || 1);
    const next: Ingredient = {
      ...ingredient,
      on_hand_qty: target,
      last_restocked_at: new Date().toISOString(),
    };
    await upsert(next as any);
  };

  const copyOrderList = async () => {
    const lowOrCritical = stockRows.filter((s) => s.status !== "ok");
    if (lowOrCritical.length === 0) {
      alert("Nothing below reorder point right now.");
      return;
    }
    // Group by vendor
    const byVendor = new Map<string, typeof stockRows>();
    for (const s of lowOrCritical) {
      const v = (s.ingredient.vendor || "(no supplier)").trim();
      if (!byVendor.has(v)) byVendor.set(v, []);
      byVendor.get(v)!.push(s);
    }
    const lines: string[] = ["ORDER SOON", ""];
    for (const [vendor, items] of byVendor) {
      lines.push(`${vendor}:`);
      for (const s of items) {
        const need = Math.max(0, (s.ingredient.reorder_point ?? 0) * 2 - (s.ingredient.on_hand_qty ?? 0));
        lines.push(`  • ${s.ingredient.name}: order ~${need.toFixed(2)} ${unitLabel(s.ingredient.package_unit)} (currently ${s.ingredient.on_hand_qty ?? 0})`);
      }
      lines.push("");
    }
    const ok = await copyToClipboard(lines.join("\n"));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      alert("Couldn't copy to clipboard.");
    }
  };

  // Group order-soon list by supplier for the bottom card
  const orderSoonByVendor = useMemo(() => {
    const map = new Map<string, typeof stockRows>();
    for (const s of stockRows) {
      if (s.status === "ok") continue;
      const v = (s.ingredient.vendor || "(no supplier)").trim();
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(s);
    }
    return Array.from(map.entries());
  }, [stockRows]);

  const isEmpty = ingredients.length === 0;

  return (
    <div className="view">
      <div className="page-head fade-up">
        <Rainfield count={14} />
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>Stock</h1>
            <p className="subtle">
              {isEmpty
                ? "Add ingredients first; their on-hand and reorder levels live here."
                : "Click a number to edit. Quick restock fills back to 2× reorder point and stamps the date."}
            </p>
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
          {isEmpty ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No ingredients yet. Head over to the Ingredients tab to add some, then come back to set on-hand quantities.
            </div>
          ) : (
            <table className="tbl nums">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="r">On hand</th>
                  <th className="r">Reorder at</th>
                  <th className="r">Status</th>
                  <th className="r">Restocked</th>
                  <th className="r"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const i = s.ingredient;
                  const onHand = i.on_hand_qty ?? 0;
                  const reorder = i.reorder_point ?? 0;
                  const ratio = Math.min(1, reorder > 0 ? onHand / Math.max(reorder * 2, onHand || 1) : 1);
                  const draft = drafts[i.id] ?? {};
                  return (
                    <tr key={i.id}>
                      <td className="name-cell">
                        {i.name}
                        {i.vendor && (
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{i.vendor}</div>
                        )}
                      </td>
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
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={draft.on_hand ?? String(onHand)}
                            onChange={(e) => setDrafts((d) => ({ ...d, [i.id]: { ...d[i.id], on_hand: e.target.value } }))}
                            onBlur={(e) => commit(i, "on_hand", e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            style={{
                              width: 70, padding: "3px 6px", textAlign: "right",
                              border: "1px solid var(--border)", borderRadius: 6,
                              background: "var(--bg-surface)",
                              fontFamily: "Fraunces, serif", fontSize: 13.5,
                              color: "var(--ink)",
                            }}
                          />
                          <span style={{ color: "var(--text-muted)", fontSize: 11, minWidth: 30 }}>
                            {unitLabel(i.package_unit)}
                          </span>
                        </div>
                      </td>
                      <td className="r">
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={draft.reorder ?? String(reorder)}
                            onChange={(e) => setDrafts((d) => ({ ...d, [i.id]: { ...d[i.id], reorder: e.target.value } }))}
                            onBlur={(e) => commit(i, "reorder", e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            style={{
                              width: 60, padding: "3px 6px", textAlign: "right",
                              border: "1px solid var(--border)", borderRadius: 6,
                              background: "var(--bg-surface)",
                              fontSize: 12.5, color: "var(--text)",
                            }}
                          />
                          <span style={{ color: "var(--text-muted)", fontSize: 11, minWidth: 30 }}>
                            {unitLabel(i.package_unit)}
                          </span>
                        </div>
                      </td>
                      <td className="r">
                        <span className={`stock-pill ${s.status}`}>
                          <span className="d" />
                          {s.status === "ok" ? "OK" : s.status}
                        </span>
                      </td>
                      <td className="r muted">
                        {i.last_restocked_at
                          ? new Date(i.last_restocked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}
                      </td>
                      <td className="r">
                        <button
                          className="btn"
                          style={{ padding: "4px 10px", fontSize: 11.5 }}
                          onClick={() => restock(i)}
                          title="Quick restock to 2× reorder point"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                      Nothing matches that filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
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
            onDrop={(e) => { e.preventDefault(); setDrag(false); window.openModal?.("scan"); }}
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
          <span className="card-sub">grouped by supplier · {orderSoonByVendor.reduce((s, [, items]) => s + items.length, 0)} items</span>
          <div className="right">
            <button className="btn" onClick={copyOrderList}>
              {copied ? <><I.Check /> Copied</> : "Copy list"}
            </button>
            <button className="btn primary" onClick={() => window.openModal?.("order")}>
              <I.Plus /> New order
            </button>
          </div>
        </div>
        {orderSoonByVendor.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Nothing is below its reorder point right now. Stock looks healthy.
          </div>
        ) : (
          <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {orderSoonByVendor.map(([vendor, items]) => (
              <div key={vendor}>
                <div className="label-cap" style={{ marginBottom: 10 }}>{vendor}</div>
                {items.map((s) => (
                  <span key={s.ingredient.id} className="tag" style={{ marginRight: 6, marginBottom: 4, display: "inline-block" }}>
                    {s.ingredient.name} × ~{Math.max(1, Math.ceil((s.ingredient.reorder_point ?? 0) * 2 - (s.ingredient.on_hand_qty ?? 0)))} {unitLabel(s.ingredient.package_unit)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
