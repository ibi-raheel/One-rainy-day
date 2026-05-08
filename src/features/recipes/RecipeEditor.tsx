import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useApp } from "@/store/app";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import { ALL_UNITS, baseUnitFor, unitClass, unitLabel, type DensityFactor, type Unit } from "@/lib/units";
import { DensityFactorRow } from "@/components/DensityFactorRow";
import { computeRecipeCost, formatMoney, formatPercent, findRecipeCycle } from "@/lib/cost";
import type { Recipe, RecipeInput } from "@/db/types";
import { Trash2, Plus, AlertTriangle, Receipt, Wheat, Calculator } from "lucide-react";
import { aggregateRecipeAllergens } from "@/lib/allergens";
import { Tooltip } from "@/components/ui/Tooltip";
import { ScaleDialog } from "./ScaleDialog";
import { MarginPill } from "../dashboard/DashboardTab";
import { cn } from "@/lib/cn";
import { InputPicker } from "./InputPicker";
import { CostBreakdown } from "./CostBreakdown";
import { BreakdownDialog } from "./BreakdownDialog";

const UNIT_OPTIONS = ALL_UNITS.map((u) => ({ value: u, label: unitLabel(u as Unit) }));

interface Props {
  recipe: Recipe;
}

export function RecipeEditor({ recipe }: Props) {
  const ingredients = useApp((s) => s.ingredients);
  const recipes = useApp((s) => s.recipes);
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);
  const upsert = useApp((s) => s.upsertRecipe);
  const remove = useApp((s) => s.deleteRecipe);

  // Local editor state — kept in sync with the recipe via id changes.
  const [draft, setDraft] = useState<Recipe>(recipe);
  const [savedTick, setSavedTick] = useState(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(recipe);
  }, [recipe.id]);

  // Auto-save with debounce
  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(recipe)) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      // Cycle check before save
      const next = recipes.map((r) => (r.id === draft.id ? draft : r));
      const recipesByIdLocal = new Map(next.map((r) => [r.id, r]));
      const cycle = findRecipeCycle(draft, recipesByIdLocal);
      if (cycle) {
        // Don't save; user will see warning in cost result
        return;
      }
      await upsert(draft as any);
      setSavedTick((t) => t + 1);
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [draft, recipe, upsert, recipes]);

  const cost = useMemo(() => {
    return computeRecipeCost(draft, ingredientsById, recipesById);
  }, [draft, ingredientsById, recipesById]);

  const allergenSummary = useMemo(
    () => aggregateRecipeAllergens(draft, ingredientsById, recipesById),
    [draft, ingredientsById, recipesById]
  );

  const margin = useMemo(() => {
    if (draft.type !== "menu_item" || !draft.sale_price || !cost.total_cost) return null;
    return (draft.sale_price - cost.total_cost) / draft.sale_price;
  }, [draft, cost]);

  const marginColor = (m: number) => {
    if (m < 0.6) return "text-error";
    if (m < 0.75) return "text-warning";
    return "text-success";
  };

  const update = (patch: Partial<Recipe>) => setDraft((d) => ({ ...d, ...patch }));

  const updateInput = (rowId: string, patch: Partial<RecipeInput>) => {
    setDraft((d) => ({
      ...d,
      inputs: d.inputs.map((i) => (i.row_id === rowId ? { ...i, ...patch } : i)),
    }));
  };

  const addInput = () => {
    setDraft((d) => ({
      ...d,
      inputs: [
        ...d.inputs,
        { row_id: nanoid(), type: "ingredient", ref_id: "", quantity: 1, unit: "g" },
      ],
    }));
  };

  const removeInput = (rowId: string) => {
    setDraft((d) => ({ ...d, inputs: d.inputs.filter((i) => i.row_id !== rowId) }));
  };

  const yieldBase = baseUnitFor(draft.yield_unit);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Recipe name"
            className="display !text-2xl !py-2 !border-transparent hover:!border-border focus:!border-accent !bg-transparent !px-0"
          />
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <RecipeTypeToggle
              value={draft.type}
              onChange={(t) => update({ type: t })}
            />
            <SaveIndicator trigger={savedTick} />
            {allergenSummary.allergens.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Wheat className="h-3.5 w-3.5 text-warning" strokeWidth={1.5} />
                {allergenSummary.allergens.map((a) => (
                  <Tooltip
                    key={a}
                    content={
                      <div>
                        <div className="font-medium mb-1">From:</div>
                        <ul className="text-xs space-y-0.5">
                          {allergenSummary.sources[a].map((s) => (
                            <li key={s}>· {s}</li>
                          ))}
                        </ul>
                      </div>
                    }
                  >
                    <span className="rounded-sm bg-warning/15 text-warning px-1.5 py-0.5 text-xs cursor-help">
                      {a}
                    </span>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setScaleOpen(true)}
            className="btn-text text-sm"
            title="Scale this recipe to a larger batch"
          >
            <Calculator className="h-3.5 w-3.5" strokeWidth={1.5} /> Scale
          </button>
          <button
            onClick={async () => {
              if (confirm(`Delete "${draft.name}"?`)) await remove(draft.id);
            }}
            className="btn-text text-sm text-error hover:bg-error/10"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Delete
          </button>
        </div>
      </div>

      {/* Cycle warning */}
      {cost.hasCycle && (
        <div className="rounded-md border border-error/30 bg-error/10 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-error mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="text-sm text-error">
            This recipe references itself indirectly, creating an infinite loop. Adjust inputs to remove the cycle.
          </div>
        </div>
      )}

      {/* Inputs */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="display text-lg text-text-primary">Inputs</h3>
          <span className="text-xs text-text-muted">
            {draft.inputs.length === 0 ? "Add what goes in" : `${draft.inputs.length} item${draft.inputs.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="space-y-2">
          {draft.inputs.map((inp) => (
            <InputRow
              key={inp.row_id}
              input={inp}
              recipeId={draft.id}
              onChange={(patch) => updateInput(inp.row_id, patch)}
              onRemove={() => removeInput(inp.row_id)}
            />
          ))}
          <button onClick={addInput} className="btn-text text-sm">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add input
          </button>
        </div>
      </div>

      {/* Yield */}
      <div>
        <h3 className="display text-lg text-text-primary mb-2">Yield</h3>
        <p className="text-xs text-text-muted mb-2">
          {draft.type === "sub_recipe"
            ? "How much this recipe makes — required so other recipes can use it as an input."
            : "Usually 1 — what the customer gets per order."}
        </p>
        <div className="flex gap-3 items-end">
          <div className="w-32">
            <Label>Quantity</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={draft.yield_quantity}
              onChange={(e) => update({ yield_quantity: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="w-32">
            <Label>Unit</Label>
            <Select
              value={draft.yield_unit}
              onValueChange={(v) => update({ yield_unit: v as Unit })}
              options={UNIT_OPTIONS}
            />
          </div>
        </div>
      </div>

      {/* Density factors — only meaningful for sub-recipes used by others */}
      {draft.type === "sub_recipe" && (
        <DensityFactorsSection
          yieldUnit={draft.yield_unit}
          factors={draft.density_factors ?? []}
          onChange={(next) => update({ density_factors: next })}
        />
      )}

      {/* Cost summary */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard label="Total cost" value={formatMoney(cost.total_cost)} primary>
          <div className="flex items-center gap-3">
            <CostBreakdown result={cost} ingredientsById={ingredientsById} recipesById={recipesById}>
              quick breakdown
            </CostBreakdown>
            <button
              type="button"
              onClick={() => setBreakdownOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors duration-150 ease-out-soft"
            >
              <Receipt className="h-3 w-3" strokeWidth={1.5} />
              View detailed breakdown
            </button>
          </div>
        </SummaryCard>
        <SummaryCard
          label={`Cost per ${unitLabel(draft.yield_unit)}`}
          value={
            draft.yield_quantity > 0
              ? formatMoney(cost.total_cost / draft.yield_quantity)
              : "—"
          }
        />
      </div>

      <BreakdownDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        recipe={draft}
        result={cost}
        ingredientsById={ingredientsById}
        recipesById={recipesById}
      />

      <ScaleDialog
        open={scaleOpen}
        onOpenChange={setScaleOpen}
        recipe={draft}
      />

      {/* Menu item: sale price + margin */}
      {draft.type === "menu_item" && (
        <div>
          <h3 className="display text-lg text-text-primary mb-2">Pricing</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Sale price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={draft.sale_price ?? ""}
                onChange={(e) =>
                  update({ sale_price: e.target.value === "" ? undefined : parseFloat(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Margin</Label>
              <div className="input-base !cursor-default flex items-center">
                <MarginPill margin={margin} />
              </div>
            </div>
            <div>
              <Label>Sales / period</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={draft.sales_volume_per_period ?? ""}
                placeholder="0"
                onChange={(e) =>
                  update({
                    sales_volume_per_period: e.target.value === "" ? undefined : parseFloat(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <Label>Notes</Label>
        <Textarea
          value={draft.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Procedure, plating notes, anything to remember…"
        />
      </div>
    </div>
  );
}

function RecipeTypeToggle({ value, onChange }: { value: Recipe["type"]; onChange: (v: Recipe["type"]) => void }) {
  return (
    <div className="inline-flex rounded border border-border overflow-hidden text-sm">
      {(["sub_recipe", "menu_item"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "px-3 py-1 transition-colors duration-150 ease-out-soft",
            value === t ? "bg-accent-soft text-text-primary" : "text-text-secondary hover:bg-bg-surfaceAlt"
          )}
        >
          {t === "sub_recipe" ? "Sub-recipe" : "Menu item"}
        </button>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  children,
  primary = false,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <div
      className={cn(
        "card relative overflow-hidden px-5 py-4",
        primary && "bg-gradient-to-br from-accent-soft/70 to-bg-surface border-accent/30"
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", primary ? "bg-accent" : "bg-info/40")} />
      <div className="label-cap pl-3">{label}</div>
      <div className={cn("hero-num text-3xl mt-1.5 nums pl-3", primary ? "text-accent-hover" : "text-text-primary")}>
        {value}
      </div>
      {children && <div className="mt-2 text-xs text-text-muted pl-3">{children}</div>}
    </div>
  );
}

function DensityFactorsSection({
  yieldUnit,
  factors,
  onChange,
}: {
  yieldUnit: Unit;
  factors: DensityFactor[];
  onChange: (next: DensityFactor[]) => void;
}) {
  const yieldBase = baseUnitFor(yieldUnit);
  const yieldClass = unitClass(yieldUnit);

  const updateFactor = (idx: number, field: keyof DensityFactor, value: string | Unit) => {
    const next = [...factors];
    const f = { ...next[idx] };
    if (field === "base_unit_amount") f.base_unit_amount = parseFloat(value as string) || 0;
    if (field === "from_unit") f.from_unit = value as Unit;
    if (field === "source") f.source = value as DensityFactor["source"];
    next[idx] = f;
    onChange(next);
  };

  const addFactor = () => {
    const used = new Set(factors.map((f) => f.from_unit));
    const candidate = (["tbsp", "tsp", "cup", "g", "ml", "oz", "lb", "piece"] as Unit[]).find(
      (u) => !used.has(u) && unitClass(u) !== yieldClass
    );
    onChange([
      ...factors,
      { from_unit: candidate ?? "tbsp", base_unit_amount: 0, source: "user" },
    ]);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="display text-lg text-text-primary">Density factors</h3>
        <button onClick={addFactor} className="btn-text text-sm">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Add factor
        </button>
      </div>
      <p className="text-xs text-text-muted mb-2">
        Optional. Lets other recipes call for this in a different unit class than your yield. For example, a syrup that yields in <span className="font-medium nums">{unitLabel(yieldUnit)}</span> can declare {yieldClass === "weight" ? "1 cup = ___ g" : yieldClass === "volume" ? "1 g = ___ ml" : "1 g = ___ piece"} so callers can ask for it in volume or weight as needed.
      </p>
      {factors.length === 0 ? (
        <div className="text-sm text-text-muted italic">
          No factors. Recipes can only call for this in {yieldClass} units.
        </div>
      ) : (
        <div className="space-y-2">
          {factors.map((f, idx) => (
            <DensityFactorRow
              key={idx}
              factor={f}
              baseUnit={yieldBase}
              onChange={(field, value) => updateFactor(idx, field, value)}
              onDelete={() => onChange(factors.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InputRow({
  input,
  recipeId,
  onChange,
  onRemove,
}: {
  input: RecipeInput;
  recipeId: string;
  onChange: (patch: Partial<RecipeInput>) => void;
  onRemove: () => void;
}) {
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);

  const refSelected = input.ref_id ? { type: input.type, ref_id: input.ref_id } : null;

  // Determine which units make sense for this input
  const target = input.type === "ingredient" ? ingredientsById.get(input.ref_id) : recipesById.get(input.ref_id);

  const baseClass = useMemo(() => {
    if (!target) return null;
    if (input.type === "ingredient") {
      const ing = target as any;
      return unitClass(ing.base_unit);
    } else {
      const rec = target as Recipe;
      return unitClass(rec.yield_unit);
    }
  }, [target, input.type]);

  const availableFactorClasses = useMemo(() => {
    if (!target) return new Set<ReturnType<typeof unitClass>>();
    if (input.type === "ingredient") {
      const ing = target as any;
      return new Set(ing.density_factors.map((f: any) => unitClass(f.from_unit)));
    }
    const rec = target as Recipe;
    return new Set((rec.density_factors ?? []).map((f) => unitClass(f.from_unit)));
  }, [target, input.type]);

  // Validate selected unit
  const validUnit = useMemo(() => {
    if (!baseClass) return true;
    const c = unitClass(input.unit);
    if (c === baseClass) return true;
    return availableFactorClasses.has(c);
  }, [input.unit, baseClass, availableFactorClasses]);

  return (
    <div className="grid grid-cols-[1fr_120px_120px_auto] gap-2 items-start">
      <InputPicker
        excludeRecipeId={recipeId}
        selected={refSelected}
        onSelect={(sel) => {
          // When swapping ref, default unit to the target's base
          let nextUnit: Unit = "g";
          if (sel.type === "ingredient") {
            const ing = ingredientsById.get(sel.ref_id);
            if (ing) nextUnit = ing.base_unit as Unit;
          } else {
            const rec = recipesById.get(sel.ref_id);
            if (rec) nextUnit = rec.yield_unit;
          }
          onChange({ type: sel.type, ref_id: sel.ref_id, unit: nextUnit });
        }}
      />
      <Input
        type="number"
        step="any"
        min="0"
        value={input.quantity}
        onChange={(e) => onChange({ quantity: parseFloat(e.target.value) || 0 })}
      />
      <div>
        <Select
          value={input.unit}
          onValueChange={(v) => onChange({ unit: v as Unit })}
          options={UNIT_OPTIONS}
        />
        {!validUnit && (
          <div className="text-xs text-warning mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
            Need density factor
          </div>
        )}
      </div>
      <button onClick={onRemove} className="btn-text mt-2.5">
        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
