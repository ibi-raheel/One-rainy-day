import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/store/app";
import type { Recipe } from "@/db/types";
import { scaleRecipe, formatQty } from "@/lib/scale";
import { unitLabel } from "@/lib/units";
import { formatMoney } from "@/lib/cost";
import { ChefHat, Sprout, Copy, Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipe: Recipe;
}

export function ScaleDialog({ open, onOpenChange, recipe }: Props) {
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);

  const [target, setTarget] = useState<string>(String(recipe.yield_quantity || 1));
  const [copied, setCopied] = useState(false);
  const targetNum = parseFloat(target) || 0;

  const result = useMemo(() => {
    if (targetNum <= 0) return null;
    return scaleRecipe(recipe, targetNum, ingredientsById, recipesById);
  }, [recipe, targetNum, ingredientsById, recipesById]);

  const presets = [recipe.yield_quantity, recipe.yield_quantity * 5, recipe.yield_quantity * 10, recipe.yield_quantity * 25, recipe.yield_quantity * 50];

  const copyToClipboard = async () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`PREP LIST — ${recipe.name}`);
    lines.push(`Target: ${formatQty(result.target_qty)} ${unitLabel(result.target_unit)}  (×${result.multiplier.toFixed(2)})`);
    lines.push(`Estimated ingredient cost: ${formatMoney(result.total_cost)}`);
    lines.push("");
    if (result.sub_batches.length > 0) {
      lines.push("Sub-recipes to make first:");
      for (const b of result.sub_batches) {
        lines.push(`  • ${b.recipe.name}: ${formatQty(b.batches)} batch${b.batches === 1 ? "" : "es"}  →  ${formatQty(b.yield_qty)} ${unitLabel(b.yield_unit)}`);
      }
      lines.push("");
    }
    lines.push("Ingredients (in package units):");
    for (const i of result.ingredients) {
      lines.push(`  • ${i.ingredient.name}: ${formatQty(i.qty_in_package_unit)} ${unitLabel(i.ingredient.package_unit)}  (${formatMoney(i.cost)})`);
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Scale — ${recipe.name}`}
      description="Plug in how much you need to make. We'll work out the prep list across every sub-recipe and ingredient."
      size="lg"
    >
      <div className="space-y-5">
        <div>
          <Label>Target quantity</Label>
          <div className="flex gap-2 items-end">
            <Input
              type="number"
              step="any"
              min="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="max-w-[160px]"
              autoFocus
            />
            <span className="text-text-secondary pb-2.5 nums">{unitLabel(recipe.yield_unit)}</span>
            <span className="text-xs text-text-muted pb-3 ml-2">
              (recipe makes {recipe.yield_quantity} {unitLabel(recipe.yield_unit)} per batch)
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTarget(String(p))}
                className={cn(
                  "rounded-sm px-2 py-1 text-xs border transition-colors duration-100",
                  parseFloat(target) === p
                    ? "bg-accent-soft border-accent text-text-primary"
                    : "bg-bg-surface border-border text-text-secondary hover:border-border-strong"
                )}
              >
                {p === recipe.yield_quantity ? "1×" : `${p / recipe.yield_quantity}×`} ({formatQty(p)} {unitLabel(recipe.yield_unit)})
              </button>
            ))}
          </div>
        </div>

        {result && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="card px-4 py-3">
                <div className="label-cap">Multiplier</div>
                <div className="hero-num text-xl text-text-primary mt-1 nums">×{result.multiplier.toFixed(2)}</div>
              </div>
              <div className="card px-4 py-3">
                <div className="label-cap">Estimated cost</div>
                <div className="hero-num text-xl text-text-primary mt-1 nums">{formatMoney(result.total_cost)}</div>
              </div>
            </div>

            {result.sub_batches.length > 0 && (
              <div>
                <h3 className="display text-base text-text-primary mb-2">Sub-recipes to prep first</h3>
                <ul className="space-y-2">
                  {result.sub_batches.map((b) => (
                    <li key={b.recipe.id} className="rounded border border-border bg-bg-surfaceAlt px-3 py-2 flex items-center gap-3">
                      <ChefHat className="h-3.5 w-3.5 text-info shrink-0" strokeWidth={1.5} />
                      <span className="font-medium text-text-primary">{b.recipe.name}</span>
                      <span className="ml-auto text-sm nums text-text-secondary">
                        {formatQty(b.batches)} batch{b.batches === 1 ? "" : "es"}
                        <span className="text-text-muted"> · </span>
                        <span className="text-text-primary">{formatQty(b.yield_qty)} {unitLabel(b.yield_unit)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="display text-base text-text-primary mb-2">Ingredients</h3>
              <div className="rounded border border-border bg-bg-surface overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-bg-surfaceAlt">
                      <th className="label-cap text-left px-3 py-2">Ingredient</th>
                      <th className="label-cap text-right px-3 py-2">In your package unit</th>
                      <th className="label-cap text-right px-3 py-2 pr-3">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.ingredients.map((i, idx) => (
                      <tr key={i.ingredient.id} className={cn("border-b border-border last:border-0", idx % 2 === 1 && "bg-bg-surfaceAlt/40")}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Sprout className="h-3 w-3 text-success shrink-0" strokeWidth={1.5} />
                            <span className="text-sm font-medium text-text-primary">{i.ingredient.name}</span>
                          </div>
                          <div className="text-xs text-text-muted nums mt-0.5 ml-5">
                            = {formatQty(i.qty_in_base_unit)} {i.ingredient.base_unit}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right hero-num text-base nums">
                          {formatQty(i.qty_in_package_unit)} {unitLabel(i.ingredient.package_unit)}
                        </td>
                        <td className="px-3 py-2 pr-3 text-right nums">{formatMoney(i.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                {copied ? "Copied!" : "Copy prep list"}
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
