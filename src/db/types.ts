import type { BaseUnit, DensityFactor, Unit } from "@/lib/units";

export const ALLERGENS = [
  "gluten",
  "dairy",
  "eggs",
  "tree nuts",
  "peanuts",
  "soy",
  "sesame",
  "fish",
  "shellfish",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const DIETARY_FLAGS = ["vegetarian", "vegan", "gluten-free"] as const;
export type DietaryFlag = (typeof DIETARY_FLAGS)[number];

export interface Ingredient {
  id: string;
  name: string;
  vendor?: string;
  vendor_sku?: string;
  package_quantity: number;
  package_unit: Unit;
  package_cost: number;
  /** Supplier delivery cost allocated to this ingredient on the most recent purchase. Adds to package_cost when computing per-base-unit cost. */
  delivery_cost: number;
  base_unit: BaseUnit; // derived from package_unit
  cost_per_base_unit: number; // derived from (package_cost + delivery_cost) / package_qty in base_unit
  density_factors: DensityFactor[];
  waste_factor: number; // default 1.0; actual_used = recipe_qty * waste_factor for ordering
  allergens: Allergen[];
  dietary_flags: DietaryFlag[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type RecipeType = "sub_recipe" | "menu_item";

export interface RecipeInput {
  /** stable client-side id for editor row keys */
  row_id: string;
  type: "ingredient" | "recipe";
  ref_id: string;
  quantity: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  name: string;
  type: RecipeType;
  inputs: RecipeInput[];
  yield_quantity: number;
  yield_unit: Unit;
  /**
   * Density factors that let other recipes use this one as an input across unit classes.
   * For example: a syrup that yields in `lb` can declare 1 cup = 0.71 lb so callers can ask for it in cup/tbsp/ml.
   * Same shape as Ingredient.density_factors.
   */
  density_factors: DensityFactor[];
  // menu_item only:
  sale_price?: number;
  sales_volume_per_period?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: "singleton";
  period_label: string; // e.g. "per day", "per week"
}
