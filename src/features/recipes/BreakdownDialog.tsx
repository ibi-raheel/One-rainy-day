import { useMemo } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { formatMoney } from "@/lib/cost";
import type { InputBreakdown, RecipeCostResult } from "@/lib/cost";
import type { ConversionMethod, ConversionTrace } from "@/lib/units";
import { unitLabel } from "@/lib/units";
import type { Ingredient, Recipe } from "@/db/types";
import { AlertTriangle, ArrowRight, Sparkles, Beaker, UserPen, Repeat } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipe: Recipe;
  result: RecipeCostResult;
  ingredientsById: Map<string, Ingredient>;
  recipesById: Map<string, Recipe>;
}

export function BreakdownDialog({ open, onOpenChange, recipe, result, ingredientsById, recipesById }: Props) {
  const yieldDisplayCost = useMemo(() => {
    if (recipe.yield_quantity <= 0) return 0;
    return result.total_cost / recipe.yield_quantity;
  }, [recipe.yield_quantity, result.total_cost]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${recipe.name} — cost breakdown`}
      description="Every conversion, density factor, and dollar amount that adds up to the total."
      size="lg"
    >
      <div className="space-y-6">
        {/* Headline math */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryStat label="Total cost" value={formatMoney(result.total_cost)} />
          <SummaryStat
            label={`Per ${unitLabel(recipe.yield_unit)}`}
            value={formatMoney(yieldDisplayCost)}
            sub={`${recipe.yield_quantity} ${unitLabel(recipe.yield_unit)} yield`}
          />
          <SummaryStat
            label={`Per ${result.yield_base}`}
            value={formatMoney(result.cost_per_yield_unit)}
            sub={`base unit cost`}
          />
        </div>

        {/* Per-input breakdown */}
        <div>
          <h3 className="display text-lg text-text-primary mb-2">Inputs</h3>
          <ul className="space-y-3">
            {result.inputs.map((entry, i) => (
              <li key={i}>
                <BreakdownNode
                  bd={entry.cost.breakdown}
                  ingredientsById={ingredientsById}
                  recipesById={recipesById}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Total */}
        <div className="border-t border-border pt-4 flex items-baseline justify-between">
          <span className="display text-lg text-text-primary">Total</span>
          <span className="hero-num text-2xl text-text-primary nums">{formatMoney(result.total_cost)}</span>
        </div>

        {(result.hasMissingConversion || result.hasCycle) && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
            <span className="text-text-primary">
              {result.hasCycle
                ? "Cycle detected in inputs — cost is incomplete."
                : "Some inputs are missing conversions. Cost is incomplete."}
            </span>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="label-cap">{label}</div>
      <div className="hero-num text-xl text-text-primary mt-1 nums">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-0.5 nums">{sub}</div>}
    </div>
  );
}

function BreakdownNode({
  bd,
  ingredientsById,
  recipesById,
  depth = 0,
}: {
  bd: InputBreakdown;
  ingredientsById: Map<string, Ingredient>;
  recipesById: Map<string, Recipe>;
  depth?: number;
}) {
  const isMissing = bd.kind === "missing" || bd.kind === "cycle";

  return (
    <div className={cn("rounded-md border border-border bg-bg-surfaceAlt/60 p-4", depth > 0 && "bg-bg-surface")}>
      {/* Top: name + cost */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-text-primary">{bd.name}</span>
          <span className="text-text-muted text-sm nums">
            · {bd.input_qty} {unitLabel(bd.input_unit)}
          </span>
          {bd.kind === "recipe" && <span className="chip text-xs">sub-recipe</span>}
        </div>
        <span className={cn("hero-num text-lg nums", isMissing ? "text-warning" : "text-text-primary")}>
          {isMissing ? "—" : formatMoney(bd.cost)}
        </span>
      </div>

      {bd.note && (
        <div className="text-sm text-warning mb-2 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
          {bd.note}
        </div>
      )}

      {/* Conversion */}
      {bd.trace && (
        <div className="text-sm space-y-1.5 mb-3">
          <div className="label-cap">Conversion</div>
          <ConversionLine trace={bd.trace} />
        </div>
      )}

      {/* Cost math */}
      {bd.kind === "ingredient" && bd.trace && bd.ingredient_cost_per_base != null && (
        <div className="text-sm space-y-1 mb-1">
          <div className="label-cap">Cost math</div>
          <div className="nums text-text-secondary">
            {formatNum(bd.trace.base_amount)} {bd.ingredient_base_unit}
            <span className="text-text-muted"> × </span>
            {formatMoney(bd.ingredient_cost_per_base)}/{bd.ingredient_base_unit}
            <span className="text-text-muted"> = </span>
            <span className="text-text-primary font-medium">{formatMoney(bd.cost)}</span>
          </div>
        </div>
      )}

      {bd.kind === "recipe" && bd.trace && bd.sub_recipe_cost_per_yield_base != null && (
        <div className="text-sm space-y-3 mb-1">
          {/* Step 1: derive the sub-recipe's per-base-unit price */}
          <div className="space-y-1">
            <div className="label-cap">Sub-recipe math</div>
            <div className="space-y-1 nums text-text-secondary">
              <div>
                <span className="text-text-muted">Yield: </span>
                {bd.sub_recipe_yield_qty} {bd.sub_recipe_yield_unit && unitLabel(bd.sub_recipe_yield_unit)}
                {bd.sub_recipe_yield_unit !== bd.sub_recipe_yield_base && bd.sub_recipe_yield_in_base != null && (
                  <>
                    <ArrowRight className="inline h-3 w-3 mx-1 text-text-muted" strokeWidth={1.5} />
                    {formatNum(bd.sub_recipe_yield_in_base)} {bd.sub_recipe_yield_base}
                  </>
                )}
              </div>
              <div>
                <span className="text-text-muted">Total cost: </span>
                {formatMoney(bd.sub_recipe_total_cost ?? 0)}
              </div>
              <div>
                <span className="text-text-muted">Per {bd.sub_recipe_yield_base}: </span>
                {formatMoney(bd.sub_recipe_total_cost ?? 0)}
                <span className="text-text-muted"> ÷ </span>
                {formatNum(bd.sub_recipe_yield_in_base ?? 0)} {bd.sub_recipe_yield_base}
                <span className="text-text-muted"> = </span>
                <span className="text-text-primary font-medium">
                  {formatMoney(bd.sub_recipe_cost_per_yield_base)}/{bd.sub_recipe_yield_base}
                </span>
              </div>
            </div>
          </div>

          {/* Step 2: apply that to the input quantity */}
          <div className="space-y-1">
            <div className="label-cap">Cost math</div>
            <div className="nums text-text-secondary">
              {formatNum(bd.trace.base_amount)} {bd.sub_recipe_yield_base}
              <span className="text-text-muted"> × </span>
              {formatMoney(bd.sub_recipe_cost_per_yield_base)}/{bd.sub_recipe_yield_base}
              <span className="text-text-muted"> = </span>
              <span className="text-text-primary font-medium">{formatMoney(bd.cost)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Nested sub-recipe inputs */}
      {bd.kind === "recipe" && bd.sub_breakdown && bd.sub_breakdown.inputs.length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm text-text-secondary hover:text-text-primary list-none flex items-center gap-1">
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" strokeWidth={1.5} />
            Show {bd.name} breakdown ({bd.sub_breakdown.inputs.length} input{bd.sub_breakdown.inputs.length === 1 ? "" : "s"})
          </summary>
          <ul className="mt-2 ml-2 pl-3 border-l-2 border-border space-y-2.5">
            {bd.sub_breakdown.inputs.map((entry, i) => (
              <li key={i}>
                <BreakdownNode
                  bd={entry.cost.breakdown}
                  ingredientsById={ingredientsById}
                  recipesById={recipesById}
                  depth={depth + 1}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ConversionLine({ trace }: { trace: ConversionTrace }) {
  const lhs = `${trace.input_qty} ${unitLabel(trace.input_unit)}`;
  const rhs = `${formatNum(trace.base_amount)} ${trace.base_unit}`;
  return (
    <div className="space-y-1">
      <div className="nums">
        <span className="text-text-secondary">{lhs}</span>
        <ArrowRight className="inline h-3.5 w-3.5 mx-1.5 text-text-muted" strokeWidth={1.5} />
        <span className="text-text-primary font-medium">{rhs}</span>
      </div>
      <MethodNote method={trace.method} />
    </div>
  );
}

function MethodNote({ method }: { method: ConversionMethod }) {
  if (method.kind === "passthrough") {
    return <div className="text-xs text-text-muted">Same unit — no conversion needed.</div>;
  }
  if (method.kind === "universal_volume") {
    return (
      <div className="text-xs text-text-muted nums flex items-center gap-1">
        <Repeat className="h-3 w-3" strokeWidth={1.5} />
        Universal volume conversion (1 {nearestVolumeLabel(method.from_ml)} = {method.from_ml.toFixed(method.from_ml < 100 ? 4 : 2)} ml; US customary)
      </div>
    );
  }
  if (method.kind === "universal_weight") {
    return (
      <div className="text-xs text-text-muted nums flex items-center gap-1">
        <Repeat className="h-3 w-3" strokeWidth={1.5} />
        Universal weight conversion (1 unit = {method.from_g.toFixed(method.from_g < 100 ? 4 : 2)} g)
      </div>
    );
  }
  if (method.kind === "density_direct") {
    return <FactorChip prefix="Density factor" factor={method.factor} />;
  }
  // density_bridge
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-text-muted nums">
        Bridged through {unitLabel(method.intermediate_unit)} (universal volume/weight, then density factor):
      </div>
      <FactorChip prefix="Density factor" factor={method.bridge_factor} />
    </div>
  );
}

function FactorChip({ prefix, factor }: { prefix: string; factor: { from_unit: any; base_unit_amount: number; source: "library" | "user" | "calibrated" } }) {
  const Icon = factor.source === "library" ? Sparkles : factor.source === "calibrated" ? Beaker : UserPen;
  const sourceColor =
    factor.source === "library"
      ? "text-accent"
      : factor.source === "calibrated"
      ? "text-success"
      : "text-warning";
  const sourceLabel =
    factor.source === "library" ? "library default" : factor.source === "calibrated" ? "calibrated by you" : "user-entered";
  return (
    <div className="text-xs flex items-center gap-1.5 flex-wrap">
      <Icon className={cn("h-3 w-3", sourceColor)} strokeWidth={1.5} />
      <span className="text-text-muted">{prefix}:</span>
      <span className="text-text-secondary nums">
        1 {unitLabel(factor.from_unit)} = {factor.base_unit_amount} (in base)
      </span>
      <span className={cn("chip text-xs !py-0", sourceColor)}>{sourceLabel}</span>
    </div>
  );
}

function nearestVolumeLabel(ml: number): string {
  // Just for the chip — pick a plausible label by ml count.
  if (ml > 3000) return "gallon";
  if (ml > 800) return "quart";
  if (ml > 400) return "pint";
  if (ml > 200) return "cup";
  if (ml > 25) return "fl oz";
  if (ml > 10) return "tbsp";
  if (ml > 3) return "tsp";
  return "ml";
}

function formatNum(n: number): string {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(1);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}
