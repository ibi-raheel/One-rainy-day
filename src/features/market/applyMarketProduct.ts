/**
 * Compute what an Ingredient should look like after pulling pack info from a
 * market product. Pure function — doesn't write anything.
 *
 * Updates: package_quantity, package_unit, package_cost, vendor, cost_per_base_unit.
 * Preserves: name, density_factors, delivery_cost (user may have allocated it),
 *   waste_factor, allergens, dietary_flags, notes, base_unit, id, created_at.
 */

import { computeCostPerBaseUnit } from "@/lib/cost";
import type { Unit } from "@/lib/units";
import type { Ingredient } from "@/db/types";

export interface MarketProductLite {
  source_name: string;
  title: string;
  pack_size_text: string;
  price: number;
  pack: { count: number; oz: number | null; ml: number | null; g: number | null };
  per_g: number | null;
  per_ml: number | null;
  url: string;
}

export type ApplyKind =
  | { kind: "ok"; package_quantity: number; package_unit: Unit }
  | { kind: "needs_manual"; reason: string };

/** Decide what package_quantity + package_unit to use. */
export function packForIngredient(
  ingredient: Pick<Ingredient, "base_unit">,
  product: MarketProductLite
): ApplyKind {
  const base = ingredient.base_unit;
  const { ml, g } = product.pack;
  if (base === "g" && g != null && g > 0) {
    return { kind: "ok", package_quantity: round(g, 2), package_unit: "g" };
  }
  if (base === "ml" && ml != null && ml > 0) {
    return { kind: "ok", package_quantity: round(ml, 2), package_unit: "ml" };
  }
  if (base === "piece" && product.pack.count > 0) {
    return { kind: "ok", package_quantity: product.pack.count, package_unit: "piece" };
  }
  // fallbacks where unit class doesn't match
  if (base === "g" && ml != null && ml > 0) {
    return { kind: "needs_manual", reason: "Product is sold by volume but ingredient is weight-based. Pick a unit manually." };
  }
  if (base === "ml" && g != null && g > 0) {
    return { kind: "needs_manual", reason: "Product is sold by weight but ingredient is volume-based. Pick a unit manually." };
  }
  return { kind: "needs_manual", reason: "Couldn't parse pack size from the product. Enter qty + unit by hand." };
}

function round(n: number, d: number): number {
  const k = Math.pow(10, d);
  return Math.round(n * k) / k;
}

export interface ApplyPreview {
  current: {
    vendor: string | undefined;
    package_quantity: number;
    package_unit: Unit;
    package_cost: number;
    cost_per_base: number;
  };
  next: {
    vendor: string;
    package_quantity: number;
    package_unit: Unit;
    package_cost: number;
    cost_per_base: number;
  };
  delta_pct: number; // negative = cheaper
  cannot: string | null;
}

export function buildApplyPreview(
  ingredient: Ingredient,
  product: MarketProductLite
): ApplyPreview {
  const decision = packForIngredient(ingredient, product);
  if (decision.kind !== "ok") {
    return {
      current: {
        vendor: ingredient.vendor,
        package_quantity: ingredient.package_quantity,
        package_unit: ingredient.package_unit,
        package_cost: ingredient.package_cost,
        cost_per_base: ingredient.cost_per_base_unit,
      },
      next: {
        vendor: product.source_name,
        package_quantity: 0,
        package_unit: ingredient.package_unit,
        package_cost: product.price,
        cost_per_base: 0,
      },
      delta_pct: 0,
      cannot: decision.reason,
    };
  }
  const newCpb = computeCostPerBaseUnit(
    decision.package_quantity,
    decision.package_unit,
    product.price,
    ingredient.base_unit,
    ingredient.density_factors,
    ingredient.delivery_cost
  );
  const oldCpb = ingredient.cost_per_base_unit || 0;
  const delta_pct = oldCpb > 0 ? ((newCpb - oldCpb) / oldCpb) * 100 : 0;
  return {
    current: {
      vendor: ingredient.vendor,
      package_quantity: ingredient.package_quantity,
      package_unit: ingredient.package_unit,
      package_cost: ingredient.package_cost,
      cost_per_base: oldCpb,
    },
    next: {
      vendor: product.source_name,
      package_quantity: decision.package_quantity,
      package_unit: decision.package_unit,
      package_cost: round(product.price, 2),
      cost_per_base: newCpb,
    },
    delta_pct,
    cannot: null,
  };
}

export function applyToIngredient(
  ingredient: Ingredient,
  product: MarketProductLite
): Ingredient | null {
  const preview = buildApplyPreview(ingredient, product);
  if (preview.cannot) return null;
  return {
    ...ingredient,
    vendor: preview.next.vendor,
    package_quantity: preview.next.package_quantity,
    package_unit: preview.next.package_unit,
    package_cost: preview.next.package_cost,
    cost_per_base_unit: preview.next.cost_per_base,
    updated_at: new Date().toISOString(),
  };
}
