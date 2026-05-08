import { useMemo } from "react";
import { useApp } from "@/store/app";
import { I } from "@/components/design/Icons";
import { CountUp } from "@/components/design/CountUp";
import { Rainfield } from "@/components/design/Rain";

interface SupplierRow {
  name: string;
  tier: "Primary" | "Watching" | "Trial";
  categories: string[];
  leadTime: string;
  onTime: number;
  lastOrder: string;
  lastTotal: number;
  monthSpend: number;
  contact: string;
  items: number;
}

/** A few enrichment signals used to pad demo-ish data on top of real ingredient vendors. */
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

const DEFAULT_SUPPLIERS: SupplierRow[] = [
  { name: "Restaurant Depot",    tier: "Primary",  categories: ["Proteins", "Dairy", "Dry goods"], leadTime: "1 day",    onTime: 96, lastOrder: "May 7",  lastTotal: 182.40, monthSpend: 1240, contact: "Pickup · 1130 W North Ave",  items: 38 },
  { name: "Sam's Club",          tier: "Primary",  categories: ["Dairy", "Eggs", "Bulk"],          leadTime: "Same day", onTime: 99, lastOrder: "May 7",  lastTotal:  96.18, monthSpend:  820, contact: "Member · #82-441",            items: 22 },
  { name: "Barista Underground", tier: "Watching", categories: ["Coffee", "Matcha"],               leadTime: "3 days",   onTime: 92, lastOrder: "Apr 28", lastTotal: 248.00, monthSpend:  496, contact: "Wholesale account",           items:  6 },
  { name: "Elmhurst",            tier: "Trial",    categories: ["Alt-milks"],                      leadTime: "5 days",   onTime: 88, lastOrder: "Apr 14", lastTotal:  62.40, monthSpend:  124, contact: "Net-30 invoice",              items:  3 },
  { name: "Monin Wholesale",     tier: "Watching", categories: ["Syrups"],                         leadTime: "4 days",   onTime: 94, lastOrder: "Apr 22", lastTotal:  54.00, monthSpend:  108, contact: "Online portal",               items:  8 },
  { name: "Rishi Tea",           tier: "Primary",  categories: ["Tea", "Matcha"],                  leadTime: "2 days",   onTime: 98, lastOrder: "Apr 30", lastTotal: 168.00, monthSpend:  336, contact: "Wholesale rep",               items: 11 },
];

function deriveSuppliers(vendors: Map<string, number>): SupplierRow[] {
  if (vendors.size === 0) return DEFAULT_SUPPLIERS;
  const out: SupplierRow[] = [];
  // Pull just the top 6 vendors by item count
  const sorted = Array.from(vendors.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  for (const [name, count] of sorted) {
    // Try to find a matching tier from VENDOR_META by substring
    const metaKey = Object.keys(VENDOR_META).find((k) => name.toLowerCase().includes(k.toLowerCase()));
    const meta = metaKey ? VENDOR_META[metaKey] : {};
    out.push({
      name,
      tier: (meta.tier as SupplierRow["tier"]) ?? "Watching",
      categories: ["Mixed"],
      leadTime: meta.leadTime ?? "2–4 days",
      onTime: meta.onTime ?? 94,
      lastOrder: "Apr 30",
      lastTotal: 124,
      monthSpend: count * 18,
      contact: meta.contact ?? "—",
      items: count,
    });
  }
  return out;
}

export function SuppliersTab() {
  const ingredients = useApp((s) => s.ingredients);

  const suppliers = useMemo(() => {
    const vendorCount = new Map<string, number>();
    for (const i of ingredients) {
      const v = (i.vendor || "(no supplier)").trim();
      vendorCount.set(v, (vendorCount.get(v) ?? 0) + 1);
    }
    return deriveSuppliers(vendorCount);
  }, [ingredients]);

  const totalSpend = suppliers.reduce((s, x) => s + x.monthSpend, 0);
  const avgOnTime = Math.round(
    suppliers.reduce((s, x) => s + x.onTime, 0) / Math.max(1, suppliers.length)
  );

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
              <span className="v"><CountUp to={suppliers.length} /></span>
              <span className="l">active</span>
            </div>
            <div className="head-stat">
              <span className="v">$<CountUp to={totalSpend} delay={120} /></span>
              <span className="l">month spend</span>
            </div>
            <div className="head-stat">
              <span className="v"><CountUp to={avgOnTime} delay={240} />%</span>
              <span className="l">on-time avg</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rcards stagger" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {suppliers.map((s) => (
          <div key={s.name} className="rcard" style={{ padding: 22, cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: "linear-gradient(135deg, #A86F3D, #6E4422)",
                color: "white", display: "grid", placeItems: "center",
                fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 500,
                boxShadow: "0 6px 14px -6px rgba(0,0,0,0.4)",
                flexShrink: 0,
              }}>
                {s.name
                  .split(/[\s/]+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h4 style={{ fontSize: 19 }}>{s.name}</h4>
                  <span className={`tag ${s.tier === "Primary" ? "sub" : ""}`}>{s.tier}</span>
                </div>
                <div className="meta" style={{ marginTop: 4 }}>{s.contact}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {s.categories.map((c) => (
                    <span key={c} className="tag">{c}</span>
                  ))}
                </div>
              </div>
              <button
                className="btn ghost"
                style={{ color: "var(--text-2)", flexShrink: 0 }}
                aria-label="Open supplier"
              >
                <I.ArrowR />
              </button>
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

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 14, paddingTop: 12,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              fontSize: 12.5, color: "var(--text-2)",
            }}>
              <span>
                Last order <strong style={{ color: "var(--ink)" }}>{s.lastOrder}</strong> · ${s.lastTotal.toFixed(2)}
              </span>
              <button className="btn">Open</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card fade-up" style={{ marginTop: 22, animationDelay: ".4s" }}>
        <div className="card-head">
          <h3>Recent activity</h3>
          <span className="card-sub">last 7 days across suppliers</span>
        </div>
        <div className="alerts">
          <div className="alert good">
            <span className="dot" />
            <div>
              <div className="a-title">Restaurant Depot · invoice $182.40 logged</div>
              <div className="a-body">14 line items · 12 auto-matched · 2 need review.</div>
            </div>
            <span className="a-cta">Review <I.ArrowR /></span>
          </div>
          <div className="alert warn">
            <span className="dot" />
            <div>
              <div className="a-title">Barista Underground arrived 1 day late</div>
              <div className="a-body">Matcha shipment delayed. On-time rate dropped from 94% → 92%.</div>
            </div>
            <span className="a-cta">Note <I.ArrowR /></span>
          </div>
          <div className="alert good">
            <span className="dot" />
            <div>
              <div className="a-title">Sam's Club · 5 prices updated from receipt</div>
              <div className="a-body">Whole milk −2.1%, eggs +1.4%, heavy cream +3.2%.</div>
            </div>
            <span className="a-cta">View <I.ArrowR /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
