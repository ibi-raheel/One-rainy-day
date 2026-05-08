/**
 * Unit conversion engine.
 *
 * Three layers of conversion:
 *  1. Universal volume conversions (cup ↔ tbsp ↔ tsp ↔ ml ↔ fl_oz ↔ pint ↔ quart ↔ gallon ↔ l)
 *  2. Universal weight conversions (g ↔ kg ↔ oz ↔ lb)
 *  3. Per-ingredient density factors (volume ↔ weight, piece ↔ anything)
 *
 * The base units are: g (solids/powders), ml (liquids), piece (countable items).
 * All cost math happens in base units.
 */

export type Unit =
  | "g"
  | "kg"
  | "oz"
  | "lb"
  | "ml"
  | "l"
  | "fl_oz"
  | "tsp"
  | "tbsp"
  | "cup"
  | "pint"
  | "quart"
  | "gallon"
  | "piece";

export type BaseUnit = "g" | "ml" | "piece";

export type UnitClass = "weight" | "volume" | "count";

export interface DensityFactor {
  /** The unit being defined (e.g. "tbsp"). */
  from_unit: Unit;
  /** Amount in the ingredient's base unit. e.g. for matcha (base "g"): from_unit "tbsp", base_unit_amount 6 means 1 tbsp = 6g. */
  base_unit_amount: number;
  source: "library" | "user" | "calibrated";
}

/** US customary measurements — the cafe is in the US. */
const VOLUME_TO_ML: Record<Extract<Unit, "ml" | "l" | "tsp" | "tbsp" | "fl_oz" | "cup" | "pint" | "quart" | "gallon">, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892, // US teaspoon
  tbsp: 14.7868, // US tablespoon
  fl_oz: 29.5735, // US fluid ounce
  cup: 236.588, // US legal cup (240ml is the "metric cup"; 236.588 is the canonical US customary)
  pint: 473.176, // US liquid pint
  quart: 946.353, // US liquid quart
  gallon: 3785.41, // US liquid gallon
};

const WEIGHT_TO_G: Record<Extract<Unit, "g" | "kg" | "oz" | "lb">, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_UNITS: ReadonlySet<Unit> = new Set([
  "ml",
  "l",
  "tsp",
  "tbsp",
  "fl_oz",
  "cup",
  "pint",
  "quart",
  "gallon",
]);
const WEIGHT_UNITS: ReadonlySet<Unit> = new Set(["g", "kg", "oz", "lb"]);
const COUNT_UNITS: ReadonlySet<Unit> = new Set(["piece"]);

export const ALL_UNITS: readonly Unit[] = [
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "l",
  "fl_oz",
  "tsp",
  "tbsp",
  "cup",
  "pint",
  "quart",
  "gallon",
  "piece",
];

export function unitClass(u: Unit): UnitClass {
  if (VOLUME_UNITS.has(u)) return "volume";
  if (WEIGHT_UNITS.has(u)) return "weight";
  return "count";
}

/** Pick a base unit appropriate for the given package unit. */
export function baseUnitFor(u: Unit): BaseUnit {
  const cls = unitClass(u);
  if (cls === "volume") return "ml";
  if (cls === "weight") return "g";
  return "piece";
}

/** Convert any amount of `unit` to ml. Throws if the unit isn't a volume. */
export function toMl(amount: number, unit: Unit): number {
  if (!VOLUME_UNITS.has(unit)) {
    throw new Error(`toMl: ${unit} is not a volume unit`);
  }
  return amount * VOLUME_TO_ML[unit as keyof typeof VOLUME_TO_ML];
}

/** Convert any amount of `unit` to grams. Throws if the unit isn't a weight. */
export function toGrams(amount: number, unit: Unit): number {
  if (!WEIGHT_UNITS.has(unit)) {
    throw new Error(`toGrams: ${unit} is not a weight unit`);
  }
  return amount * WEIGHT_TO_G[unit as keyof typeof WEIGHT_TO_G];
}

/** Universal conversion within a class (volume↔volume or weight↔weight). */
export function convertWithinClass(amount: number, from: Unit, to: Unit): number {
  const cFrom = unitClass(from);
  const cTo = unitClass(to);
  if (cFrom !== cTo) {
    throw new Error(`convertWithinClass: ${from} → ${to} crosses unit classes`);
  }
  if (cFrom === "volume") {
    const amtMl = toMl(amount, from);
    return amtMl / VOLUME_TO_ML[to as keyof typeof VOLUME_TO_ML];
  }
  if (cFrom === "weight") {
    const amtG = toGrams(amount, from);
    return amtG / WEIGHT_TO_G[to as keyof typeof WEIGHT_TO_G];
  }
  // count → count: only piece, identity
  if (from !== to) {
    throw new Error(`convertWithinClass: count units must match (${from} → ${to})`);
  }
  return amount;
}

/**
 * Convert any quantity to the ingredient's base unit, using density factors when crossing classes.
 *
 * - If `from` is already in the base unit's class, do a universal conversion.
 * - Otherwise look for a density factor matching `from` and use it.
 *
 * Returns null if no factor can be found (caller should prompt the user to add one).
 */
export function convertToBaseUnit(
  amount: number,
  from: Unit,
  baseUnit: BaseUnit,
  densityFactors: readonly DensityFactor[]
): number | null {
  const fromClass = unitClass(from);
  const baseClass: UnitClass = baseUnit === "g" ? "weight" : baseUnit === "ml" ? "volume" : "count";

  // Same class as base — universal conversion.
  if (fromClass === baseClass) {
    return convertWithinClass(amount, from, baseUnit as Unit);
  }

  // Cross-class: need a density factor.
  // Try direct match first.
  const direct = densityFactors.find((d) => d.from_unit === from);
  if (direct) {
    return amount * direct.base_unit_amount;
  }

  // Otherwise look for any factor whose class matches `from`'s class, and bridge through it.
  // Example: factor says 1 tbsp = 6g for base "g", and user supplied "tsp" (volume) of matcha.
  //   → convert "tsp" → "tbsp" via universal volume math, then apply the tbsp factor.
  const bridge = densityFactors.find((d) => unitClass(d.from_unit) === fromClass);
  if (bridge) {
    const inBridgeUnit = convertWithinClass(amount, from, bridge.from_unit);
    return inBridgeUnit * bridge.base_unit_amount;
  }

  return null;
}

export type ConversionMethod =
  | { kind: "passthrough" } // same unit
  | { kind: "universal_volume"; from_ml: number; to_ml: number }
  | { kind: "universal_weight"; from_g: number; to_g: number }
  | { kind: "density_direct"; factor: DensityFactor }
  | { kind: "density_bridge"; bridge_factor: DensityFactor; intermediate_unit: Unit };

export interface ConversionTrace {
  input_qty: number;
  input_unit: Unit;
  base_amount: number;
  base_unit: BaseUnit;
  method: ConversionMethod;
}

/**
 * Same as convertToBaseUnit but also returns metadata describing how the conversion happened —
 * useful for showing the user which factor was used in the breakdown view.
 */
export function convertToBaseUnitWithTrace(
  amount: number,
  from: Unit,
  baseUnit: BaseUnit,
  densityFactors: readonly DensityFactor[]
): ConversionTrace | null {
  const fromClass = unitClass(from);
  const baseClass: UnitClass = baseUnit === "g" ? "weight" : baseUnit === "ml" ? "volume" : "count";

  if (fromClass === baseClass) {
    if (from === baseUnit) {
      return { input_qty: amount, input_unit: from, base_amount: amount, base_unit: baseUnit, method: { kind: "passthrough" } };
    }
    if (fromClass === "volume") {
      const fromMl = VOLUME_TO_ML[from as keyof typeof VOLUME_TO_ML];
      const toMl = VOLUME_TO_ML[baseUnit as "ml"];
      return {
        input_qty: amount,
        input_unit: from,
        base_amount: convertWithinClass(amount, from, baseUnit as Unit),
        base_unit: baseUnit,
        method: { kind: "universal_volume", from_ml: fromMl, to_ml: toMl },
      };
    }
    if (fromClass === "weight") {
      const fromG = WEIGHT_TO_G[from as keyof typeof WEIGHT_TO_G];
      const toG = WEIGHT_TO_G[baseUnit as "g"];
      return {
        input_qty: amount,
        input_unit: from,
        base_amount: convertWithinClass(amount, from, baseUnit as Unit),
        base_unit: baseUnit,
        method: { kind: "universal_weight", from_g: fromG, to_g: toG },
      };
    }
  }

  // cross-class
  const direct = densityFactors.find((d) => d.from_unit === from);
  if (direct) {
    return {
      input_qty: amount,
      input_unit: from,
      base_amount: amount * direct.base_unit_amount,
      base_unit: baseUnit,
      method: { kind: "density_direct", factor: direct },
    };
  }
  const bridge = densityFactors.find((d) => unitClass(d.from_unit) === fromClass);
  if (bridge) {
    const inBridge = convertWithinClass(amount, from, bridge.from_unit);
    return {
      input_qty: amount,
      input_unit: from,
      base_amount: inBridge * bridge.base_unit_amount,
      base_unit: baseUnit,
      method: { kind: "density_bridge", bridge_factor: bridge, intermediate_unit: bridge.from_unit },
    };
  }
  return null;
}

/**
 * Inverse of convertToBaseUnit — useful for going "I want N of base unit, how much in `to`?".
 * Returns null if no factor available.
 */
export function convertFromBaseUnit(
  baseAmount: number,
  baseUnit: BaseUnit,
  to: Unit,
  densityFactors: readonly DensityFactor[]
): number | null {
  const toClass = unitClass(to);
  const baseClass: UnitClass = baseUnit === "g" ? "weight" : baseUnit === "ml" ? "volume" : "count";

  if (toClass === baseClass) {
    return convertWithinClass(baseAmount, baseUnit as Unit, to);
  }

  const direct = densityFactors.find((d) => d.from_unit === to);
  if (direct) {
    return baseAmount / direct.base_unit_amount;
  }

  const bridge = densityFactors.find((d) => unitClass(d.from_unit) === toClass);
  if (bridge) {
    const inBridge = baseAmount / bridge.base_unit_amount;
    return convertWithinClass(inBridge, bridge.from_unit, to);
  }

  return null;
}

/**
 * Check whether a `from` unit can be converted to `baseUnit` given the available density factors.
 * Used by the recipe input form to validate before saving.
 */
export function canConvert(
  from: Unit,
  baseUnit: BaseUnit,
  densityFactors: readonly DensityFactor[]
): boolean {
  const fromClass = unitClass(from);
  const baseClass: UnitClass = baseUnit === "g" ? "weight" : baseUnit === "ml" ? "volume" : "count";
  if (fromClass === baseClass) return true;
  return densityFactors.some((d) => unitClass(d.from_unit) === fromClass);
}

/** Friendly display label for a unit, e.g. "tbsp" for tbsp, "fl oz" for fl_oz. */
export function unitLabel(u: Unit): string {
  switch (u) {
    case "fl_oz":
      return "fl oz";
    case "piece":
      return "pc";
    case "tsp":
      return "tsp";
    case "tbsp":
      return "tbsp";
    default:
      return u;
  }
}

/** Cluster of units commonly relevant for a given base unit, useful for the unit dropdown. */
export function relevantUnits(baseUnit: BaseUnit): Unit[] {
  if (baseUnit === "ml") {
    return ["ml", "l", "tsp", "tbsp", "fl_oz", "cup", "pint", "quart", "gallon", "g", "kg", "oz", "lb"];
  }
  if (baseUnit === "g") {
    return ["g", "kg", "oz", "lb", "tsp", "tbsp", "cup", "ml"];
  }
  return ["piece"];
}
