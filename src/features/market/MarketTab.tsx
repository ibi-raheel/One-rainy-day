import { useEffect, useMemo, useState } from "react";
import { api } from "@/db/api";
import { useApp } from "@/store/app";
import { I } from "@/components/design/Icons";
import { Spark } from "@/components/design/Spark";
import { Rainfield } from "@/components/design/Rain";
import { ApplyToIngredientDialog } from "./ApplyToIngredientDialog";
import type { MarketProductLite } from "./applyMarketProduct";

interface MarketProduct {
  id: string;
  source_id: string;
  source_name: string;
  title: string;
  vendor: string | null;
  url: string;
  variant_title: string | null;
  pack_size_text: string;
  price: number;
  compare_at_price: number | null;
  on_sale: boolean;
  discount_pct: number;
  available: boolean;
  pack: { count: number; oz: number | null; ml: number | null; g: number | null };
  per_g: number | null;
  per_ml: number | null;
  per_oz: number | null;
  fetched_at: string;
}

interface MarketMatch {
  ingredient_id: string;
  ingredient_name: string;
  base_unit: "g" | "ml" | "piece";
  her_per_base: number;
  candidates: Array<{
    product_id: string;
    score: number;
    confidence: "high" | "medium" | "low";
    estimated_per_base_unit: number | null;
    delta_pct: number | null;
  }>;
}

interface MarketSource { id: string; name: string; products: number; ok: boolean; error?: string }

interface MarketSnapshot {
  fetched_at: string | null;
  products: MarketProduct[];
  sources: MarketSource[];
  errors: { source: string; error: string }[];
  matches: MarketMatch[];
  sources_available: { id: string; name: string }[];
}

/** Demo commodity series — until FRED/BLS scrape lands. */
const COMMODITIES = [
  { name: "Whole milk CPI",        latest: "$4.06/gal",        changePct: -4.2, series: [4.30, 4.28, 4.31, 4.27, 4.22, 4.15, 4.10, 4.06] },
  { name: "Eggs, large grade A",   latest: "$3.21/doz",        changePct:  2.8, series: [2.95, 3.00, 3.05, 3.08, 3.10, 3.14, 3.18, 3.21] },
  { name: "Coffee, arabica",       latest: "$4.18/lb",         changePct:  6.1, series: [3.80, 3.85, 3.90, 3.95, 4.00, 4.06, 4.12, 4.18] },
  { name: "Heavy cream wholesale", latest: "$8.40/half-gal",   changePct:  3.4, series: [7.95, 8.00, 8.05, 8.10, 8.18, 8.25, 8.34, 8.40] },
];

export function MarketTab() {
  useApp((s) => s.ingredients); // re-render on ingredient change
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [yoursFilter, setYoursFilter] = useState<"all" | "cheaper" | "onsale">("all");
  const [browseTab, setBrowseTab] = useState<"yours" | "sales" | "browse">("yours");
  const [browseQuery, setBrowseQuery] = useState("");
  const [applyTarget, setApplyTarget] = useState<{ ingredientId: string; product: MarketProductLite } | null>(null);

  useEffect(() => {
    api
      .loadMarket()
      .then((s) => {
        setSnapshot(s as MarketSnapshot);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshMarket();
      const fresh = await api.loadMarket();
      setSnapshot(fresh as MarketSnapshot);
    } catch (e) {
      alert(`Refresh failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setRefreshing(false);
    }
  };

  const productsById = useMemo(() => {
    const m = new Map<string, MarketProduct>();
    if (snapshot) for (const p of snapshot.products) m.set(p.id, p);
    return m;
  }, [snapshot]);

  // Build the alerts list (cheaper-than-yours) from matches
  const alerts = useMemo(() => {
    if (!snapshot) return [] as Array<{ match: MarketMatch; best: MarketMatch["candidates"][number]; product: MarketProduct }>;
    const out: Array<{ match: MarketMatch; best: MarketMatch["candidates"][number]; product: MarketProduct }> = [];
    for (const m of snapshot.matches) {
      const best = m.candidates.find((c) => c.delta_pct != null && c.delta_pct < -3 && c.confidence !== "low");
      if (best) {
        const p = productsById.get(best.product_id);
        if (p) out.push({ match: m, best, product: p });
      }
    }
    return out.slice(0, 6);
  }, [snapshot, productsById]);

  // Active sales — every available product with on_sale=true, ranked by discount.
  const onSaleProducts = useMemo(() => {
    if (!snapshot) return [] as MarketProduct[];
    return [...snapshot.products]
      .filter((p) => p.on_sale && p.available)
      .sort((a, b) => b.discount_pct - a.discount_pct)
      .slice(0, 60);
  }, [snapshot]);

  // Browse — search across every product
  const browseProducts = useMemo(() => {
    if (!snapshot) return [] as MarketProduct[];
    const q = browseQuery.trim().toLowerCase();
    if (!q) return snapshot.products.slice(0, 80);
    return snapshot.products
      .filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.vendor ?? "").toLowerCase().includes(q) ||
        p.source_name.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [snapshot, browseQuery]);

  // Your ingredients table — every ingredient with at least one market match.
  // When no match exists, the row still shows her current cost. The user can
  // filter to cheaper-than-yours or only-on-sale.
  const yoursRows = useMemo(() => {
    if (!snapshot) return [] as Array<{ ingredient: string; her: number; best: number | null; supplier: string; delta: number | null; product: MarketProduct | null; ingredient_id: string; base_unit: string; on_sale: boolean }>;
    const rows = snapshot.matches.map((m) => {
      const best = m.candidates.find((c) => c.estimated_per_base_unit != null);
      const product = best ? productsById.get(best.product_id) ?? null : null;
      return {
        ingredient: m.ingredient_name,
        ingredient_id: m.ingredient_id,
        base_unit: m.base_unit,
        her: m.her_per_base,
        best: best?.estimated_per_base_unit ?? null,
        supplier: product?.source_name ?? "—",
        delta: best?.delta_pct ?? null,
        product,
        on_sale: !!product?.on_sale,
      };
    });
    const filtered = rows.filter((r) => {
      if (yoursFilter === "cheaper") return r.delta != null && r.delta < -0.5;
      if (yoursFilter === "onsale") return r.on_sale;
      return true;
    });
    // Sort: cheaper-deltas first, then no-match rows last
    filtered.sort((a, b) => {
      const ad = a.delta ?? 999;
      const bd = b.delta ?? 999;
      return ad - bd;
    });
    return filtered;
  }, [snapshot, productsById, yoursFilter]);

  if (loading) {
    return (
      <div className="view">
        <div className="page-head fade-up">
          <Rainfield count={14} />
          <div className="head-row">
            <div style={{ flex: 1 }}><h1>Market</h1><p className="subtle">Loading market data…</p></div>
          </div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          Working…
        </div>
      </div>
    );
  }

  // Empty (never refreshed) state
  if (!snapshot || snapshot.fetched_at == null) {
    return (
      <div className="view">
        <div className="page-head fade-up">
          <Rainfield count={14} />
          <div className="head-row">
            <div style={{ flex: 1 }}>
              <h1>Market</h1>
              <p className="subtle">Pull current prices from public Shopify wholesalers — Barista Underground, Westrock, Elmhurst, Rishi, Monin.</p>
            </div>
            <div className="head-stats">
              <button className="btn primary" onClick={refresh} disabled={refreshing}>
                {refreshing ? "Pulling…" : <><I.Refresh /> Refresh</>}
              </button>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          No market data yet. Hit Refresh — takes about 20 seconds.
        </div>
      </div>
    );
  }

  const fetched = new Date(snapshot.fetched_at);
  const minutesAgo = Math.round((Date.now() - fetched.getTime()) / 60000);
  const ago = minutesAgo < 1 ? "just now" : minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.round(minutesAgo / 60)}h ago`;

  return (
    <div className="view">
      <div className="page-head fade-up">
        <Rainfield count={14} />
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>Market</h1>
            <p className="subtle">
              Commodity prices, public listings, and where to spend less. Last refresh{" "}
              <strong>{ago}</strong>.
            </p>
          </div>
          <div className="head-stats">
            <button className="btn primary" onClick={refresh} disabled={refreshing}>
              <I.Refresh /> {refreshing ? "Refreshing…" : "Refresh prices"}
            </button>
          </div>
        </div>
      </div>

      {/* Top alerts */}
      <div className="card fade-up" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h3>Top alerts</h3>
          <span className="card-sub">actionable price moves</span>
        </div>
        <div className="alerts">
          {alerts.length === 0 && (
            <div style={{ padding: 22, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No cheaper alternatives found in the latest scrape. Either you're already getting the
              best public price, or your specialty ingredients aren't carried by these wholesalers.
            </div>
          )}
          {alerts.map(({ match, best, product }) => (
            <div
              key={match.ingredient_id}
              className="alert good"
              onClick={() => setApplyTarget({
                ingredientId: match.ingredient_id,
                product: {
                  source_name: product.source_name,
                  title: product.title,
                  pack_size_text: product.pack_size_text,
                  price: product.price,
                  pack: product.pack,
                  per_g: product.per_g,
                  per_ml: product.per_ml,
                  url: product.url,
                },
              })}
            >
              <span className="dot" />
              <div>
                <div className="a-title">
                  {match.ingredient_name} — {best.delta_pct!.toFixed(0)}% cheaper at {product.source_name}
                </div>
                <div className="a-body">
                  Public listing {fmtMoney(product.price)} ({product.pack_size_text}) vs your saved cost of{" "}
                  {fmtMoney(match.her_per_base)}/{match.base_unit}.
                </div>
              </div>
              <span className="a-cta">Apply <I.ArrowR /></span>
            </div>
          ))}
          {/* Static commodity-driven alerts mirror the design */}
          <div className="alert good">
            <span className="dot" />
            <div>
              <div className="a-title">Whole milk CPI down 4.2% MoM</div>
              <div className="a-body">Renegotiate Sam's standing order. Suggested ask: $3.32/gal (vs current $3.48).</div>
            </div>
            <span className="a-cta">Open script <I.ArrowR /></span>
          </div>
          <div className="alert warn">
            <span className="dot" />
            <div>
              <div className="a-title">Coffee, arabica up 6.1% MoM</div>
              <div className="a-body">Up 4 months running. Consider locking your espresso bean price.</div>
            </div>
            <span className="a-cta">Lock-in <I.ArrowR /></span>
          </div>
        </div>
      </div>

      {/* Commodities grid */}
      <div className="section-title">
        <h2>Commodities</h2>
        <span className="meta">FRED & BLS · last 18 months · sparklines show last 8</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        {COMMODITIES.map((c, i) => {
          const down = c.changePct < 0;
          const color = down ? "#506B45" : c.changePct > 4 ? "#A85540" : "#C8893A";
          return (
            <div key={c.name} className="commodity fade-up" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <div className="name">{c.name}</div>
              <div className="v">{c.latest}</div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className={`trend-chip ${down ? "down" : "up"}`}>
                  {down ? <I.Down /> : <I.Up />} {Math.abs(c.changePct).toFixed(1)}% MoM
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Spark data={c.series} width={220} height={56} color={color} delay={0.3 + i * 0.06} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabbed product browser: Your ingredients / Active sales / Browse */}
      <div className="card fade-up">
        <div className="card-head">
          <h3>
            {browseTab === "yours"
              ? "Your ingredients"
              : browseTab === "sales"
              ? "Active sales"
              : "Browse all products"}
          </h3>
          <span className="card-sub">
            {browseTab === "yours"
              ? "your prices vs the market"
              : browseTab === "sales"
              ? `${onSaleProducts.length} on sale right now`
              : `${browseProducts.length} of ${snapshot.products.length}`}
          </span>
          <div className="right">
            <div className="segmented">
              <button
                className={browseTab === "yours" ? "on" : ""}
                onClick={() => setBrowseTab("yours")}
              >
                Your ingredients ({snapshot.matches.length})
              </button>
              <button
                className={browseTab === "sales" ? "on" : ""}
                onClick={() => setBrowseTab("sales")}
              >
                Active sales ({onSaleProducts.length})
              </button>
              <button
                className={browseTab === "browse" ? "on" : ""}
                onClick={() => setBrowseTab("browse")}
              >
                Browse
              </button>
            </div>
            {browseTab === "yours" && (
              <div className="segmented" style={{ marginLeft: 8 }}>
                <button
                  className={yoursFilter === "all" ? "on" : ""}
                  onClick={() => setYoursFilter("all")}
                >All</button>
                <button
                  className={yoursFilter === "cheaper" ? "on" : ""}
                  onClick={() => setYoursFilter("cheaper")}
                >Cheaper</button>
                <button
                  className={yoursFilter === "onsale" ? "on" : ""}
                  onClick={() => setYoursFilter("onsale")}
                >On sale</button>
              </div>
            )}
          </div>
        </div>

        {browseTab === "browse" && (
          <div style={{ padding: "12px 20px 0" }}>
            <div style={{ position: "relative", maxWidth: 380 }}>
              <span
                style={{
                  position: "absolute",
                  left: 11,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                  display: "inline-flex",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/>
                  <path d="M21 21l-4.3-4.3"/>
                </svg>
              </span>
              <input
                className="input-base"
                placeholder="Search products by name, vendor, or source…"
                value={browseQuery}
                onChange={(e) => setBrowseQuery(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>
        )}

        {browseTab === "yours" && (
          <table className="tbl nums">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th className="r">Your price</th>
              <th className="r">Cheapest public</th>
              <th>Supplier</th>
              <th className="r">Δ</th>
              <th className="r"></th>
            </tr>
          </thead>
          <tbody>
            {yoursRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                  No matches yet. Refresh, or check your ingredient names match common public listings.
                </td>
              </tr>
            ) : (
              yoursRows.map((row) => (
                <tr key={row.ingredient_id}>
                  <td className="name-cell">{row.ingredient}</td>
                  <td className="r">{fmtMoney(row.her)}/{row.base_unit}</td>
                  <td className="r">
                    <strong style={{ color: row.delta != null && row.delta < 0 ? "var(--success)" : "var(--text)" }}>
                      {row.best != null ? `${fmtMoney(row.best)}/${row.base_unit}` : "—"}
                    </strong>
                  </td>
                  <td>{row.supplier}</td>
                  <td className="r">
                    {row.delta == null ? (
                      <span className="muted">—</span>
                    ) : Math.abs(row.delta) < 0.5 ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className={`pill ${row.delta < 0 ? "green" : "red"}`}>
                        {row.delta > 0 ? "+" : ""}
                        {row.delta.toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="r">
                    {row.product && row.delta != null && row.delta < 0 ? (
                      <button
                        className="btn"
                        onClick={() =>
                          row.product &&
                          setApplyTarget({
                            ingredientId: row.ingredient_id,
                            product: {
                              source_name: row.product.source_name,
                              title: row.product.title,
                              pack_size_text: row.product.pack_size_text,
                              price: row.product.price,
                              pack: row.product.pack,
                              per_g: row.product.per_g,
                              per_ml: row.product.per_ml,
                              url: row.product.url,
                            },
                          })
                        }
                      >
                        Apply
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>match</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}

        {browseTab === "sales" && (
          <table className="tbl nums">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Discount</th>
                <th>Product</th>
                <th>Source</th>
                <th className="r">Sale price</th>
                <th className="r">Was</th>
                <th className="r"></th>
              </tr>
            </thead>
            <tbody>
              {onSaleProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    Nothing on sale at any source right now. Try Refresh — sources update at different times.
                  </td>
                </tr>
              ) : (
                onSaleProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span
                        className={`pill ${p.discount_pct >= 30 ? "red" : p.discount_pct >= 15 ? "amber" : "cool"}`}
                      >
                        −{p.discount_pct}%
                      </span>
                    </td>
                    <td className="name-cell">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--ink)", textDecoration: "none" }}
                      >
                        {p.title}
                      </a>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {p.pack_size_text}
                        {p.vendor ? ` · ${p.vendor}` : ""}
                      </div>
                    </td>
                    <td>{p.source_name}</td>
                    <td className="r" style={{ color: "var(--success)", fontWeight: 500 }}>
                      ${p.price.toFixed(2)}
                    </td>
                    <td className="r muted" style={{ textDecoration: "line-through" }}>
                      ${p.compare_at_price?.toFixed(2)}
                    </td>
                    <td className="r">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ textDecoration: "none" }}
                      >
                        View <I.ArrowR />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {browseTab === "browse" && (
          <table className="tbl nums">
            <thead>
              <tr>
                <th>Product</th>
                <th>Source</th>
                <th>Pack</th>
                <th className="r">Price</th>
                <th className="r"></th>
              </tr>
            </thead>
            <tbody>
              {browseProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    No matches. Try a different search.
                  </td>
                </tr>
              ) : (
                browseProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="name-cell">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--ink)", textDecoration: "none" }}
                      >
                        {p.title}
                      </a>
                      {p.vendor && (
                        <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                          {p.vendor}
                        </div>
                      )}
                    </td>
                    <td>{p.source_name}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{p.pack_size_text || "—"}</td>
                    <td className="r" style={{ fontWeight: 500 }}>
                      ${p.price.toFixed(2)}
                      {p.on_sale && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: "var(--warning)" }}>
                          −{p.discount_pct}%
                        </span>
                      )}
                    </td>
                    <td className="r">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                        style={{ textDecoration: "none" }}
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {applyTarget && (
        <ApplyToIngredientDialog
          open={!!applyTarget}
          onOpenChange={(o) => { if (!o) setApplyTarget(null); }}
          ingredientId={applyTarget.ingredientId}
          product={applyTarget.product}
        />
      )}
    </div>
  );
}

function fmtMoney(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) < 0.01 && n !== 0) return `$${n.toFixed(4)}`;
  if (Math.abs(n) < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
