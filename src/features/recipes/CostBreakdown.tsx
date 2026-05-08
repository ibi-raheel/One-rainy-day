import { Tooltip } from "@/components/ui/Tooltip";
import { formatMoney } from "@/lib/cost";
import type { RecipeCostResult } from "@/lib/cost";
import type { Ingredient, Recipe, RecipeInput } from "@/db/types";
import { AlertCircle } from "lucide-react";

interface Props {
  result: RecipeCostResult;
  ingredientsById: Map<string, Ingredient>;
  recipesById: Map<string, Recipe>;
  children: React.ReactNode;
}

export function CostBreakdown({ result, ingredientsById, recipesById, children }: Props) {
  return (
    <Tooltip
      side="left"
      align="center"
      className="!max-w-md !p-4"
      content={<BreakdownContent result={result} ingredientsById={ingredientsById} recipesById={recipesById} />}
    >
      <span className="cursor-help underline decoration-dotted decoration-text-muted underline-offset-2">{children}</span>
    </Tooltip>
  );
}

function refLabel(input: RecipeInput, ingredientsById: Map<string, Ingredient>, recipesById: Map<string, Recipe>) {
  if (input.type === "ingredient") return ingredientsById.get(input.ref_id)?.name ?? "(unknown)";
  return recipesById.get(input.ref_id)?.name ?? "(unknown)";
}

function BreakdownContent({ result, ingredientsById, recipesById }: Omit<Props, "children">) {
  return (
    <div className="space-y-2.5">
      <div className="label-cap">Cost breakdown</div>
      <ul className="space-y-2 text-sm">
        {result.inputs.map((entry, i) => (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-text-primary">
                {refLabel(entry.input, ingredientsById, recipesById)}
                <span className="text-text-muted nums ml-1">
                  · {entry.input.quantity} {entry.input.unit === "fl_oz" ? "fl oz" : entry.input.unit}
                </span>
              </span>
              <span className="hero-num text-text-primary nums">
                {entry.cost.conversionMissing ? (
                  <span className="text-warning inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                    set up
                  </span>
                ) : (
                  formatMoney(entry.cost.cost)
                )}
              </span>
            </div>
            <div className="text-xs text-text-muted nums">{entry.cost.detail}</div>
            {entry.cost.children && entry.cost.children.length > 0 && (
              <ul className="mt-1.5 ml-4 border-l border-border pl-3 space-y-1.5">
                {entry.cost.children.map((c, j) => (
                  <li key={j} className="text-xs">
                    <div className="flex justify-between gap-2 text-text-secondary">
                      <span>{c.label}</span>
                      <span className="nums">{formatMoney(c.amount)}</span>
                    </div>
                    <div className="text-text-muted nums">{c.detail}</div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-border pt-2 flex items-baseline justify-between">
        <span className="text-text-secondary">Total</span>
        <span className="hero-num text-text-primary nums">{formatMoney(result.total_cost)}</span>
      </div>
    </div>
  );
}
