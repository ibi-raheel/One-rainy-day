import { useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeDemand, computeRecipeCost, formatMoney, formatPercent } from "@/lib/cost";
import { unitLabel } from "@/lib/units";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/db/api";
import { TabHero } from "@/components/ui/TabHero";

type SortKey = "name" | "cost" | "price" | "margin" | "volume";

export function DashboardTab() {
  const ingredients = useApp((s) => s.ingredients);
  const recipes = useApp((s) => s.recipes);
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);
  const settings = useApp((s) => s.settings);
  const setPeriodLabel = useApp((s) => s.setPeriodLabel);
  const upsertRecipe = useApp((s) => s.upsertRecipe);

  const [sortKey, setSortKey] = useState<SortKey>("margin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const menuItems = useMemo(() => recipes.filter((r) => r.type === "menu_item"), [recipes]);

  const rows = useMemo(() => {
    const enriched = menuItems.map((r) => {
      const cost = computeRecipeCost(r, ingredientsById, recipesById);
      const margin = r.sale_price && cost.total_cost > 0 ? (r.sale_price - cost.total_cost) / r.sale_price : null;
      return {
        recipe: r,
        cost: cost.total_cost,
        price: r.sale_price ?? null,
        margin,
        volume: r.sales_volume_per_period ?? 0,
      };
    });
    enriched.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.recipe.name.localeCompare(b.recipe.name) * dir;
        case "cost":
          return (a.cost - b.cost) * dir;
        case "price":
          return ((a.price ?? -1) - (b.price ?? -1)) * dir;
        case "margin":
          return ((a.margin ?? -1) - (b.margin ?? -1)) * dir;
        case "volume":
          return (a.volume - b.volume) * dir;
      }
    });
    return enriched;
  }, [menuItems, ingredientsById, recipesById, sortKey, sortDir]);

  const demand = useMemo(
    () => computeDemand(ingredients, menuItems, recipesById, ingredientsById),
    [ingredients, menuItems, recipesById, ingredientsById]
  );

  const totalDemandCost = demand.reduce((sum, d) => sum + d.cost, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + (r.price ?? 0) * r.volume, 0);
  const totalCogs = rows.reduce((sum, r) => sum + r.cost * r.volume, 0);

  const isEmpty = recipes.length === 0 && ingredients.length === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <TabHero
          title="Dashboard"
          subtitle="Margins, demand, and what to order next."
          accent="warning"
          icon={<BarChart3 className="h-7 w-7" strokeWidth={1.4} />}
          action={<ImportExport />}
        />
        <EmptyState
          title="Nothing to show yet"
          description="Add ingredients and build menu items to see margins, COGS, and order suggestions here. Or click Import to load a backup."
        />
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleVolumeChange = async (recipeId: string, value: string) => {
    const r = recipes.find((x) => x.id === recipeId);
    if (!r) return;
    const next = { ...r, sales_volume_per_period: value === "" ? undefined : parseFloat(value) || 0 };
    await upsertRecipe(next as any);
  };

  return (
    <div className="space-y-10">
      <TabHero
        title="Dashboard"
        subtitle={`Margins, demand, and what to order — ${settings?.period_label ?? "per day"}.`}
        accent="warning"
        icon={<BarChart3 className="h-7 w-7" strokeWidth={1.4} />}
        stats={[
          { label: "menu items", value: rows.length, accent: "accent" },
          { label: "ingredients", value: ingredients.length, accent: "success" },
        ]}
        action={<ImportExport />}
      />

      <div className="flex items-center gap-3 text-sm -mt-2">
        <span className="text-text-secondary">Tracking sales</span>
        <select
          className="input-base !py-1 !px-2 text-sm w-auto"
          value={settings?.period_label ?? "per day"}
          onChange={(e) => setPeriodLabel(e.target.value)}
        >
          <option value="per day">per day</option>
          <option value="per week">per week</option>
          <option value="per month">per month</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Revenue" value={formatMoney(totalRevenue)} subtle={settings?.period_label} accent="accent" />
        <Stat label="Cost of goods" value={formatMoney(totalCogs)} subtle={settings?.period_label} accent="warning" />
        <Stat
          label="Blended margin"
          value={totalRevenue > 0 ? formatPercent((totalRevenue - totalCogs) / totalRevenue) : "—"}
          subtle={settings?.period_label}
          accent="success"
        />
      </div>

      {/* Menu economics */}
      <section>
        <h2 className="display text-xl text-text-primary mb-3">Menu economics</h2>
        {menuItems.length === 0 ? (
          <div className="card px-5 py-10 text-center text-text-muted">
            No menu items yet. Build one in the Recipes tab.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-surfaceAlt">
                  <SortHeader label="Item" current={sortKey} dir={sortDir} keyName="name" onClick={handleSort} align="left" />
                  <SortHeader label="Cost" current={sortKey} dir={sortDir} keyName="cost" onClick={handleSort} />
                  <SortHeader label="Sale price" current={sortKey} dir={sortDir} keyName="price" onClick={handleSort} />
                  <SortHeader label="Margin" current={sortKey} dir={sortDir} keyName="margin" onClick={handleSort} />
                  <SortHeader label={`Sales (${settings?.period_label ?? "per day"})`} current={sortKey} dir={sortDir} keyName="volume" onClick={handleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const margin = row.margin;
                  return (
                    <tr
                      key={row.recipe.id}
                      className={cn("border-b border-border", idx % 2 === 1 && "bg-bg-surfaceAlt/40")}
                    >
                      <td className="px-5 py-3 font-medium">{row.recipe.name}</td>
                      <td className="px-3 py-3 text-right nums">{formatMoney(row.cost)}</td>
                      <td className="px-3 py-3 text-right nums">{row.price != null ? formatMoney(row.price) : "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <MarginPill margin={margin} />
                      </td>
                      <td className="px-3 py-3 pr-5 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={row.volume || ""}
                          placeholder="0"
                          onChange={(e) => handleVolumeChange(row.recipe.id, e.target.value)}
                          className="!py-1.5 !text-right max-w-[100px] ml-auto"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Order planning */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="display text-xl text-text-primary">Order planning</h2>
          <span className="text-sm text-text-muted">
            Total ingredient cost {settings?.period_label ?? "per day"}: {" "}
            <span className="hero-num text-text-primary nums">{formatMoney(totalDemandCost)}</span>
          </span>
        </div>
        <p className="text-sm text-text-muted mb-3">
          Demand rolls up from sales × recipe usage × waste factor. Suggested order quantity is in the package unit you buy.
        </p>
        {ingredients.length === 0 ? (
          <div className="card px-5 py-10 text-center text-text-muted">
            No ingredients yet — add some in the Ingredients tab.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-surfaceAlt">
                  <th className="label-cap text-left px-5 py-3">Ingredient</th>
                  <th className="label-cap text-right px-3 py-3">Demand</th>
                  <th className="label-cap text-right px-3 py-3">Cost</th>
                  <th className="label-cap text-right px-3 py-3 pr-5">Suggested order</th>
                </tr>
              </thead>
              <tbody>
                {demand
                  .filter((d) => d.base_amount > 0)
                  .sort((a, b) => b.cost - a.cost)
                  .map((d, idx) => (
                    <tr
                      key={d.ingredient.id}
                      className={cn("border-b border-border", idx % 2 === 1 && "bg-bg-surfaceAlt/40")}
                    >
                      <td className="px-5 py-3 font-medium">
                        {d.ingredient.name}
                        {d.ingredient.waste_factor !== 1 && (
                          <span className="ml-2 text-xs text-text-muted">
                            ({(d.ingredient.waste_factor * 100 - 100).toFixed(0)}% waste)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right nums">
                        {d.base_amount.toFixed(d.base_amount < 10 ? 2 : d.base_amount < 100 ? 1 : 0)} {d.ingredient.base_unit}
                      </td>
                      <td className="px-3 py-3 text-right nums">{formatMoney(d.cost)}</td>
                      <td className="px-3 py-3 pr-5 text-right">
                        <span className="hero-num text-base nums">
                          {d.package_amount < 10
                            ? d.package_amount.toFixed(2)
                            : d.package_amount.toFixed(1)}
                        </span>
                        <span className="text-xs text-text-muted ml-1">{unitLabel(d.ingredient.package_unit)}</span>
                      </td>
                    </tr>
                  ))}
                {demand.every((d) => d.base_amount === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-text-muted">
                      Set sales volumes on your menu items above to see ingredient demand.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function MarginPill({ margin }: { margin: number | null }) {
  if (margin == null) {
    return <span className="text-text-muted nums">—</span>;
  }
  const tone =
    margin < 0.6
      ? "bg-error/15 text-error border-error/30"
      : margin < 0.75
      ? "bg-warning/15 text-warning border-warning/40"
      : "bg-success/15 text-success border-success/40";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[64px] rounded-full border px-2.5 py-0.5 hero-num nums text-sm",
        tone
      )}
    >
      {formatPercent(margin)}
    </span>
  );
}

function Stat({
  label,
  value,
  subtle,
  accent = "accent",
}: {
  label: string;
  value: string;
  subtle?: string;
  accent?: "accent" | "success" | "warning" | "info" | "error";
}) {
  const SCHEME = {
    accent:  { rail: "bg-accent",  glow: "from-accent/10 via-accent/5",   chip: "bg-accent/10 text-accent",   value: "text-accent-hover" },
    success: { rail: "bg-success", glow: "from-success/12 via-success/6", chip: "bg-success/15 text-success", value: "text-success" },
    warning: { rail: "bg-warning", glow: "from-warning/12 via-warning/6", chip: "bg-warning/15 text-warning", value: "text-warning" },
    info:    { rail: "bg-info",    glow: "from-info/12 via-info/6",       chip: "bg-info/15 text-info",       value: "text-info" },
    error:   { rail: "bg-error",   glow: "from-error/12 via-error/6",     chip: "bg-error/15 text-error",     value: "text-error" },
  } as const;
  const s = SCHEME[accent];
  return (
    <div className="card relative pl-6 pr-5 py-5 overflow-hidden">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", s.rail)} />
      {/* gradient wash */}
      <div className={cn("absolute inset-0 pointer-events-none bg-gradient-to-br", s.glow, "to-transparent")} />
      <div className="relative">
        <div className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase", s.chip)}>
          {label}
        </div>
        <div className={cn("hero-num text-[34px] mt-2 nums leading-none", s.value)}>{value}</div>
        {subtle && <div className="text-xs text-text-muted mt-1.5">{subtle}</div>}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  current,
  dir,
  keyName,
  onClick,
  align = "right",
}: {
  label: string;
  current: SortKey;
  dir: "asc" | "desc";
  keyName: SortKey;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = current === keyName;
  return (
    <th className={cn("label-cap py-3", align === "right" ? "text-right pr-3" : "text-left pl-5")}>
      <button
        type="button"
        onClick={() => onClick(keyName)}
        className={cn("inline-flex items-center gap-1", active && "text-text-primary")}
      >
        {label}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" strokeWidth={1.5} /> : <ChevronDown className="h-3 w-3" strokeWidth={1.5} />)}
      </button>
    </th>
  );
}

function ImportExport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    try {
      const state = await api.loadState();
      const blob = new Blob(
        [JSON.stringify({ ...state, version: 1, exported_at: new Date().toISOString() }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cafe-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const importData = async (file: File) => {
    setBusy(true);
    console.log("[import] reading", file.name, file.size, "bytes");
    let text: string, data: any;
    try {
      text = await file.text();
    } catch (e) {
      console.error("[import] file read failed:", e);
      alert(`Couldn't read the file: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
      return;
    }
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("[import] JSON parse failed:", e);
      alert(`File isn't valid JSON: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
      return;
    }
    const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
    const recipes = Array.isArray(data.recipes) ? data.recipes : [];
    const settings =
      (data.settings && !Array.isArray(data.settings) && data.settings) ||
      (Array.isArray(data.settings) && data.settings[0]) ||
      { id: "singleton", period_label: "per day" };
    console.log("[import] parsed:", ingredients.length, "ingredients,", recipes.length, "recipes");

    if (!window.confirm(`Replace current data with ${ingredients.length} ingredients and ${recipes.length} recipes?`)) {
      console.log("[import] user cancelled");
      setBusy(false);
      return;
    }

    try {
      console.log("[import] sending to server...");
      await api.replaceState({ ingredients, recipes, settings });
      console.log("[import] server accepted, reloading");
      window.location.reload();
    } catch (e) {
      console.error("[import] server PUT failed:", e);
      alert(
        `Server didn't accept the import:\n${e instanceof Error ? e.message : e}\n\n` +
        `Check that the cafe server is running (terminal should show "Café — cost & recipe management").`
      );
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={exportData} disabled={busy}>
        <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.5} />
        Export
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importData(f);
        }}
      />
      <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
        <ArrowUpFromLine className="h-3.5 w-3.5" strokeWidth={1.5} />
        Import
      </Button>
    </>
  );
}
