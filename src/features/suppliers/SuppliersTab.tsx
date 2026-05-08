import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useApp } from "@/store/app";
import { I } from "@/components/design/Icons";
import { CountUp } from "@/components/design/CountUp";
import { Rainfield } from "@/components/design/Rain";
import type { Supplier, SupplierTier } from "@/db/types";

const TIERS: SupplierTier[] = ["Primary", "Watching", "Trial"];

interface SupplierRow {
  /** undefined if this is a derived (vendor-only) row */
  id?: string;
  isCustom: boolean;
  name: string;
  tier: SupplierTier;
  categories: string[];
  leadTime: string;
  onTime: number;
  contact: string;
  items: number;
  monthSpend: number;
  notes?: string;
  raw?: Supplier;
}

/** A few enrichment hints for vendors auto-derived from ingredient.vendor. */
const VENDOR_META: Record<string, Partial<SupplierRow>> = {
  "Restaurant Depot":      { tier: "Primary",  leadTime: "1 day",     onTime: 96, contact: "Pickup · 1130 W North Ave" },
  "Sam's Club":            { tier: "Primary",  leadTime: "Same day",  onTime: 99, contact: "Member · #82-441" },
  "Webstaurant":           { tier: "Primary",  leadTime: "2 days",    onTime: 95, contact: "Online portal · Net-30" },
  "Costco":                { tier: "Primary",  leadTime: "Same day",  onTime: 98, contact: "Business member" },
  "Barista Underground":   { tier: "Watching", leadTime: "3 days",    onTime: 92, contact: "Wholesale account" },
  "Elmhurst":              { tier: "Trial",    leadTime: "5 days",    onTime: 88, contact: "Net-30 invoice" },
  "Monin Wholesale":       { tier: "Watching", leadTime: "4 days",    onTime: 94, contact: "Online portal" },
  "Rishi Tea":             { tier: "Primary",  leadTime: "2 days",    onTime: 98, contact: "Wholesale rep" },
};

function tierStyle(t: SupplierTier): CSSProperties | undefined {
  if (t === "Primary") return undefined; // handled via .tag.sub class
  if (t === "Trial") return { background: "rgba(200,137,58,.13)", color: "var(--warning)", borderColor: "rgba(200,137,58,.30)" };
  return undefined; // Watching uses default tag style
}
function tierClass(t: SupplierTier) {
  return t === "Primary" ? "sub" : "";
}

function initialsOf(name: string) {
  return name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function SuppliersTab() {
  const ingredients = useApp((s) => s.ingredients);
  const customSuppliers = useApp((s) => s.suppliers);
  const upsertSupplier = useApp((s) => s.upsertSupplier);
  const deleteSupplier = useApp((s) => s.deleteSupplier);

  const [editing, setEditing] = useState<Supplier | "new" | null>(null);

  // Items count + month spend signal per vendor name.
  const vendorStats = useMemo(() => {
    const m = new Map<string, { count: number }>();
    for (const i of ingredients) {
      const v = (i.vendor || "").trim();
      if (!v) continue;
      const cur = m.get(v) ?? { count: 0 };
      cur.count += 1;
      m.set(v, cur);
    }
    return m;
  }, [ingredients]);

  /** Combined list: every custom supplier first, then vendors that aren't already a custom supplier (by case-insensitive name). */
  const rows: SupplierRow[] = useMemo(() => {
    const customByName = new Set(customSuppliers.map((s) => s.name.trim().toLowerCase()));

    const customRows: SupplierRow[] = customSuppliers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => {
        const stats = vendorStats.get(s.name);
        return {
          id: s.id,
          isCustom: true,
          name: s.name,
          tier: s.tier,
          categories: s.categories?.length ? s.categories : ["Mixed"],
          leadTime: s.lead_time || "—",
          onTime: s.on_time_pct ?? 95,
          contact: s.contact || "—",
          items: stats?.count ?? 0,
          monthSpend: (stats?.count ?? 0) * 18,
          notes: s.notes,
          raw: s,
        };
      });

    const derived: SupplierRow[] = Array.from(vendorStats.entries())
      .filter(([name]) => !customByName.has(name.trim().toLowerCase()))
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, stats]) => {
        const metaKey = Object.keys(VENDOR_META).find((k) => name.toLowerCase().includes(k.toLowerCase()));
        const meta = metaKey ? VENDOR_META[metaKey] : {};
        return {
          isCustom: false,
          name,
          tier: (meta.tier as SupplierTier) ?? "Watching",
          categories: ["Mixed"],
          leadTime: meta.leadTime ?? "2–4 days",
          onTime: meta.onTime ?? 94,
          contact: meta.contact ?? "—",
          items: stats.count,
          monthSpend: stats.count * 18,
        };
      });

    return [...customRows, ...derived];
  }, [customSuppliers, vendorStats]);

  const totalSpend = rows.reduce((s, x) => s + x.monthSpend, 0);
  const avgOnTime = Math.round(
    rows.reduce((s, x) => s + x.onTime, 0) / Math.max(1, rows.length),
  );

  const customCount = customSuppliers.length;

  return (
    <div className="view">
      <div className="page-head fade-up">
        <Rainfield count={14} />
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>Suppliers</h1>
            <p className="subtle">Who you buy from, what you spend, and how reliable they are.</p>
          </div>
          <div className="head-stats">
            <div className="head-stat">
              <span className="v"><CountUp to={rows.length} /></span>
              <span className="l">total</span>
            </div>
            <div className="head-stat">
              <span className="v"><CountUp to={customCount} delay={80} /></span>
              <span className="l">custom</span>
            </div>
            <div className="head-stat">
              <span className="v">$<CountUp to={totalSpend} delay={160} /></span>
              <span className="l">month spend</span>
            </div>
            <div className="head-stat">
              <span className="v"><CountUp to={avgOnTime} delay={240} />%</span>
              <span className="l">on-time avg</span>
            </div>
            <button
              className="btn primary"
              style={{ alignSelf: "center", marginLeft: 8 }}
              onClick={() => setEditing("new")}
            >
              <I.Plus /> Add supplier
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="card fade-up" style={{ textAlign: "center", padding: 40 }}>
          <h3 style={{ marginBottom: 6 }}>No suppliers yet</h3>
          <p className="subtle" style={{ marginBottom: 18 }}>
            Add your first supplier to start tracking who you buy from and how reliable they are.
          </p>
          <button className="btn primary" onClick={() => setEditing("new")}>
            <I.Plus /> Add supplier
          </button>
        </div>
      )}

      <div className="rcards stagger" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {rows.map((s) => {
          const openCard = () => {
            if (s.isCustom && s.raw) {
              setEditing(s.raw);
            } else {
              // promote derived vendor to a real custom supplier (opens the modal pre-filled)
              setEditing({
                id: "",
                name: s.name,
                tier: s.tier,
                contact: s.contact === "—" ? "" : s.contact,
                lead_time: s.leadTime === "—" ? "" : s.leadTime,
                categories: s.categories.filter((c) => c !== "Mixed"),
                on_time_pct: s.onTime,
                created_at: "",
                updated_at: "",
              });
            }
          };
          return (
          <div
            key={(s.id ?? "v") + ":" + s.name}
            className="rcard"
            role="button"
            tabIndex={0}
            onClick={openCard}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCard();
              }
            }}
            style={{
              padding: 22,
              cursor: "pointer",
              borderLeft: s.isCustom ? "3px solid var(--cognac)" : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: s.isCustom
                  ? "linear-gradient(135deg, #A86F3D, #6E4422)"
                  : "linear-gradient(135deg, #7a8a8c, #4d5a5c)",
                color: "white", display: "grid", placeItems: "center",
                fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 500,
                boxShadow: "0 6px 14px -6px rgba(0,0,0,0.4)",
                flexShrink: 0,
              }}>
                {initialsOf(s.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h4 style={{ fontSize: 19 }}>{s.name}</h4>
                  <span className={`tag ${tierClass(s.tier)}`} style={tierStyle(s.tier)}>{s.tier}</span>
                  {s.isCustom ? (
                    <span className="tag" style={{ background: "rgba(168, 111, 61, 0.14)", color: "var(--cognac)" }}>
                      Custom
                    </span>
                  ) : (
                    <span className="tag" style={{ opacity: 0.65 }}>From ingredients</span>
                  )}
                </div>
                <div className="meta" style={{ marginTop: 4 }}>{s.contact}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {s.categories.map((c) => (
                    <span key={c} className="tag">{c}</span>
                  ))}
                </div>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                {s.isCustom && s.raw ? (
                  <>
                    <button
                      className="btn ghost"
                      title="Edit supplier"
                      aria-label="Edit supplier"
                      onClick={(e) => { e.stopPropagation(); setEditing(s.raw!); }}
                      style={{ color: "var(--text-2)" }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn ghost"
                      title="Delete supplier"
                      aria-label="Delete supplier"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete supplier "${s.name}"? This won't change any ingredients.`)) {
                          void deleteSupplier(s.id!);
                        }
                      }}
                      style={{ color: "var(--error)" }}
                    >
                      <I.X />
                    </button>
                  </>
                ) : (
                  <button
                    className="btn ghost"
                    title="Promote to custom supplier"
                    aria-label="Promote to custom supplier"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCard();
                    }}
                    style={{ color: "var(--text-2)" }}
                  >
                    <I.Plus /> Save
                  </button>
                )}
              </div>
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12, marginTop: 18, paddingTop: 16,
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}>
              <div>
                <div className="label-cap" style={{ fontSize: 9.5 }}>On-time</div>
                <div className="nums" style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: "var(--ink)" }}>
                  {s.onTime}
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Inter" }}>%</span>
                </div>
                <div style={{
                  width: "100%", height: 3,
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: 2, marginTop: 4, overflow: "hidden",
                }}>
                  <div style={{
                    width: `${s.onTime}%`, height: "100%",
                    background: s.onTime >= 95 ? "var(--success)" : s.onTime >= 90 ? "var(--warning)" : "var(--error)",
                    transition: "width 1s var(--ease)",
                  }}/>
                </div>
              </div>
              <div>
                <div className="label-cap" style={{ fontSize: 9.5 }}>Lead time</div>
                <div className="nums" style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: "var(--ink)" }}>{s.leadTime}</div>
              </div>
              <div>
                <div className="label-cap" style={{ fontSize: 9.5 }}>Items</div>
                <div className="nums" style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: "var(--ink)" }}>{s.items}</div>
              </div>
              <div>
                <div className="label-cap" style={{ fontSize: 9.5 }}>Month spend</div>
                <div className="nums" style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: "var(--ink)" }}>${s.monthSpend}</div>
              </div>
            </div>

            {s.notes && (
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: "1px solid rgba(0,0,0,0.06)",
                fontSize: 13, color: "var(--text-2)", fontStyle: "italic",
              }}>
                {s.notes}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {editing !== null && (
        <SupplierModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (s) => {
            await upsertSupplier(s);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  initial: Supplier | "new";
  onClose: () => void;
  onSave: (s: Omit<Supplier, "created_at" | "updated_at"> & { created_at?: string }) => Promise<void>;
}

function SupplierModal({ initial, onClose, onSave }: ModalProps) {
  const isNew = initial === "new" || (initial as Supplier).id === "";
  const init = initial === "new"
    ? { id: "", name: "", tier: "Watching" as SupplierTier, contact: "", lead_time: "", categories: [] as string[], on_time_pct: 95, notes: "" }
    : initial as Supplier;

  const [name, setName] = useState(init.name);
  const [tier, setTier] = useState<SupplierTier>(init.tier);
  const [contact, setContact] = useState(init.contact ?? "");
  const [leadTime, setLeadTime] = useState(init.lead_time ?? "");
  const [categoriesText, setCategoriesText] = useState((init.categories ?? []).join(", "));
  const [onTime, setOnTime] = useState<number>(init.on_time_pct ?? 95);
  const [notes, setNotes] = useState(init.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      const cats = categoriesText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const onTimeClamped = Math.max(0, Math.min(100, Math.round(onTime || 0)));
      await onSave({
        id: isNew ? "" : (initial as Supplier).id,
        name: trimmedName,
        tier,
        contact: contact.trim() || undefined,
        lead_time: leadTime.trim() || undefined,
        categories: cats.length ? cats : undefined,
        on_time_pct: onTimeClamped,
        notes: notes.trim() || undefined,
        ...(isNew ? {} : { created_at: (initial as Supplier).created_at }),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

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
        style={{
          width: "min(560px, 100%)",
          maxHeight: "90vh", overflow: "auto",
          padding: 0,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}>
          <h3 style={{ margin: 0 }}>{isNew ? "Add supplier" : "Edit supplier"}</h3>
          <button className="btn ghost" onClick={onClose} aria-label="Close">
            <I.X />
          </button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Name *</span>
            <input
              className="input-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Restaurant Depot"
              autoFocus
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="label-cap">Tier</span>
              <select
                className="input-base"
                value={tier}
                onChange={(e) => setTier(e.target.value as SupplierTier)}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="label-cap">On-time %</span>
              <input
                className="input-base"
                type="number"
                min={0}
                max={100}
                value={onTime}
                onChange={(e) => setOnTime(Number(e.target.value))}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Contact</span>
            <input
              className="input-base"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. Member · #82-441 or sales@vendor.com"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Lead time</span>
            <input
              className="input-base"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
              placeholder="e.g. Same day, 1 day, 3 days"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Categories</span>
            <input
              className="input-base"
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              placeholder="comma-separated · e.g. Dairy, Eggs, Dry goods"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="label-cap">Notes</span>
            <textarea
              className="input-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember about this supplier"
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
            {saving ? "Saving…" : (isNew ? "Add supplier" : "Save changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
