import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { IngredientForm } from "./IngredientForm";
import { CalibrationDialog } from "./CalibrationDialog";
import { computeCostPerBaseUnit, findIngredientUsage, formatMoney, type IngredientUsage } from "@/lib/cost";
import { unitLabel, type DensityFactor } from "@/lib/units";
import type { Ingredient, Recipe } from "@/db/types";
import { Plus, Search, Pencil, ChevronRight, Info, Beaker, ChefHat, CupSoda, Layers, Sprout } from "lucide-react";
import { MultiSelectPopover } from "@/components/ui/MultiSelectPopover";
import { TabHero } from "@/components/ui/TabHero";
import { cn } from "@/lib/cn";

export function IngredientsTab() {
  const ingredients = useApp((s) => s.ingredients);
  const recipes = useApp((s) => s.recipes);
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);
  const usage = useApp((s) => s.ingredientUsageCount);
  const upsert = useApp((s) => s.upsertIngredient);
  const remove = useApp((s) => s.deleteIngredient);

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [calibrating, setCalibrating] = useState<Ingredient | null>(null);
  const [vendorFilter, setVendorFilter] = useState<Set<string>>(new Set());
  const [groupBySupplier, setGroupBySupplier] = useState(false);

  /** Distinct vendor names with how many ingredients each has, sorted by count desc. */
  const vendors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of ingredients) {
      const v = i.vendor?.trim() || "(no supplier)";
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [ingredients]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let out = ingredients;
    if (q) {
      out = out.filter(
        (i) => i.name.toLowerCase().includes(q) || i.vendor?.toLowerCase().includes(q)
      );
    }
    if (vendorFilter.size > 0) {
      out = out.filter((i) => vendorFilter.has(i.vendor?.trim() || "(no supplier)"));
    }
    return [...out].sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, query, vendorFilter]);

  const grouped = useMemo(() => {
    if (!groupBySupplier) return null;
    const map = new Map<string, Ingredient[]>();
    for (const i of filtered) {
      const v = i.vendor?.trim() || "(no supplier)";
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(i);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBySupplier]);


  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <TabHero
        title="Ingredients"
        subtitle="What goes into every recipe — sourced, costed, calibrated."
        accent="success"
        icon={<Sprout className="h-7 w-7" strokeWidth={1.4} />}
        stats={[
          { label: "items", value: ingredients.length, accent: "success" },
          { label: "suppliers", value: vendors.length, accent: "accent" },
        ]}
      />

      <div className="ing-toolbar mb-3">
        <div className="ing-toolbar-search">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none z-10"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search ingredients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <button
          type="button"
          onClick={() => setGroupBySupplier((v) => !v)}
          className={cn(
            "btn-ghost text-sm ing-toolbar-btn",
            groupBySupplier && "!bg-accent-soft !border-accent text-text-primary"
          )}
          style={
            groupBySupplier
              ? undefined
              : { background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text)" }
          }
          title="Group ingredients by supplier"
        >
          <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />
          {groupBySupplier ? "Grouped by supplier" : "Group by supplier"}
        </button>
        <Button onClick={() => setAdding(true)} className="ing-toolbar-btn">
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Add ingredient
        </Button>
      </div>

      {/* Supplier filter dropdown */}
      {vendors.length > 1 && (
        <div className="flex items-center gap-2 mb-5">
          <MultiSelectPopover
            label="Supplier"
            options={vendors.map(([v, count]) => ({ value: v, label: v, count }))}
            selected={vendorFilter}
            onChange={setVendorFilter}
            totalCount={ingredients.length}
          />
          {vendorFilter.size > 0 && (
            <span className="text-xs text-text-muted nums">
              {filtered.length} match{filtered.length === 1 ? "" : "es"}
            </span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        ingredients.length === 0 ? (
          <EmptyState
            title="The pantry is empty"
            description="Add the first ingredient — start with something you buy often, like milk or sugar."
            action={<Button onClick={() => setAdding(true)}>Add ingredient</Button>}
          />
        ) : (
          <EmptyState title="No matches" description="Try a different search or filter." />
        )
      ) : (
        <div className="card overflow-hidden">
          <div className="ing-table-scroll">
          <table className="w-full ing-table">
            <thead>
              <tr className="border-b border-border bg-bg-surfaceAlt">
                <th className="label-cap text-left px-5 py-3 w-8"></th>
                <th className="label-cap text-left px-3 py-3">Ingredient</th>
                {!groupBySupplier && <th className="label-cap text-left px-3 py-3">Vendor</th>}
                <th className="label-cap text-right px-3 py-3">Package</th>
                <th className="label-cap text-right px-3 py-3">Cost</th>
                <th className="label-cap text-right px-3 py-3">Per base unit</th>
                <th className="label-cap text-left px-3 py-3 pr-5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {grouped ? (
                grouped.flatMap(([vendor, items]) => [
                  <tr key={`hdr-${vendor}`} className="border-y border-accent/40">
                    <td colSpan={6} className="px-5 py-2.5 bg-gradient-to-r from-accent/15 to-accent/5">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-accent" />
                        <span className="display text-base font-medium text-text-primary">{vendor}</span>
                        <span className="text-xs text-text-secondary nums">
                          {items.length} item{items.length === 1 ? "" : "s"}
                          {" · "}
                          {formatMoney(items.reduce((s, i) => s + i.package_cost + i.delivery_cost, 0))} total
                        </span>
                      </div>
                    </td>
                  </tr>,
                  ...items.map((ing, idx) => {
                    const isExpanded = expanded.has(ing.id);
                    const used = usage.get(ing.id) ?? 0;
                    const usageList = isExpanded
                      ? findIngredientUsage(ing, recipes, ingredientsById, recipesById)
                      : [];
                    return (
                      <RowGroup
                        key={ing.id}
                        ing={ing}
                        expanded={isExpanded}
                        used={used}
                        usageList={usageList}
                        isAlt={idx % 2 === 1}
                        showVendor={false}
                        onToggle={() => toggleExpand(ing.id)}
                        onEdit={() => setEditing(ing)}
                        onCalibrate={() => setCalibrating(ing)}
                      />
                    );
                  }),
                ])
              ) : (
                filtered.map((ing, idx) => {
                  const isExpanded = expanded.has(ing.id);
                  const used = usage.get(ing.id) ?? 0;
                  const usageList = isExpanded
                    ? findIngredientUsage(ing, recipes, ingredientsById, recipesById)
                    : [];
                  return (
                    <RowGroup
                      key={ing.id}
                      ing={ing}
                      expanded={isExpanded}
                      used={used}
                      usageList={usageList}
                      isAlt={idx % 2 === 1}
                      showVendor={true}
                      onToggle={() => toggleExpand(ing.id)}
                      onEdit={() => setEditing(ing)}
                      onCalibrate={() => setCalibrating(ing)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Dialog
        open={adding}
        onOpenChange={setAdding}
        title="Add ingredient"
        description="Start with the package you buy. We'll figure out cost per gram, milliliter, or piece."
        size="lg"
      >
        <IngredientForm
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await upsert(data as any);
            setAdding(false);
          }}
        />
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit ingredient"
        size="lg"
      >
        {editing && (
          <IngredientForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (data) => {
              await upsert(data as any);
              setEditing(null);
            }}
            onDelete={async () => {
              if (confirm(`Delete ${editing.name}? This cannot be undone.`)) {
                await remove(editing.id);
                setEditing(null);
              }
            }}
          />
        )}
      </Dialog>

      {calibrating && (
        <CalibrationDialog
          ingredient={calibrating}
          open={!!calibrating}
          onOpenChange={(o) => !o && setCalibrating(null)}
          onSave={async (factor: DensityFactor) => {
            // Replace any existing factor for the same from_unit with this calibrated one.
            const existing = calibrating.density_factors.filter((f) => f.from_unit !== factor.from_unit);
            const updated: Ingredient = {
              ...calibrating,
              density_factors: [...existing, factor],
            };
            // Recompute cost per base unit using the new factors.
            updated.cost_per_base_unit = computeCostPerBaseUnit(
              updated.package_quantity,
              updated.package_unit,
              updated.package_cost,
              updated.base_unit,
              updated.density_factors,
              updated.delivery_cost
            );
            await upsert(updated as any);
            setCalibrating(null);
          }}
        />
      )}
    </div>
  );
}

function UsageList({ ing, usageList }: { ing: Ingredient; usageList: IngredientUsage[] }) {
  if (usageList.length === 0) {
    return (
      <div>
        <div className="label-cap mb-2">Used in</div>
        <div className="text-sm text-text-muted italic">No recipes use this ingredient yet.</div>
      </div>
    );
  }

  // Sort: direct uses first, then by base amount desc.
  const sorted = [...usageList].sort((a, b) => {
    if (a.direct !== b.direct) return a.direct ? -1 : 1;
    return b.base_amount_per_batch - a.base_amount_per_batch;
  });

  const directCount = sorted.filter((u) => u.direct).length;
  const indirectCount = sorted.length - directCount;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="label-cap">
          Used in {sorted.length} recipe{sorted.length === 1 ? "" : "s"}
        </div>
        <div className="text-xs text-text-muted">
          {directCount} direct{indirectCount > 0 && ` · ${indirectCount} via sub-recipe`}
        </div>
      </div>
      <div className="rounded border border-border bg-bg-surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="label-cap text-left px-3 py-2">Recipe</th>
              <th className="label-cap text-left px-3 py-2">Type</th>
              <th className="label-cap text-right px-3 py-2">As written</th>
              <th className="label-cap text-right px-3 py-2 pr-3">Per batch (in {ing.base_unit})</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => (
              <UsageRow key={u.recipe.id} ing={ing} u={u} alt={i % 2 === 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsageRow({ ing, u, alt }: { ing: Ingredient; u: IngredientUsage; alt: boolean }) {
  return (
    <tr className={cn("border-b border-border last:border-0", alt && "bg-bg-surfaceAlt/40")}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {u.recipe.type === "menu_item" ? (
            <CupSoda className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={1.5} />
          ) : (
            <ChefHat className="h-3.5 w-3.5 text-info shrink-0" strokeWidth={1.5} />
          )}
          <span className="text-sm font-medium text-text-primary">{u.recipe.name}</span>
        </div>
        {u.via && u.via.length > 0 && (
          <div className="text-xs text-text-muted mt-0.5 ml-5">
            via {u.via.map((r) => r.name).join(" → ")}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-text-secondary">
        {u.recipe.type === "menu_item" ? "Menu item" : "Sub-recipe"}
      </td>
      <td className="px-3 py-2 text-right nums text-sm text-text-secondary">
        {u.direct && u.direct_input ? (
          <>
            {u.direct_input.quantity} {unitLabel(u.direct_input.unit)}
          </>
        ) : (
          <span className="text-text-muted italic text-xs">indirect</span>
        )}
      </td>
      <td className="px-3 py-2 pr-3 text-right hero-num text-base nums">
        {formatBaseAmount(u.base_amount_per_batch)} {ing.base_unit}
      </td>
    </tr>
  );
}

function formatBaseAmount(n: number): string {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(1);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function RowGroup({
  ing,
  expanded,
  used,
  usageList,
  isAlt,
  showVendor,
  onToggle,
  onEdit,
  onCalibrate,
}: {
  ing: Ingredient;
  expanded: boolean;
  used: number;
  usageList: IngredientUsage[];
  isAlt: boolean;
  showVendor: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCalibrate: () => void;
}) {
  const hasOnlyLibraryFactors = ing.density_factors.length > 0 && ing.density_factors.every((f) => f.source === "library");
  return (
    <>
      <tr className={cn("border-b border-border table-row-hover transition-colors", isAlt && "bg-bg-surfaceAlt/40")}>
        <td className="px-5 py-3 align-top">
          <button onClick={onToggle} className="btn-text p-0.5">
            <ChevronRight
              className={cn("h-4 w-4 transition-transform duration-150 ease-out-soft", expanded && "rotate-90")}
              strokeWidth={1.5}
            />
          </button>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-text-primary">{ing.name}</span>
            {hasOnlyLibraryFactors && (
              <Tooltip content="Based on standard library density. Calibrate for accuracy with your actual ingredient.">
                <Info className="h-3 w-3 text-text-muted" strokeWidth={1.5} />
              </Tooltip>
            )}
          </div>
          {used > 0 && (
            <div className="text-xs text-text-muted mt-0.5">
              Used in {used} recipe{used === 1 ? "" : "s"}
            </div>
          )}
        </td>
        {showVendor && (
          <td className="px-3 py-3 text-text-secondary align-top">{ing.vendor || "—"}</td>
        )}
        <td className="px-3 py-3 text-right nums align-top">
          {ing.package_quantity} {unitLabel(ing.package_unit)}
        </td>
        <td className="px-3 py-3 text-right nums align-top">
          {formatMoney(ing.package_cost)}
          {ing.delivery_cost > 0 && (
            <div className="text-xs text-text-muted nums mt-0.5">+ {formatMoney(ing.delivery_cost)} delivery</div>
          )}
        </td>
        <td className="px-3 py-3 text-right align-top">
          <span className="hero-num text-base">{formatMoney(ing.cost_per_base_unit)}</span>
          <span className="text-xs text-text-muted nums ml-1">/{ing.base_unit}</span>
        </td>
        <td className="px-3 py-3 pr-5 align-top">
          <div className="flex justify-end gap-1">
            <button onClick={onCalibrate} className="btn-text" title="Calibrate weight">
              <Beaker className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button onClick={onEdit} className="btn-text">
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className={cn("border-b border-border", isAlt && "bg-bg-surfaceAlt/40")}>
          <td colSpan={showVendor ? 7 : 6} className="px-5 py-4 bg-bg-surfaceAlt">
            <div className="grid grid-cols-2 gap-6 mb-5">
              <div>
                <div className="label-cap mb-2">Density factors</div>
                {ing.density_factors.length === 0 ? (
                  <div className="text-sm text-text-muted italic">
                    None — universal {ing.base_unit === "g" ? "weight" : ing.base_unit === "ml" ? "volume" : "count"} conversions only.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {ing.density_factors.map((f, i) => (
                      <li key={i} className="text-sm flex items-center gap-2">
                        <span className="nums">
                          1 {unitLabel(f.from_unit)} = {f.base_unit_amount.toFixed(3)} {ing.base_unit}
                        </span>
                        <span className={cn(
                          "chip text-xs",
                          f.source === "calibrated" && "bg-success/15 text-success",
                          f.source === "user" && "bg-warning/15 text-warning"
                        )}>{f.source}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                {ing.notes && (
                  <>
                    <div className="label-cap mb-2">Notes</div>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{ing.notes}</p>
                  </>
                )}
                <div className="mt-3">
                  <Button size="sm" variant="ghost" onClick={onCalibrate}>
                    <Beaker className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Recalibrate weight
                  </Button>
                </div>
              </div>
            </div>
            <UsageList ing={ing} usageList={usageList} />
          </td>
        </tr>
      )}
    </>
  );
}
