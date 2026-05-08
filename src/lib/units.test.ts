import { describe, it, expect } from "vitest";
import {
  convertWithinClass,
  convertToBaseUnit,
  convertFromBaseUnit,
  canConvert,
  toGrams,
  toMl,
  unitClass,
  baseUnitFor,
  type DensityFactor,
} from "./units";

const closeTo = (n: number, target: number, tolerance = 0.01) =>
  Math.abs(n - target) < tolerance;

describe("unitClass / baseUnitFor", () => {
  it("classes correctly", () => {
    expect(unitClass("cup")).toBe("volume");
    expect(unitClass("tbsp")).toBe("volume");
    expect(unitClass("ml")).toBe("volume");
    expect(unitClass("gallon")).toBe("volume");
    expect(unitClass("g")).toBe("weight");
    expect(unitClass("oz")).toBe("weight");
    expect(unitClass("lb")).toBe("weight");
    expect(unitClass("piece")).toBe("count");
  });

  it("picks correct base unit", () => {
    expect(baseUnitFor("cup")).toBe("ml");
    expect(baseUnitFor("oz")).toBe("g");
    expect(baseUnitFor("gallon")).toBe("ml");
    expect(baseUnitFor("piece")).toBe("piece");
  });
});

describe("universal weight conversions", () => {
  it("g ↔ kg", () => {
    expect(toGrams(1, "kg")).toBe(1000);
    expect(convertWithinClass(2500, "g", "kg")).toBe(2.5);
  });

  it("oz → g", () => {
    expect(closeTo(toGrams(1, "oz"), 28.3495)).toBe(true);
  });

  it("lb → g", () => {
    expect(closeTo(toGrams(1, "lb"), 453.592)).toBe(true);
  });

  it("lb → oz", () => {
    expect(closeTo(convertWithinClass(1, "lb", "oz"), 16, 0.001)).toBe(true);
  });

  it("kg → lb roundtrip", () => {
    const lbs = convertWithinClass(1, "kg", "lb");
    const kg = convertWithinClass(lbs, "lb", "kg");
    expect(closeTo(kg, 1, 0.0001)).toBe(true);
  });
});

describe("universal volume conversions", () => {
  it("tsp → tbsp = 1/3", () => {
    expect(closeTo(convertWithinClass(3, "tsp", "tbsp"), 1, 0.001)).toBe(true);
  });

  it("tbsp → cup ≈ 1/16", () => {
    expect(closeTo(convertWithinClass(16, "tbsp", "cup"), 1, 0.01)).toBe(true);
  });

  it("cup → ml ≈ 236.588", () => {
    expect(closeTo(toMl(1, "cup"), 236.588)).toBe(true);
  });

  it("gallon → cup = 16", () => {
    expect(closeTo(convertWithinClass(1, "gallon", "cup"), 16, 0.01)).toBe(true);
  });

  it("gallon → fl_oz = 128", () => {
    expect(closeTo(convertWithinClass(1, "gallon", "fl_oz"), 128, 0.01)).toBe(true);
  });

  it("fl_oz → tbsp = 2", () => {
    expect(closeTo(convertWithinClass(1, "fl_oz", "tbsp"), 2, 0.001)).toBe(true);
  });

  it("quart → pint = 2", () => {
    expect(closeTo(convertWithinClass(1, "quart", "pint"), 2, 0.001)).toBe(true);
  });

  it("ml → l", () => {
    expect(convertWithinClass(2500, "ml", "l")).toBe(2.5);
  });

  it("l → cup roundtrip", () => {
    const cups = convertWithinClass(1, "l", "cup");
    const back = convertWithinClass(cups, "cup", "l");
    expect(closeTo(back, 1, 0.0001)).toBe(true);
  });
});

describe("cross-class conversion is rejected without a density factor", () => {
  it("tbsp → g throws via convertWithinClass", () => {
    expect(() => convertWithinClass(1, "tbsp", "g")).toThrow();
  });

  it("oz weight → ml throws via convertWithinClass", () => {
    expect(() => convertWithinClass(1, "oz", "ml")).toThrow();
  });
});

describe("convertToBaseUnit — same-class", () => {
  it("cup → ml for liquid ingredient", () => {
    const result = convertToBaseUnit(2, "cup", "ml", []);
    expect(result).not.toBeNull();
    expect(closeTo(result!, 473.176, 0.5)).toBe(true);
  });

  it("oz → g for solid ingredient", () => {
    const result = convertToBaseUnit(56, "oz", "g", []);
    expect(closeTo(result!, 1587.57, 0.5)).toBe(true);
  });

  it("lb → g", () => {
    const result = convertToBaseUnit(10, "lb", "g", []);
    expect(closeTo(result!, 4535.92, 0.5)).toBe(true);
  });

  it("piece → piece passes through", () => {
    expect(convertToBaseUnit(3, "piece", "piece", [])).toBe(3);
  });
});

describe("convertToBaseUnit — density-aware", () => {
  // Matcha: base "g", 1 tbsp = 6g
  const matchaDF: DensityFactor[] = [{ from_unit: "tbsp", base_unit_amount: 6, source: "library" }];

  it("uses direct factor when available (tbsp matcha → g)", () => {
    expect(convertToBaseUnit(2, "tbsp", "g", matchaDF)).toBe(12);
  });

  it("bridges through density factor (tsp matcha → g via tbsp factor)", () => {
    // 3 tsp = 1 tbsp = 6g
    const result = convertToBaseUnit(3, "tsp", "g", matchaDF);
    expect(closeTo(result!, 6, 0.001)).toBe(true);
  });

  it("returns null when no factor and crossing classes", () => {
    expect(convertToBaseUnit(1, "tbsp", "g", [])).toBeNull();
    expect(convertToBaseUnit(1, "g", "ml", [])).toBeNull();
  });

  // Egg: base "piece", 1 piece = 50g
  const eggDF: DensityFactor[] = [{ from_unit: "g", base_unit_amount: 1 / 50, source: "library" }];

  it("piece-based ingredient with weight factor (100g egg → 2 pieces)", () => {
    const result = convertToBaseUnit(100, "g", "piece", eggDF);
    expect(closeTo(result!, 2, 0.001)).toBe(true);
  });
});

describe("convertFromBaseUnit", () => {
  // Whole milk: base "ml" — universal volume conversion only
  it("ml → cup for milk-style liquid", () => {
    const result = convertFromBaseUnit(236.588, "ml", "cup", []);
    expect(closeTo(result!, 1, 0.001)).toBe(true);
  });

  it("ml → gallon for whole milk", () => {
    const oneGallonMl = 3785.41;
    const result = convertFromBaseUnit(oneGallonMl, "ml", "gallon", []);
    expect(closeTo(result!, 1, 0.001)).toBe(true);
  });

  // Sugar: base "g", 1 cup = 200g
  const sugarDF: DensityFactor[] = [{ from_unit: "cup", base_unit_amount: 200, source: "library" }];

  it("ingredient base g → cup uses density factor inverse", () => {
    const result = convertFromBaseUnit(400, "g", "cup", sugarDF);
    expect(closeTo(result!, 2, 0.001)).toBe(true);
  });
});

describe("canConvert", () => {
  it("same class always convertible", () => {
    expect(canConvert("cup", "ml", [])).toBe(true);
    expect(canConvert("oz", "g", [])).toBe(true);
  });

  it("cross-class needs factor", () => {
    expect(canConvert("tbsp", "g", [])).toBe(false);
    expect(canConvert("tbsp", "g", [{ from_unit: "tsp", base_unit_amount: 2, source: "library" }])).toBe(true);
  });

  it("piece with cross-class factor", () => {
    expect(canConvert("g", "piece", [])).toBe(false);
    expect(canConvert("g", "piece", [{ from_unit: "g", base_unit_amount: 0.02, source: "library" }])).toBe(true);
  });
});

describe("acceptance scenario — matcha latte chain", () => {
  // Verify the documented acceptance scenario produces sensible numbers.
  // Whole milk: $3.48 / gallon → cost per ml
  it("whole milk gallon → ml cost", () => {
    const gallonInMl = toMl(1, "gallon");
    expect(closeTo(gallonInMl, 3785.41, 1)).toBe(true);
    const costPerMl = 3.48 / gallonInMl;
    expect(closeTo(costPerMl, 0.000919, 0.0001)).toBe(true);

    // 1.5 cup of milk in ml then in cost
    const mlForLatte = toMl(1.5, "cup");
    expect(closeTo(mlForLatte, 354.882, 0.5)).toBe(true);
    const milkCost = mlForLatte * costPerMl;
    expect(closeTo(milkCost, 0.326, 0.01)).toBe(true);
  });

  it("matcha 100g $38 → tbsp cost using density 6g/tbsp", () => {
    const costPerG = 38 / 100; // $0.38/g
    const gPerTbsp = 6;
    const costPerTbsp = costPerG * gPerTbsp;
    // 2 tbsp matcha
    expect(closeTo(2 * costPerTbsp, 4.56, 0.001)).toBe(true);
  });

  it("sugar 10lb $6.58 → 1 cup ≈ 200g cost", () => {
    const totalG = toGrams(10, "lb");
    expect(closeTo(totalG, 4535.92, 0.5)).toBe(true);
    const costPerG = 6.58 / totalG;
    const oneCupCost = 200 * costPerG;
    expect(closeTo(oneCupCost, 0.290, 0.01)).toBe(true);
  });
});
