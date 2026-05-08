/**
 * Batch / prep scaling.
 *
 * Given a recipe and a target output quantity, compute:
 *   - the multiplier (target / current_yield)
 *   - the flat list of ingredients needed at that multiplier
 *   - the list of sub-recipe batches that need to be made first
 *
 * Ingredient quantities are reported in BOTH the input unit (as the recipe
 * was written) AND the package unit (so the cafe knows how much to grab off
 * the shelf), with a base-unit equivalent for cross-checking.
 */

import { convertToBaseUnit, convertFromBaseUnit, unitLabel, type Unit } from "./units";
import type { Ingredient, Recipe } from "@/db/types";

export interface ScaledIngredient {
  ingredient: Ingredient;
  /** As-written total: same unit the parent recipe used in its input row. */
  qty_input_unit: number;
  input_unit: Unit;
  /** Same total expressed in the ingredient's own package unit. */
  qty_in_package_unit: number;
  /** Base-unit total (for sanity checking). */
  qty_in_base_unit: number;
  /** Estimated cost contribution. */
  cost: number;
}

export interface ScaledSubRecipeBatch {
  recipe: Recipe;
  /** How many full batches to make (fractional). */
  batches: number;
  /** Total yield needed in the recipe's yield unit. */
  yield_qty: number;
  yield_unit: Unit;
}

export interface ScaleResult {
  recipe: Recipe;
  multiplier: number;
  target_qty: number;
  target_unit: Unit;
  ingredients: ScaledIngredient[];
  sub_batches: ScaledSubRecipeBatch[];
  total_cost: number;
}

export function scaleRecipe(
  recipe: Recipe,
  targetQty: number,
  ingredientsById: Map<string, Ingredient>,
  recipesById: Map<string, Recipe>
): ScaleResult {
  const multiplier = recipe.yield_quantity > 0 ? targetQty / recipe.yield_quantity : 1;

  // Flatten: walk inputs, collect ingredient totals (transitively through sub-recipes)
  const ingTotals = new Map<string, { qty_input: number; unit: Unit; base: number }>();
  const subBatches = new Map<string, { batches: number; yield_qty: number }>();

  function walk(rec: Recipe, scale: number, visited: Set<string>) {
    if (visited.has(rec.id)) return;
    const next = new Set(visited);
    next.add(rec.id);

    for (const inp of rec.inputs) {
      if (inp.type === "ingredient") {
        const ing = ingredientsById.get(inp.ref_id);
        if (!ing) continue;
        const baseAmt = convertToBaseUnit(inp.quantity, inp.unit, ing.base_unit, ing.density_factors);
        if (baseAmt == null) continue;
        const prev = ingTotals.get(ing.id);
        const scaledQtyInput = inp.quantity * scale;
        const scaledBase = baseAmt * scale;
        if (prev && prev.unit === inp.unit) {
          ingTotals.set(ing.id, {
            qty_input: prev.qty_input + scaledQtyInput,
            unit: prev.unit,
            base: prev.base + scaledBase,
          });
        } else if (prev) {
          // Different units used in different inputs — convert and accumulate via base.
          ingTotals.set(ing.id, {
            qty_input: prev.qty_input,
            unit: prev.unit,
            base: prev.base + scaledBase,
          });
        } else {
          ingTotals.set(ing.id, { qty_input: scaledQtyInput, unit: inp.unit, base: scaledBase });
        }
      } else {
        const sub = recipesById.get(inp.ref_id);
        if (!sub) continue;
        // The qty of sub-recipe needed AT THE PARENT scale
        const subBase: import("./units").BaseUnit =
          sub.yield_unit === "g" || sub.yield_unit === "kg" || sub.yield_unit === "oz" || sub.yield_unit === "lb"
            ? "g"
            : sub.yield_unit === "piece"
            ? "piece"
            : "ml";
        const subBaseAmt = convertToBaseUnit(inp.quantity, inp.unit, subBase, sub.density_factors ?? []);
        const subYieldInBase = convertToBaseUnit(sub.yield_quantity, sub.yield_unit, subBase, []);
        if (!subBaseAmt || !subYieldInBase) continue;
        const usedBatches = (subBaseAmt / subYieldInBase) * scale;
        const usedYield = sub.yield_quantity * usedBatches;
        const prev = subBatches.get(sub.id);
        subBatches.set(sub.id, {
          batches: (prev?.batches ?? 0) + usedBatches,
          yield_qty: (prev?.yield_qty ?? 0) + usedYield,
        });
        // Recurse so the sub-recipe's own ingredients accumulate too
        walk(sub, scale * usedBatches, next);
      }
    }
  }

  walk(recipe, multiplier, new Set());

  const ingredients: ScaledIngredient[] = [];
  for (const [id, totals] of ingTotals) {
    const ing = ingredientsById.get(id)!;
    const qty_in_package = convertFromBaseUnit(totals.base, ing.base_unit, ing.package_unit, ing.density_factors) ?? 0;
    ingredients.push({
      ingredient: ing,
      qty_input_unit: totals.qty_input,
      input_unit: totals.unit,
      qty_in_package_unit: qty_in_package,
      qty_in_base_unit: totals.base,
      cost: totals.base * ing.cost_per_base_unit,
    });
  }
  ingredients.sort((a, b) => b.cost - a.cost);

  const sub_batches: ScaledSubRecipeBatch[] = [];
  for (const [id, b] of subBatches) {
    const r = recipesById.get(id)!;
    sub_batches.push({
      recipe: r,
      batches: b.batches,
      yield_qty: b.yield_qty,
      yield_unit: r.yield_unit,
    });
  }
  sub_batches.sort((a, b) => b.batches - a.batches);

  const total_cost = ingredients.reduce((s, x) => s + x.cost, 0);

  return {
    recipe,
    multiplier,
    target_qty: targetQty,
    target_unit: recipe.yield_unit,
    ingredients,
    sub_batches,
    total_cost,
  };
}

export function formatQty(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(1);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

export const _unitLabel = unitLabel; // re-export for convenience
