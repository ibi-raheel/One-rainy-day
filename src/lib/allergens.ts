/**
 * Allergen detection + aggregation.
 *
 * - Heuristic name-matching pre-fills allergens when an ingredient is added.
 * - Recipe-level aggregation walks transitively through sub-recipes so
 *   "Matcha Latte" inherits "dairy" via Mixed Milk → Whole Milk.
 */

import type { Allergen, DietaryFlag, Ingredient, Recipe } from "@/db/types";

interface Rule {
  allergens?: Allergen[];
  dietary_flags?: DietaryFlag[];
  /** lower-cased substrings — match ANY */
  match: string[];
}

const RULES: Rule[] = [
  // Dairy
  { allergens: ["dairy"], match: ["milk", "cream", "butter", "ghee", "cheese", "yogurt", "ricotta", "mascarpone", "feta", "parmesan", "cheddar", "mozzarella", "pecorino", "biscoff cookie butter"] },
  // Eggs
  { allergens: ["eggs"], match: ["egg"] },
  // Gluten
  { allergens: ["gluten"], match: ["all-purpose flour", "ap flour", "bread flour", "cake flour", "pastry flour", "whole wheat", "white whole wheat flour", "semolina", "rye flour", "wheat flour", "couscous", "bulgur", "barley", "farro", "soy sauce", "penne", "fettuccine", "spaghetti", "fusilli", "orzo", "panko", "breadcrumbs", "pita", "crouton", "bagel", "croissant", "danish", "bistro", "hoagie", "sandwich bread", "taiyaki mix", "biscoff"] },
  // Tree nuts
  { allergens: ["tree nuts"], match: ["almond", "walnut", "pecan", "cashew", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut"] },
  // Peanuts
  { allergens: ["peanuts"], match: ["peanut"] },
  // Soy
  { allergens: ["soy"], match: ["soy", "tamari", "soya"] },
  // Sesame
  { allergens: ["sesame"], match: ["sesame", "tahini"] },
  // Fish / shellfish
  { allergens: ["fish"], match: ["fish sauce", "tuna", "salmon", "cod", "anchovy"] },
  { allergens: ["shellfish"], match: ["shrimp", "prawn", "lobster", "crab", "oyster", "scallop", "clam", "mussel"] },

  // Dietary positive flags (all by name match — heuristic only)
  { dietary_flags: ["gluten-free"], match: ["cassava", "rice flour", "corn flour", "almond flour", "coconut flour", "oat flour", "masa harina", "cornmeal", "cornstarch", "almond milk", "oat milk", "soy milk", "rice milk", "coconut milk", "cashew milk", "tamari"] },
];

/** Returns the allergens & dietary_flags suggested by an ingredient's name. */
export function detectAllergens(name: string): { allergens: Allergen[]; dietary_flags: DietaryFlag[] } {
  const n = name.toLowerCase();
  const allergens = new Set<Allergen>();
  const dietary_flags = new Set<DietaryFlag>();
  for (const rule of RULES) {
    if (rule.match.some((m) => n.includes(m))) {
      rule.allergens?.forEach((a) => allergens.add(a));
      rule.dietary_flags?.forEach((d) => dietary_flags.add(d));
    }
  }
  return { allergens: Array.from(allergens), dietary_flags: Array.from(dietary_flags) };
}

/** Aggregate allergens from a recipe's inputs, walking transitively. */
export interface RecipeAllergenSummary {
  allergens: Allergen[];
  /** Per allergen, which ingredient names contributed it (for the tooltip). */
  sources: Record<Allergen, string[]>;
}

export function aggregateRecipeAllergens(
  recipe: Recipe,
  ingredientsById: Map<string, Ingredient>,
  recipesById: Map<string, Recipe>,
  visited: Set<string> = new Set()
): RecipeAllergenSummary {
  const sources: Record<string, Set<string>> = {};

  const add = (allergen: Allergen, source: string) => {
    if (!sources[allergen]) sources[allergen] = new Set();
    sources[allergen].add(source);
  };

  if (visited.has(recipe.id)) return { allergens: [], sources: {} as Record<Allergen, string[]> };
  const next = new Set(visited);
  next.add(recipe.id);

  for (const inp of recipe.inputs) {
    if (inp.type === "ingredient") {
      const ing = ingredientsById.get(inp.ref_id);
      if (!ing) continue;
      for (const a of ing.allergens ?? []) add(a, ing.name);
    } else {
      const sub = recipesById.get(inp.ref_id);
      if (!sub) continue;
      const subSummary = aggregateRecipeAllergens(sub, ingredientsById, recipesById, next);
      for (const a of subSummary.allergens) {
        for (const s of subSummary.sources[a] ?? []) {
          add(a, `${s} (via ${sub.name})`);
        }
      }
    }
  }

  const out: Record<string, string[]> = {};
  for (const [a, names] of Object.entries(sources)) {
    out[a] = Array.from(names);
  }
  return { allergens: Object.keys(out) as Allergen[], sources: out as Record<Allergen, string[]> };
}
