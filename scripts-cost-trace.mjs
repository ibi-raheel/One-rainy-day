// End-to-end cost trace using the same engine the UI uses.
// Builds the canonical matcha latte and verifies the cost matches our
// hand-calc from the original spec.

import { computeCostPerBaseUnit, computeRecipeCost } from "./src/lib/cost";

const ingredients = {
  matcha: {
    id: "matcha", name: "Matcha", vendor: "Rishi",
    package_quantity: 100, package_unit: "g", package_cost: 38, delivery_cost: 0,
    base_unit: "g",
    cost_per_base_unit: 0,  // computed
    density_factors: [{ from_unit: "tbsp", base_unit_amount: 6, source: "library" }],
    waste_factor: 1, allergens: [], dietary_flags: [],
  },
  milk: {
    id: "milk", name: "Whole milk", vendor: "Sam's Club",
    package_quantity: 1, package_unit: "gallon", package_cost: 3.48, delivery_cost: 0,
    base_unit: "ml",
    cost_per_base_unit: 0,
    density_factors: [],
    waste_factor: 1, allergens: ["dairy"], dietary_flags: [],
  },
  cm: {
    id: "cm", name: "Coffee mate", vendor: "Sam's Club",
    package_quantity: 56, package_unit: "oz", package_cost: 10, delivery_cost: 0,
    base_unit: "g",
    cost_per_base_unit: 0,
    density_factors: [{ from_unit: "cup", base_unit_amount: 96, source: "library" }],
    waste_factor: 1, allergens: [], dietary_flags: [],
  },
  cream: {
    id: "cream", name: "Heavy cream", vendor: "Sam's Club",
    package_quantity: 192, package_unit: "fl_oz", package_cost: 14.72, delivery_cost: 0,
    base_unit: "ml",
    cost_per_base_unit: 0,
    density_factors: [],
    waste_factor: 1, allergens: ["dairy"], dietary_flags: [],
  },
  sugar: {
    id: "sugar", name: "Sugar", vendor: "Sam's Club",
    package_quantity: 10, package_unit: "lb", package_cost: 6.58, delivery_cost: 0,
    base_unit: "g",
    cost_per_base_unit: 0,
    density_factors: [{ from_unit: "cup", base_unit_amount: 200, source: "library" }],
    waste_factor: 1, allergens: [], dietary_flags: [],
  },
};

// Compute cost-per-base-unit for each
for (const k of Object.keys(ingredients)) {
  const i = ingredients[k];
  i.cost_per_base_unit = computeCostPerBaseUnit(
    i.package_quantity, i.package_unit, i.package_cost, i.base_unit, i.density_factors, i.delivery_cost
  );
  console.log(`${i.name.padEnd(15)} cost/${i.base_unit} = $${i.cost_per_base_unit.toFixed(6)}`);
}

const recipes = {
  syrup: {
    id: "syrup", name: "Simple syrup", type: "sub_recipe",
    inputs: [
      { row_id: "1", type: "ingredient", ref_id: "sugar", quantity: 1, unit: "cup" },
    ],
    yield_quantity: 355, yield_unit: "ml",
    density_factors: [], created_at: "", updated_at: "",
  },
  matchaSauce: {
    id: "matchaSauce", name: "Matcha sauce", type: "sub_recipe",
    inputs: [
      { row_id: "1", type: "ingredient", ref_id: "matcha", quantity: 2, unit: "tbsp" },
      { row_id: "2", type: "recipe", ref_id: "syrup", quantity: 2, unit: "tbsp" },
    ],
    yield_quantity: 100, yield_unit: "ml",
    density_factors: [], created_at: "", updated_at: "",
  },
  mixedMilk: {
    id: "mixedMilk", name: "Mixed milk", type: "sub_recipe",
    inputs: [
      { row_id: "1", type: "ingredient", ref_id: "cm", quantity: 1, unit: "cup" },
      { row_id: "2", type: "ingredient", ref_id: "milk", quantity: 1, unit: "gallon" },
      { row_id: "3", type: "ingredient", ref_id: "cream", quantity: 2, unit: "cup" },
    ],
    yield_quantity: 5000, yield_unit: "ml",
    density_factors: [], created_at: "", updated_at: "",
  },
  latte: {
    id: "latte", name: "Matcha latte", type: "menu_item",
    inputs: [
      { row_id: "1", type: "recipe", ref_id: "matchaSauce", quantity: 4, unit: "tbsp" },
      { row_id: "2", type: "recipe", ref_id: "mixedMilk", quantity: 1.5, unit: "cup" },
    ],
    yield_quantity: 1, yield_unit: "piece",
    density_factors: [], created_at: "", updated_at: "",
    sale_price: 6.50,
  },
};

const ingMap = new Map(Object.values(ingredients).map(i => [i.id, i]));
const recMap = new Map(Object.values(recipes).map(r => [r.id, r]));

for (const r of Object.values(recipes)) {
  const c = computeRecipeCost(r, ingMap, recMap);
  console.log(`${r.name.padEnd(15)} total = $${c.total_cost.toFixed(4)}  per ${r.yield_unit} = $${(c.total_cost / r.yield_quantity).toFixed(4)}`);
}

const latteCost = computeRecipeCost(recipes.latte, ingMap, recMap);
console.log(`\nMatcha latte: $${latteCost.total_cost.toFixed(2)} (expected ~$3.04)`);
const margin = (recipes.latte.sale_price - latteCost.total_cost) / recipes.latte.sale_price;
console.log(`Margin at $6.50 sale: ${(margin * 100).toFixed(1)}% (expected ~53%)`);
