import { useEffect, useMemo, useState } from "react";
import { api } from "@/db/api";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/cost";
import {
  RefreshCw, Search, ExternalLink, AlertTriangle, ArrowDownRight, ArrowUpRight,
  Tag, Sparkles, Store, Loader2, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ApplyToIngredientDialog } from "./ApplyToIngredientDialog";
import type { MarketProductLite } from "./applyMarketProduct";
import { TabHero } from "@/components/ui/TabHero";

interface MarketProduct {
  id: string;
  source_id: string;
  source_name: string;
  title: string;
  vendor: string | null;
  product_type: string | null;
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

interface MarketSource {
  id: string;
  name: string;
  products: number;
  pages: number;
  ok: boolean;
  error?: string;
}

interface MarketSnapshot {
  fetched_at: string | null;
  products: MarketProduct[];
  sources: MarketSource[];
  errors: { source: string; error: string }[];
  matches: MarketMatch[];
  sources_available: { id: string; name: string }[];
}

type MarketView = "alerts" | "sales" | "compare" | "browse";

export function MarketTab() {
  const ingredients = useApp((s) => s.ingredients);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<MarketView>("alerts");
  const [applyTarget, setApplyTarget] = useState<{ ingredientId: string; product: MarketProductLite } | null>(null);

  useEffect(() => {
    api.loadMarket().then((s) => {
      setSnapshot(s as MarketSnapshot);
      setLoading(false);
    }).catch(() => setLoading(false));
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
    const map = new Map<string, MarketProduct>();
    if (snapshot) for (const p of snapshot.products) map.set(p.id, p);
    return map;
  }, [snapshot]);

  if (loading) {
    return (
      <>
        <TabHero
          title="Market"
          subtitle="Where prices are cheapest, right now."
          accent="info"
          icon={<Store className="h-7 w-7" strokeWidth={1.4} />}
        />
        <div className="card flex items-center justify-center py-16 text-text-muted gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading market data…
        </div>
      </>
    );
  }

  if (!snapshot || snapshot.fetched_at == null) {
    return (
      <>
        <TabHero
          title="Market"
          subtitle="Where prices are cheapest, right now."
          accent="info"
          icon={<Store className="h-7 w-7" strokeWidth={1.4} />}
        />
        <EmptyState
          title="No market data yet"
          description="Pull current prices from Barista Underground, Westrock, Elmhurst, Rishi, and Monin. Takes about 20 seconds."
          action={
            <Button onClick={refresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <RefreshCw className="h-4 w-4" strokeWidth={1.5} />}
              {refreshing ? "Pulling prices…" : "Refresh market data"}
            </Button>
          }
        />
      </>
    );
  }

  const fetched = new Date(snapshot.fetched_at);
  const minutesAgo = Math.round((Date.now() - fetched.getTime()) / 60000);
  const ago = minutesAgo < 1 ? "just now" : minutesAgo < 60 ? `${minutesAgo} min ago` : `${Math.round(minutesAgo / 60)} hr ago`;

  const onSale = snapshot.products.filter((p) => p.on_sale && p.available);
  onSale.sort((a, b) => b.discount_pct - a.discount_pct);

  // Cheaper-than-her ingredient alerts: candidates with negative delta (i.e. cheaper)
  const alerts = snapshot.matches
    .map((m) => {
      const best = m.candidates.find(
        (c) => c.delta_pct != null && c.delta_pct < -3 && c.confidence !== "low"
      );
      return best ? { match: m, best } : null;
    })
    .filter(Boolean) as Array<{ match: MarketMatch; best: MarketMatch["candidates"][number] }>;

  return (
    <div className="space-y-6">
      <TabHero
        title="Market"
        subtitle={`Last fetched ${ago} · ${snapshot.products.length} products`}
        accent="info"
        icon={<Store className="h-7 w-7" strokeWidth={1.4} />}
        stats={[
          { label: "products", value: snapshot.products.length, accent: "info" },
          { label: "on sale",  value: onSale.length,            accent: "warning" },
          { label: "alerts",   value: alerts.length,            accent: "success" },
        ]}
        action={
          <Button variant="ghost" onClick={refresh} disabled={refreshing} size="sm">
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {refreshing ? "Refreshing…" : "Refresh prices"}
          </Button>
        }
      />

      {/* View tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "alerts" as const, label: `Cheaper-than-yours (${alerts.length})`, icon: <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> },
          { id: "sales" as const, label: `Active sales (${onSale.length})`, icon: <Tag className="h-3.5 w-3.5" strokeWidth={1.5} /> },
          { id: "compare" as const, label: `Per ingredient (${snapshot.matches.length})`, icon: <Store className="h-3.5 w-3.5" strokeWidth={1.5} /> },
          { id: "browse" as const, label: "Browse all", icon: <Search className="h-3.5 w-3.5" strokeWidth={1.5} /> },
        ]).map((t) => {
          const active = t.id === view;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={cn(
                "px-3 pt-2 pb-2.5 text-sm rounded-t-md flex items-center gap-1.5 transition-colors",
                active
                  ? "bg-info/10 text-text-primary border-b-2 border-info -mb-px"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-surfaceAlt/60"
              )}
            >
              <span className={active ? "text-info" : "text-text-muted"}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {view === "alerts" && (
        <AlertsView
          alerts={alerts}
          productsById={productsById}
          ingredients={ingredients}
          onApply={(ingredientId, product) => setApplyTarget({ ingredientId, product })}
        />
      )}
      {view === "sales" && <SalesView products={onSale.slice(0, 60)} />}
      {view === "compare" && (
        <CompareView
          matches={snapshot.matches}
          productsById={productsById}
          onApply={(ingredientId, product) => setApplyTarget({ ingredientId, product })}
        />
      )}
      {view === "browse" && <BrowseView products={snapshot.products} />}

      {applyTarget && (
        <ApplyToIngredientDialog
          open={!!applyTarget}
          onOpenChange={(o) => { if (!o) setApplyTarget(null); }}
          ingredientId={applyTarget.ingredientId}
          product={applyTarget.product}
        />
      )}

      {/* Source list */}
      <div className="card px-5 py-4">
        <div className="label-cap mb-2">Sources</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {snapshot.sources.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                s.ok ? "bg-bg-surfaceAlt border-border" : "bg-error/5 border-error/30"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", s.ok ? "bg-success" : "bg-error")} />
              <span className="text-text-primary truncate flex-1">{s.name}</span>
              <span className="text-xs text-text-muted nums">
                {s.ok ? `${s.products}` : "error"}
              </span>
            </div>
          ))}
        </div>
        {snapshot.errors.length > 0 && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-text-secondary">
              {snapshot.errors.length} error{snapshot.errors.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-1.5 space-y-0.5 text-text-muted">
              {snapshot.errors.map((e, i) => (
                <li key={i}>· {e.source}: {e.error}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

// ──────── Alerts view: ingredients where cheaper public option exists ────────

function AlertsView({
  alerts,
  productsById,
  ingredients,
  onApply,
}: {
  alerts: Array<{ match: MarketMatch; best: MarketMatch["candidates"][number] }>;
  productsById: Map<string, MarketProduct>;
  ingredients: { id: string; name: string }[];
  onApply: (ingredientId: string, product: MarketProductLite) => void;
}) {
  if (alerts.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <Sparkles className="h-8 w-8 mx-auto text-text-muted mb-3" strokeWidth={1.2} />
        <h3 className="display text-lg text-text-primary">No cheaper alternatives found</h3>
        <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
          Either you're already getting the best public prices on what you buy, or your specialty
          ingredients aren't carried by the public Shopify wholesalers we scan. The "Per ingredient"
          tab shows the full match table for transparency.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {alerts.map(({ match, best }) => {
        const product = productsById.get(best.product_id);
        if (!product) return null;
        return (
          <div
            key={match.ingredient_id}
            className="card relative overflow-hidden p-4"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-success" />
            <div className="pl-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-text-muted">Could be cheaper</div>
                <div className="display text-base text-text-primary mt-0.5">{match.ingredient_name}</div>
                <div className="mt-2 text-sm">
                  Your saved cost:{" "}
                  <span className="nums">{formatMoney(match.her_per_base)}</span>
                  <span className="text-text-muted">/{match.base_unit}</span>
                </div>
                <div className="mt-1 text-sm flex items-center gap-2 flex-wrap">
                  <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline truncate">
                    {product.title}
                  </a>
                  <span className="text-xs text-text-muted">@ {product.source_name}</span>
                  {product.on_sale && (
                    <span className="rounded-sm bg-warning/15 text-warning text-[10px] px-1.5 py-0.5">SALE −{product.discount_pct}%</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-text-muted nums">
                  {product.pack_size_text || "—"} · {formatMoney(product.price)}
                  {best.estimated_per_base_unit != null && (
                    <span> · est. {formatMoney(best.estimated_per_base_unit)}/{match.base_unit}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                <div>
                  <div className="hero-num text-xl text-success nums">
                    {best.delta_pct!.toFixed(0)}%
                  </div>
                  <div className="text-xs text-text-muted">cheaper</div>
                </div>
                <button
                  type="button"
                  onClick={() => onApply(match.ingredient_id, product)}
                  className="btn-primary !py-1 !px-2.5 text-xs"
                  title={`Apply this product's price to ${match.ingredient_name}`}
                >
                  <CheckCircle2 className="h-3 w-3" strokeWidth={1.8} />
                  Apply to my ingredient
                </button>
                <a href={product.url} target="_blank" rel="noopener noreferrer" className="btn-text text-xs">
                  <ExternalLink className="h-3 w-3" strokeWidth={1.5} /> view
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────── Sales view: everything currently on sale, ranked by discount ────────

function SalesView({ products }: { products: MarketProduct[] }) {
  if (products.length === 0) {
    return <EmptyState title="No active sales right now" description="Try refreshing — sources update at different times." />;
  }
  return (
    <div className="space-y-2">
      {products.map((p) => (
        <div key={p.id} className="card flex items-center gap-3 px-4 py-3">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs hero-num shrink-0",
              p.discount_pct >= 30
                ? "bg-error/15 text-error"
                : p.discount_pct >= 15
                ? "bg-warning/15 text-warning"
                : "bg-bg-surfaceAlt text-text-secondary"
            )}
          >
            −{p.discount_pct}%
          </span>
          <div className="min-w-0 flex-1">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm text-text-primary hover:text-accent truncate block">
              {p.title}
            </a>
            <div className="text-xs text-text-muted truncate">
              {p.pack_size_text}
              {p.vendor && <span className="ml-1">· {p.vendor}</span>}
              <span className="ml-1">· {p.source_name}</span>
            </div>
          </div>
          <div className="text-right shrink-0 nums">
            <div className="text-sm text-success font-medium">{formatMoney(p.price)}</div>
            {p.compare_at_price && (
              <div className="text-xs text-text-muted line-through">{formatMoney(p.compare_at_price)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────── Compare view: every ingredient, all candidates ────────

function CompareView({
  matches,
  productsById,
  onApply,
}: {
  matches: MarketMatch[];
  productsById: Map<string, MarketProduct>;
  onApply: (ingredientId: string, product: MarketProductLite) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return matches
      .filter((m) => m.candidates.length > 0 && (!q || m.ingredient_name.toLowerCase().includes(q)))
      .sort((a, b) => {
        const aBest = a.candidates[0]?.delta_pct ?? Infinity;
        const bBest = b.candidates[0]?.delta_pct ?? Infinity;
        return aBest - bBest;
      });
  }, [matches, query]);

  const unmatched = matches.filter((m) => m.candidates.length === 0);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" strokeWidth={1.5} />
        <Input placeholder="Search ingredients…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      <div className="space-y-3">
        {filtered.map((m) => (
          <details key={m.ingredient_id} className="card overflow-hidden">
            <summary className="cursor-pointer px-4 py-3 flex items-center gap-3 hover:bg-bg-surfaceAlt/60">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate">{m.ingredient_name}</div>
                <div className="text-xs text-text-muted nums">
                  Your: {formatMoney(m.her_per_base)}/{m.base_unit}
                  {" · "}
                  {m.candidates.length} match{m.candidates.length === 1 ? "" : "es"}
                </div>
              </div>
              <BestDelta candidates={m.candidates} />
            </summary>
            <div className="border-t border-border bg-bg-surfaceAlt/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="label-cap text-left px-4 py-2">Product</th>
                    <th className="label-cap text-left px-3 py-2">Source</th>
                    <th className="label-cap text-right px-3 py-2">Pack</th>
                    <th className="label-cap text-right px-3 py-2">Price</th>
                    <th className="label-cap text-right px-3 py-2">Per {m.base_unit}</th>
                    <th className="label-cap text-right px-3 py-2">vs You</th>
                    <th className="label-cap text-right px-3 py-2 pr-4 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {m.candidates.map((c, i) => {
                    const p = productsById.get(c.product_id);
                    if (!p) return null;
                    return (
                      <tr key={c.product_id} className={cn("border-b border-border last:border-0", i % 2 === 1 && "bg-bg-surfaceAlt/40")}>
                        <td className="px-4 py-2">
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-text-primary hover:text-accent truncate block max-w-xs">
                            {p.title}
                          </a>
                          {p.on_sale && <span className="text-[10px] hero-num text-warning ml-1">−{p.discount_pct}%</span>}
                        </td>
                        <td className="px-3 py-2 text-text-secondary text-xs">{p.source_name}</td>
                        <td className="px-3 py-2 text-right text-text-secondary text-xs nums">{p.pack_size_text || "—"}</td>
                        <td className="px-3 py-2 text-right nums">{formatMoney(p.price)}</td>
                        <td className="px-3 py-2 text-right nums">
                          {c.estimated_per_base_unit != null ? formatMoney(c.estimated_per_base_unit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.delta_pct == null ? (
                            <span className="text-text-muted text-xs">—</span>
                          ) : c.delta_pct < -3 ? (
                            <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-xs hero-num">
                              <ArrowDownRight className="h-3 w-3 inline mr-0.5" strokeWidth={1.5} />
                              {c.delta_pct.toFixed(0)}%
                            </span>
                          ) : c.delta_pct > 3 ? (
                            <span className="rounded-full bg-error/15 text-error px-2 py-0.5 text-xs hero-num">
                              <ArrowUpRight className="h-3 w-3 inline mr-0.5" strokeWidth={1.5} />
                              +{c.delta_pct.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs nums">~{c.delta_pct.toFixed(0)}%</span>
                          )}
                        </td>
                        <td className="px-3 py-2 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => onApply(m.ingredient_id, p)}
                            className="btn-text text-xs hover:!text-accent"
                            title={`Apply ${p.title} to ${m.ingredient_name}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                            <span className="sr-only">Apply</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
      {unmatched.length > 0 && (
        <details className="card px-4 py-3">
          <summary className="cursor-pointer text-sm text-text-secondary flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" strokeWidth={1.5} />
            {unmatched.length} ingredient{unmatched.length === 1 ? "" : "s"} with no public match yet
          </summary>
          <p className="text-xs text-text-muted mt-2 mb-2">
            These didn't match any product from the public sources we scan. Specialty items or items
            primarily sold at gated wholesalers (Sam's, Restaurant Depot, Sysco) often land here.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unmatched.map((m) => (
              <span key={m.ingredient_id} className="text-xs text-text-secondary bg-bg-surfaceAlt rounded-sm px-2 py-0.5">
                {m.ingredient_name}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BestDelta({ candidates }: { candidates: MarketMatch["candidates"] }) {
  const best = candidates.find((c) => c.delta_pct != null);
  if (!best || best.delta_pct == null) {
    return <span className="text-xs text-text-muted">no comparable price</span>;
  }
  if (best.delta_pct < -3) {
    return (
      <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-xs hero-num shrink-0">
        {best.delta_pct.toFixed(0)}% cheaper
      </span>
    );
  }
  if (best.delta_pct > 3) {
    return (
      <span className="rounded-full bg-error/15 text-error px-2 py-0.5 text-xs hero-num shrink-0">
        +{best.delta_pct.toFixed(0)}%
      </span>
    );
  }
  return <span className="text-xs text-text-muted">about even</span>;
}

// ──────── Browse view: search every product ────────

function BrowseView({ products }: { products: MarketProduct[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products.slice(0, 100);
    return products
      .filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.vendor?.toLowerCase().includes(q) ||
        p.source_name.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [products, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" strokeWidth={1.5} />
        <Input placeholder="Search products by name, vendor, or source…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      <div className="text-xs text-text-muted">
        Showing {filtered.length} of {products.length} products
      </div>
      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="card flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm text-text-primary hover:text-accent truncate block">
                {p.title}
              </a>
              <div className="text-xs text-text-muted truncate">
                {p.pack_size_text || "—"}
                {p.vendor && <span> · {p.vendor}</span>}
                <span> · {p.source_name}</span>
              </div>
            </div>
            <div className="text-right shrink-0 nums">
              <div className="text-sm text-text-primary">{formatMoney(p.price)}</div>
              {p.on_sale && (
                <span className="text-[10px] hero-num text-warning">−{p.discount_pct}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
