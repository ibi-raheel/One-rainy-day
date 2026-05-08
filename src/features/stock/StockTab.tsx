import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { I } from "@/components/design/Icons";
import { CountUp } from "@/components/design/CountUp";
import { Rainfield } from "@/components/design/Rain";
import type { StockItem } from "@/db/types";

type Status = "ok" | "low" | "critical";
type Filter = "all" | Status;

async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function statusOf(qty: number, reorder: number): Status {
  if (reorder <= 0) return "ok";
  if (qty <= reorder * 0.3) return "critical";
  if (qty <= reorder) return "low";
  return "ok";
}

const COMMON_UNITS = ["ea", "g", "kg", "lb", "oz", "ml", "L", "gal", "pkg", "case", "bottle", "bag"];

export function StockTab() {
  const stockItems = useApp((s) => s.stockItems);
  const upsertStockItem = useApp((s) => s.upsertStockItem);
  const deleteStockItem = useApp((s) => s.deleteStockItem);
  const ingredients = useApp((s) => s.ingredients);

  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<StockItem | "new" | null>(null);
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { quantity?: string; reorder?: string }>>({});

  const rows = useMemo(() => {
    return stockItems
      .map((s) => ({
        item: s,
        status: statusOf(s.quantity, s.reorder_point ?? 0),
      }))
      .sort((a, b) => {
        const order = { critical: 0, low: 1, ok: 2 } as const;
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.item.name.localeCompare(b.item.name);
      });
  }, [stockItems]);

  const counts = {
    all: rows.length,
    critical: rows.filter((s) => s.status === "critical").length,
    low: rows.filter((s) => s.status === "low").length,
    ok: rows.filter((s) => s.status === "ok").length,
  };
  const list = rows.filter((s) => filter === "all" || s.status === filter);

  const commit = async (item: StockItem, field: "quantity" | "reorder", raw: string) => {
    const num = raw === "" ? 0 : parseFloat(raw);
    if (!isFinite(num) || num < 0) {
      setDrafts((d) => { const n = { ...d }; delete n[item.id]; return n; });
      return;
    }
    const next: StockItem = {
      ...item,
      ...(field === "quantity"
        ? {
            quantity: num,
            last_restocked_at: num > item.quantity ? new Date().toISOString() : item.last_restocked_at,
          }
        : { reorder_point: num }),
    };
    setDrafts((d) => { const n = { ...d }; delete n[item.id]; return n; });
    await upsertStockItem(next);
  };

  const restock = async (item: StockItem) => {
    const target = item.reorder_point && item.reorder_point > 0
      ? item.reorder_point * 2
      : Math.max(1, item.quantity);
    const next: StockItem = {
      ...item,
      quantity: target,
      last_restocked_at: new Date().toISOString(),
    };
    await upsertStockItem(next);
  };

  const copyOrderList = async () => {
    const lowOrCritical = rows.filter((s) => s.status !== "ok");
    if (lowOrCritical.length === 0) {
      alert("Nothing below reorder point right now.");
      return;
    }
    const byVendor = new Map<string, typeof rows>();
    for (const s of lowOrCritical) {
      const v = (s.item.vendor || "(no supplier)").trim();
      if (!byVendor.has(v)) byVendor.set(v, []);
      byVendor.get(v)!.push(s);
    }
    const lines: string[] = ["ORDER SOON", ""];
    for (const [vendor, items] of byVendor) {
      lines.push(`${vendor}:`);
      for (const s of items) {
        const need = Math.max(0, (s.item.reorder_point ?? 0) * 2 - s.item.quantity);
        lines.push(`  • ${s.item.name}: order ~${need.toFixed(2)} ${s.item.unit} (currently ${s.item.quantity})`);
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

  const orderSoonByVendor = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const s of rows) {
      if (s.status === "ok") continue;
      const v = (s.item.vendor || "(no supplier)").trim();
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(s);
    }
    return Array.from(map.entries());
  }, [rows]);

  const isEmpty = stockItems.length === 0;

  return (
    <div className="view">
      <div className="page-head fade-up">
        <Rainfield count={14} />
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>Stock</h1>
            <p className="subtle">
              {isEmpty
                ? "What's actually in your pantry right now. Add an item to start tracking."
                : "What you have on hand. Click a number to edit. Quick restock fills back to 2× reorder."}
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
            <button
              className="btn primary"
              style={{ alignSelf: "center", marginLeft: 8 }}
              onClick={() => setEditing("new")}
            >
              <I.Plus /> Add stock
            </button>
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
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--accent-mist)",
                color: "var(--accent-deep)",
                display: "grid", placeItems: "center",
                margin: "0 auto 14px",
              }}>
                <I.Box />
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>No stock items yet</h3>
              <p className="muted" style={{ fontSize: 13.5, maxWidth: 360, margin: "0 auto 16px" }}>
                Stock is separate from your ingredients catalog. Add what's actually in your pantry — like
                "Whole milk · 4 gallons" — and we'll track when it gets low.
              </p>
              <button className="btn primary" onClick={() => setEditing("new")}>
                <I.Plus /> Add your first item
              </button>
            </div>
          ) : (
            <table className="tbl nums">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="r">Quantity</th>
                  <th className="r">Reorder at</th>
                  <th className="r">Status</th>
                  <th className="r">Restocked</th>
                  <th className="r"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const it = s.item;
                  const reorder = it.reorder_point ?? 0;
                  const ratio = Math.min(1, reorder > 0 ? it.quantity / Math.max(reorder * 2, it.quantity || 1) : 1);
                  const draft = drafts[it.id] ?? {};
                  return (
                    <tr key={it.id}>
                      <td className="name-cell">
                        <button
                          onClick={() => setEditing(it)}
                          style={{
                            background: "transparent", border: "none", padding: 0,
                            color: "inherit", font: "inherit", cursor: "pointer",
                            textAlign: "left",
                          }}
                          title="Edit item"
                        >
                          {it.name}
                        </button>
                        {it.vendor && (
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{it.vendor}</div>
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
                            value={draft.quantity ?? String(it.quantity)}
                            onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: { ...d[it.id], quantity: e.target.value } }))}
                            onBlur={(e) => commit(it, "quantity", e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            style={{
                              width: 70, padding: "3px 6px", textAlign: "right",
                              border: "1px solid var(--border)", borderRadius: 6,
                              background: "var(--bg-surface)",
                              fontFamily: "Fraunces, serif", fontSize: 13.5,
                              color: "var(--ink)",
                            }}
                          />
                          <span style={{ color: "var(--text-muted)", fontSize: 11, minWidth: 30 }}>{it.unit}</span>
                        </div>
                      </td>
                      <td className="r">
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={draft.reorder ?? String(reorder)}
                            onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: { ...d[it.id], reorder: e.target.value } }))}
                            onBlur={(e) => commit(it, "reorder", e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            style={{
                              width: 60, padding: "3px 6px", textAlign: "right",
                              border: "1px solid var(--border)", borderRadius: 6,
                              background: "var(--bg-surface)",
                              fontSize: 12.5, color: "var(--text)",
                            }}
                          />
                          <span style={{ color: "var(--text-muted)", fontSize: 11, minWidth: 30 }}>{it.unit}</span>
                        </div>
                      </td>
                      <td className="r">
                        <span className={`stock-pill ${s.status}`}>
                          <span className="d" />
                          {s.status === "ok" ? "OK" : s.status}
                        </span>
                      </td>
                      <td className="r muted">
                        {it.last_restocked_at
                          ? new Date(it.last_restocked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}
                      </td>
                      <td className="r" style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="btn"
                          style={{ padding: "4px 10px", fontSize: 11.5, marginRight: 4 }}
                          onClick={() => restock(it)}
                          title="Quick restock to 2× reorder point"
                        >
                          Restock
                        </button>
                        <button
                          className="btn ghost"
                          style={{ padding: "4px 8px", fontSize: 11.5, color: "var(--error)" }}
                          onClick={() => {
                            if (confirm(`Remove "${it.name}" from stock?`)) {
                              void deleteStockItem(it.id);
                            }
                          }}
                          title="Remove from stock"
                          aria-label={`Remove ${it.name} from stock`}
                        >
                          <I.X />
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
            <div className="card-head"><h3>Quick add</h3><span className="card-sub">manual entry</span></div>
            <div style={{ padding: "12px 20px 18px" }}>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
                Track what's in your pantry without it being tied to a recipe ingredient.
              </p>
              <button className="btn primary" onClick={() => setEditing("new")}>
                <I.Plus /> New stock item
              </button>
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
            {isEmpty
              ? "Add some stock items first to see what needs reordering."
              : "Nothing is below its reorder point right now. Stock looks healthy."}
          </div>
        ) : (
          <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {orderSoonByVendor.map(([vendor, items]) => (
              <div key={vendor}>
                <div className="label-cap" style={{ marginBottom: 10 }}>{vendor}</div>
                {items.map((s) => (
                  <span key={s.item.id} className="tag" style={{ marginRight: 6, marginBottom: 4, display: "inline-block" }}>
                    {s.item.name} × ~{Math.max(1, Math.ceil((s.item.reorder_point ?? 0) * 2 - s.item.quantity))} {s.item.unit}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing !== null && (
        <StockItemModal
          initial={editing}
          ingredientHints={ingredients.map((i) => ({ id: i.id, name: i.name, vendor: i.vendor }))}
          onClose={() => setEditing(null)}
          onSave={async (s) => {
            await upsertStockItem(s);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  initial: StockItem | "new";
  ingredientHints: { id: string; name: string; vendor?: string }[];
  onClose: () => void;
  onSave: (s: Omit<StockItem, "created_at" | "updated_at"> & { created_at?: string }) => Promise<void>;
}

function StockItemModal({ initial, ingredientHints, onClose, onSave }: ModalProps) {
  const isNew = initial === "new";
  const init: StockItem = isNew
    ? {
        id: "", name: "", quantity: 0, unit: "ea",
        reorder_point: 0, vendor: "", notes: "", ingredient_id: "",
        created_at: "", updated_at: "",
      }
    : initial as StockItem;

  const [name, setName] = useState(init.name);
  const [quantity, setQuantity] = useState<string>(String(init.quantity ?? 0));
  const [unit, setUnit] = useState(init.unit || "ea");
  const [reorder, setReorder] = useState<string>(String(init.reorder_point ?? 0));
  const [vendor, setVendor] = useState(init.vendor ?? "");
  const [notes, setNotes] = useState(init.notes ?? "");
  const [ingredientId, setIngredientId] = useState(init.ingredient_id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmedName = name.trim();
  const qtyNum = parseFloat(quantity);
  const reorderNum = parseFloat(reorder);
  const canSave = trimmedName.length > 0 && isFinite(qtyNum) && qtyNum >= 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave({
        id: isNew ? "" : (initial as StockItem).id,
        name: trimmedName,
        quantity: qtyNum,
        unit: unit.trim() || "ea",
        reorder_point: isFinite(reorderNum) && reorderNum > 0 ? reorderNum : undefined,
        vendor: vendor.trim() || undefined,
        notes: notes.trim() || undefined,
        ingredient_id: ingredientId || undefined,
        last_restocked_at: isNew && qtyNum > 0 ? new Date().toISOString() : (initial as StockItem).last_restocked_at,
        ...(isNew ? {} : { created_at: (initial as StockItem).created_at }),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  // When user picks an ingredient hint, auto-fill name/vendor if empty
  const pickIngredient = (id: string) => {
    setIngredientId(id);
    if (!id) return;
    const ing = ingredientHints.find((i) => i.id === id);
    if (!ing) return;
    if (!name.trim()) setName(ing.name);
    if (!vendor.trim() && ing.vendor) setVendor(ing.vendor);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(10, 14, 16, 0.55)",
        backdropFilter: "blur(6px)",
        display: "grid", placeItems: "center",
        padding: 20,
      }}
    >
      <div
        className="card"
        style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 0 }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}>
          <h3 style={{ margin: 0 }}>{isNew ? "Add stock item" : "Edit stock item"}</h3>
          <button className="btn ghost" onClick={onClose} aria-label="Close"><I.X /></button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Name *</span>
            <input
              className="input-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Whole milk, gallon"
              autoFocus
            />
          </label>

          {ingredientHints.length > 0 && (
            <label style={{ display: "grid", gap: 6 }}>
              <span className="label-cap">Link to ingredient (optional)</span>
              <select
                className="input-base"
                value={ingredientId}
                onChange={(e) => pickIngredient(e.target.value)}
              >
                <option value="">— None —</option>
                {ingredientHints.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}{i.vendor ? ` · ${i.vendor}` : ""}</option>
                ))}
              </select>
            </label>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="label-cap">Quantity *</span>
              <input
                className="input-base"
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="label-cap">Unit</span>
              <input
                className="input-base"
                list="stock-units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ea, g, ml, pkg…"
              />
              <datalist id="stock-units">
                {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Reorder when below</span>
            <input
              className="input-base"
              type="number"
              step="any"
              min="0"
              value={reorder}
              onChange={(e) => setReorder(e.target.value)}
              placeholder="0 = no reorder alert"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Supplier (optional)</span>
            <input
              className="input-base"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Restaurant Depot"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Notes</span>
            <textarea
              className="input-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember about this item"
              rows={3}
              style={{ resize: "vertical", minHeight: 60 }}
            />
          </label>

          {err && (
            <div style={{
              padding: "10px 12px",
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.2)",
              borderRadius: 8,
              color: "var(--error)",
              fontSize: 13,
            }}>
              {err}
            </div>
          )}
        </div>

        <div style={{
          display: "flex", gap: 10, justifyContent: "flex-end",
          padding: "14px 22px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}>
          <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : (isNew ? "Add item" : "Save changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
