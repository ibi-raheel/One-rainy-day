import { convertToBaseUnit, convertToBaseUnitWithTrace, type Unit, type BaseUnit, type DensityFactor, type ConversionTrace } from "./units";
import type { Ingredient, Recipe, RecipeInput } from "@/db/types";

export interface CostBreakdownEntry {
  label: string;
  amount: number; // dollars
  detail: string; // e.g. "12g matcha @ $0.038/g"
  conversionMissing?: boolean;
  cycle?: boolean;
  children?: CostBreakdownEntry[];
}

/**
 * Rich, structured breakdown for one input row.
 * Includes the conversion trace (how we got from input qty → base) and the cost math.
 * For sub-recipe inputs, includes the recursive breakdown.
 */
export interface InputBreakdown {
  kind: "ingredient" | "recipe" | "missing" | "cycle";
  name: string;
  input_qty: number;
  input_unit: Unit;
  trace?: ConversionTrace;
  // Ingredient-specific
  ingredient_cost_per_base?: number;
  ingredient_base_unit?: BaseUnit;
  // Sub-recipe-specific
  sub_recipe_total_cost?: number;
  sub_recipe_yield_qty?: number;
  sub_recipe_yield_unit?: Unit;
  sub_recipe_yield_in_base?: number;
  sub_recipe_cost_per_yield_base?: number;
  sub_recipe_yield_base?: BaseUnit;
  sub_breakdown?: RecipeCostResult;
  // Final
  cost: number;
  note?: string;
}

export interface InputCost {
  cost: number;
  detail: string;
  conversionMissing?: boolean;
  cycle?: boolean;
  children?: CostBreakdownEntry[];
  breakdown: InputBreakdown;
}

export interface RecipeCostResult {
  total_cost: number;
  cost_per_yield_unit: number; // in the recipe's yield base unit
  yield_base: BaseUnit;
  yield_in_base: number;
  inputs: { input: RecipeInput; cost: InputCost }[];
  hasMissingConversion: boolean;
  hasCycle: boolean;
}

/** Compute package qty in base unit and per-base-unit cost. Includes optional delivery surcharge. */
export function computeCostPerBaseUnit(
  package_quantity: number,
  package_unit: Unit,
  package_cost: number,
  base_unit: BaseUnit,
  density_factors: readonly DensityFactor[],
  delivery_cost: number = 0
): number {
  const baseAmount = convertToBaseUnit(package_quantity, package_unit, base_unit, density_factors);
  if (baseAmount == null || baseAmount === 0) return 0;
  return (package_cost + (delivery_cost || 0)) / baseAmount;
}

/** A recipe with a yield is "ingredient-like": its cost-per-yield-unit lets it be used as an input. */
export function recipeYieldBase(recipe: Recipe): BaseUnit {
  return baseFromUnit(recipe.yield_unit);
}

function baseFromUnit(u: Unit): BaseUnit {
  // mirror units.baseUnitFor without circular import
  if (u === "g" || u === "kg" || u === "oz" || u === "lb") return "g";
  if (u === "piece") return "piece";
  return "ml";
}

/** Detect cycles: returns the path of recipe ids if a cycle is found from `start`. */
export function findRecipeCycle(
  start: Recipe,
  recipesById: Map<string, Recipe>
): string[] | null {
  const visiting = new Set<string>();
  const path: string[] = [];

  function visit(id: string): boolean {
    if (visiting.has(id)) {
      path.push(id);
      return true;
    }
    visiting.add(id);
    path.push(id);
    const r = recipesById.get(id);
    if (r) {
      for (const inp of r.inputs) {
        if (inp.type === "recipe" && visit(inp.ref_id)) return true;
      }
    }
    visiting.delete(id);
    path.pop();
    return false;
  }

  if (visit(start.id)) return [...path];
  return null;
}

/**
 * Recursively compute the cost of a recipe.
 * - For ingredient inputs: convert qty to base unit; multiply by ingredient.cost_per_base_unit.
 * - For sub-recipe inputs: recursively compute the sub-recipe's cost-per-yield-unit; convert qty to that base.
 * Cycles are detected via the visited stack and returned as cycle:true (cost 0).
 */
export function computeRecipeCost(
  recipe: Recipe,
  ingredientsById: Map<string, Ingredient>,
  recipesById: Map<string, Recipe>,
  visited: Set<string> = new Set()
): RecipeCostResult {
  const yield_base = recipeYieldBase(recipe);
  const yield_in_base = convertToBaseUnit(recipe.yield_quantity, recipe.yield_unit, yield_base, []) ?? 0;

  const inputs: RecipeCostResult["inputs"] = [];
  let total = 0;
  let missing = false;
  let cycle = false;

  // Mark this recipe as being computed for cycle detection
  const nextVisited = new Set(visited);
  nextVisited.add(recipe.id);

  for (const inp of recipe.inputs) {
    const cost = computeInputCost(inp, ingredientsById, recipesById, nextVisited);
    inputs.push({ input: inp, cost });
    total += cost.cost;
    if (cost.conversionMissing) missing = true;
    if (cost.cycle) cycle = true;
  }

  const cost_per_yield_unit = yield_in_base > 0 ? total / yield_in_base : 0;

  return {
    total_cost: total,
    cost_per_yield_unit,
    yield_base,
    yield_in_base,
    inputs,
    hasMissingConversion: missing,
    hasCycle: cycle,
  };
}

export function computeInputCost(
  input: RecipeInput,
  ingredientsById: Map<string, Ingredient>,
  recipesById: Map<string, Recipe>,
  visited: Set<string>
): InputCost {
  if (input.type === "ingredient") {
    const ing = ingredientsById.get(input.ref_id);
    if (!ing) {
      return {
        cost: 0,
        detail: "Ingredient not found",
        conversionMissing: true,
        breakdown: {
          kind: "missing",
          name: "(missing ingredient)",
          input_qty: input.quantity,
          input_unit: input.unit,
          cost: 0,
          note: "This ingredient was deleted.",
        },
      };
    }
    const trace = convertToBaseUnitWithTrace(input.quantity, input.unit, ing.base_unit, ing.density_factors);
    if (!trace) {
      return {
        cost: 0,
        detail: `Cannot convert ${input.quantity} ${input.unit} of ${ing.name} to ${ing.base_unit}`,
        conversionMissing: true,
        breakdown: {
          kind: "missing",
          name: ing.name,
          input_qty: input.quantity,
          input_unit: input.unit,
          ingredient_cost_per_base: ing.cost_per_base_unit,
          ingredient_base_unit: ing.base_unit,
          cost: 0,
          note: `No density factor for ${input.unit} → ${ing.base_unit}. Add one on the ingredient.`,
        },
      };
    }
    const cost = trace.base_amount * ing.cost_per_base_unit;
    return {
      cost,
      detail: `${formatNum(trace.base_amount)}${ing.base_unit} ${ing.name} @ $${ing.cost_per_base_unit.toFixed(4)}/${ing.base_unit}`,
      breakdown: {
        kind: "ingredient",
        name: ing.name,
        input_qty: input.quantity,
        input_unit: input.unit,
        trace,
        ingredient_cost_per_base: ing.cost_per_base_unit,
        ingredient_base_unit: ing.base_unit,
        cost,
      },
    };
  }

  // sub-recipe input
  const sub = recipesById.get(input.ref_id);
  if (!sub) {
    return {
      cost: 0,
      detail: "Sub-recipe not found",
      conversionMissing: true,
      breakdown: {
        kind: "missing",
        name: "(missing sub-recipe)",
        input_qty: input.quantity,
        input_unit: input.unit,
        cost: 0,
      },
    };
  }
  if (visited.has(sub.id)) {
    return {
      cost: 0,
      detail: `Cycle: ${sub.name}`,
      cycle: true,
      breakdown: {
        kind: "cycle",
        name: sub.name,
        input_qty: input.quantity,
        input_unit: input.unit,
        cost: 0,
        note: "Recipe references itself — cycle detected.",
      },
    };
  }
  const subResult = computeRecipeCost(sub, ingredientsById, recipesById, visited);
  const trace = convertToBaseUnitWithTrace(input.quantity, input.unit, subResult.yield_base, sub.density_factors ?? []);
  if (!trace) {
    return {
      cost: 0,
      detail: `Cannot convert ${input.quantity} ${input.unit} of ${sub.name} to ${subResult.yield_base}`,
      conversionMissing: true,
      breakdown: {
        kind: "missing",
        name: sub.name,
        input_qty: input.quantity,
        input_unit: input.unit,
        sub_recipe_yield_qty: sub.yield_quantity,
        sub_recipe_yield_unit: sub.yield_unit,
        cost: 0,
        note: `Cannot convert ${input.unit} of ${sub.name} (yields in ${sub.yield_unit}).`,
      },
    };
  }
  const cost = trace.base_amount * subResult.cost_per_yield_unit;
  const children: CostBreakdownEntry[] = subResult.inputs.map((entry) => ({
    label: refLabel(entry.input, ingredientsById, recipesById),
    amount: entry.cost.cost,
    detail: entry.cost.detail,
    conversionMissing: entry.cost.conversionMissing,
    cycle: entry.cost.cycle,
    children: entry.cost.children,
  }));
  return {
    cost,
    detail: `${formatNum(trace.base_amount)}${subResult.yield_base} of ${sub.name} @ $${subResult.cost_per_yield_unit.toFixed(4)}/${subResult.yield_base}`,
    children,
    breakdown: {
      kind: "recipe",
      name: sub.name,
      input_qty: input.quantity,
      input_unit: input.unit,
      trace,
      sub_recipe_total_cost: subResult.total_cost,
      sub_recipe_yield_qty: sub.yield_quantity,
      sub_recipe_yield_unit: sub.yield_unit,
      sub_recipe_yield_in_base: subResult.yield_in_base,
      sub_recipe_cost_per_yield_base: subResult.cost_per_yield_unit,
      sub_recipe_yield_base: subResult.yield_base,
      sub_breakdown: subResult,
      cost,
    },
  };
}

function refLabel(input: RecipeInput, ingredientsById: Map<string, Ingredient>, recipesById: Map<string, Recipe>): string {
  if (input.type === "ingredient") {
    return ingredientsById.get(input.ref_id)?.name ?? "(unknown ingredient)";
  }
  return recipesById.get(input.ref_id)?.name ?? "(unknown recipe)";
}

function formatNum(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** Format dollar amounts with 2 decimal places typically; smaller amounts get 3. */
export function formatMoney(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) < 0.01 && n !== 0) return `$${n.toFixed(4)}`;
  if (Math.abs(n) < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function formatPercent(n: number): string {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Returns each recipe that uses the target ingredient, along with how much it consumes per
 * one batch of that recipe's stated yield. Walks transitively through sub-recipes.
 */
export interface IngredientUsage {
  recipe: Recipe;
  /** Total ingredient consumption (in ingredient's base unit) per one yield batch of this recipe. */
  base_amount_per_batch: number;
  /** True if this recipe lists the ingredient as a direct input (not via a sub-recipe). */
  direct: boolean;
  /** If direct, the original input row (qty + unit as the user wrote it). */
  direct_input?: { quantity: number; unit: Unit };
  /** For transitive usage, the sub-recipes the ingredient flows through. */
  via?: Recipe[];
}

export function findIngredientUsage(
  ingredient: Ingredient,
  recipes: Recipe[],
  ingredientsById: Map<string, Ingredient>,
  recipesById: Map<string, Recipe>
): IngredientUsage[] {
  const out: IngredientUsage[] = [];
  for (const recipe of recipes) {
    const result = walkUsage(ingredient.id, recipe, ingredientsById, recipesById, new Set(), []);
    if (result.amount > 0) {
      const directInput = recipe.inputs.find(
        (i) => i.type === "ingredient" && i.ref_id === ingredient.id
      );
      out.push({
        recipe,
        base_amount_per_batch: result.amount,
        direct: !!directInput,
        direct_input: directInput ? { quantity: directInput.quantity, unit: directInput.unit } : undefined,
        via: directInput ? undefined : result.via,
      });
    }
  }
  return out;
}

interface WalkResult { amount: number; via: Recipe[] }

function walkUsage(
  ingredientId: string,
  recipe: Recipe,
  ingredientsById: Map<string, Ingredient>,
  recipesById: Map<string, Recipe>,
  visited: Set<string>,
  path: Recipe[]
): WalkResult {
  if (visited.has(recipe.id)) return { amount: 0, via: [] };
  const next = new Set(visited);
  next.add(recipe.id);

  let total = 0;
  let viaSet = new Set<string>();

  for (const inp of recipe.inputs) {
    if (inp.type === "ingredient") {
      if (inp.ref_id !== ingredientId) continue;
      const ing = ingredientsById.get(inp.ref_id);
      if (!ing) continue;
      const baseAmt = convertToBaseUnit(inp.quantity, inp.unit, ing.base_unit, ing.density_factors);
      if (baseAmt != null) total += baseAmt;
    } else {
      const sub = recipesById.get(inp.ref_id);
      if (!sub) continue;
      const subBase: BaseUnit = baseFromUnit(sub.yield_unit);
      const inpInSubBase = convertToBaseUnit(inp.quantity, inp.unit, subBase, sub.density_factors ?? []);
      if (inpInSubBase == null) continue;
      const subYieldInBase = convertToBaseUnit(sub.yield_quantity, sub.yield_unit, subBase, []);
      if (!subYieldInBase) continue;
      const subResult = walkUsage(ingredientId, sub, ingredientsById, recipesById, next, [...path, sub]);
      if (subResult.amount > 0) {
        total += (inpInSubBase / subYieldInBase) * subResult.amount;
        viaSet.add(sub.id);
        for (const v of subResult.via) viaSet.add(v.id);
      }
    }
  }

  const via: Recipe[] = [];
  for (const id of viaSet) {
    const r = recipesById.get(id);
    if (r) via.push(r);
  }
  return { amount: total, via };
}

/** Returns total demand per base unit per ingredient given menu items + sales volume. */
export interface IngredientDemand {
  ingredient: Ingredient;
  base_amount: number; // demand in base unit per period
  package_amount: number; // suggested order quantity in package_unit
  cost: number; // total cost for that demand
}

export function computeDemand(
  ingredients: Ingredient[],
  menuItems: Recipe[],
  recipesById: Map<string, Recipe>,
  ingredientsById: Map<string, Ingredient>
): IngredientDemand[] {
  // For each menu item with sales volume, walk through inputs and accumulate base-unit usage per ingredient.
  const demand = new Map<string, number>(); // ingredient id -> base-unit qty

  function accumulate(qty: number, base: BaseUnit, recipe: Recipe, multiplier: number) {
    const yieldInBase = convertToBaseUnit(recipe.yield_quantity, recipe.yield_unit, base, []) ?? 0;
    const scale = yieldInBase > 0 ? qty / yieldInBase : 0;
    for (const inp of recipe.inputs) {
      if (inp.type === "ingredient") {
        const ing = ingredientsById.get(inp.ref_id);
        if (!ing) continue;
        const baseAmt = convertToBaseUnit(inp.quantity, inp.unit, ing.base_unit, ing.density_factors);
        if (baseAmt == null) continue;
        demand.set(ing.id, (demand.get(ing.id) ?? 0) + baseAmt * scale * multiplier);
      } else {
        const sub = recipesById.get(inp.ref_id);
        if (!sub) continue;
        const subBase: BaseUnit = baseFromUnit(sub.yield_unit);
        const inpInSubBase = convertToBaseUnit(inp.quantity, inp.unit, subBase, sub.density_factors ?? []) ?? 0;
        accumulate(inpInSubBase, subBase, sub, scale * multiplier);
      }
    }
  }

  for (const m of menuItems) {
    const sales = m.sales_volume_per_period ?? 0;
    if (sales <= 0) continue;
    const base: BaseUnit = baseFromUnit(m.yield_unit);
    const oneServingInBase = convertToBaseUnit(m.yield_quantity, m.yield_unit, base, []) ?? 0;
    accumulate(oneServingInBase * sales, base, m, 1);
  }

  return ingredients.map((ing) => {
    const baseRaw = demand.get(ing.id) ?? 0;
    const base_amount = baseRaw * ing.waste_factor;
    const cost = base_amount * ing.cost_per_base_unit;
    // suggested package_amount = base_amount converted back to package_unit class via reverse of cost calc:
    // packageQtyInBase = package_quantity * (package_quantity_in_base / package_quantity)
    // Easier: pkg_in_base = package_cost / cost_per_base_unit (since cost_per_base_unit = package_cost / pkg_in_base)
    const pkgInBase = ing.cost_per_base_unit > 0 ? ing.package_cost / ing.cost_per_base_unit : 0;
    const package_amount = pkgInBase > 0 ? base_amount / pkgInBase : 0;
    return { ingredient: ing, base_amount, package_amount, cost };
  });
}
