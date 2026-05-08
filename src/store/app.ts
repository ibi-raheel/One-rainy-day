import { create } from "zustand";
import { api } from "@/db/api";
import type { Ingredient, Recipe, AppSettings } from "@/db/types";
import { computeRecipeCost, type RecipeCostResult } from "@/lib/cost";
import { nanoid } from "nanoid";

interface AppState {
  ingredients: Ingredient[];
  recipes: Recipe[];
  settings: AppSettings | null;
  loaded: boolean;
  loadError: string | null;

  // Indexes (computed)
  ingredientsById: Map<string, Ingredient>;
  recipesById: Map<string, Recipe>;
  ingredientUsageCount: Map<string, number>;
  recipeUsageCount: Map<string, number>;

  load: () => Promise<void>;

  upsertIngredient: (ing: Omit<Ingredient, "created_at" | "updated_at"> & { created_at?: string }) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;

  upsertRecipe: (r: Omit<Recipe, "created_at" | "updated_at"> & { created_at?: string }) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;

  costFor: (recipeId: string) => RecipeCostResult | null;

  setPeriodLabel: (label: string) => Promise<void>;

  /** Replace the entire backing store (used by Import). */
  replaceAll: (state: { ingredients: Ingredient[]; recipes: Recipe[]; settings: AppSettings }) => Promise<void>;
}

const recompute = (set: any, get: any) => {
  const { ingredients, recipes } = get();
  const ingredientsById = new Map(ingredients.map((i: Ingredient) => [i.id, i]));
  const recipesById = new Map(recipes.map((r: Recipe) => [r.id, r]));
  const ingredientUsageCount = new Map<string, number>();
  const recipeUsageCount = new Map<string, number>();
  for (const r of recipes as Recipe[]) {
    for (const inp of r.inputs) {
      if (inp.type === "ingredient") {
        ingredientUsageCount.set(inp.ref_id, (ingredientUsageCount.get(inp.ref_id) ?? 0) + 1);
      } else {
        recipeUsageCount.set(inp.ref_id, (recipeUsageCount.get(inp.ref_id) ?? 0) + 1);
      }
    }
  }
  set({ ingredientsById, recipesById, ingredientUsageCount, recipeUsageCount });
};

const normalize = (i: any): Ingredient => ({
  ...i,
  density_factors: i.density_factors ?? [],
  waste_factor: i.waste_factor ?? 1,
  delivery_cost: i.delivery_cost ?? 0,
  allergens: i.allergens ?? [],
  dietary_flags: i.dietary_flags ?? [],
});

const normalizeRecipe = (r: any): Recipe => ({
  ...r,
  density_factors: r.density_factors ?? [],
});

export const useApp = create<AppState>((set, get) => ({
  ingredients: [],
  recipes: [],
  settings: null,
  loaded: false,
  loadError: null,
  ingredientsById: new Map(),
  recipesById: new Map(),
  ingredientUsageCount: new Map(),
  recipeUsageCount: new Map(),

  async load() {
    try {
      const state = await api.loadState();
      const ingredients = (state.ingredients ?? []).map(normalize);
      const recipes = (state.recipes ?? []).map(normalizeRecipe);
      set({
        ingredients,
        recipes,
        settings: state.settings ?? { id: "singleton", period_label: "per day" },
        loaded: true,
        loadError: null,
      });
      recompute(set, get);
    } catch (err) {
      set({
        loaded: true,
        loadError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async upsertIngredient(ing) {
    const now = new Date().toISOString();
    const next: Ingredient = normalize({
      ...ing,
      id: ing.id || nanoid(),
      created_at: ing.created_at || now,
      updated_at: now,
    } as Ingredient);

    // optimistic update
    const prev = get().ingredients;
    const idx = prev.findIndex((i) => i.id === next.id);
    const optimistic = idx >= 0
      ? [...prev.slice(0, idx), next, ...prev.slice(idx + 1)]
      : [...prev, next];
    set({ ingredients: optimistic });
    recompute(set, get);

    try {
      await api.putIngredient(next);
    } catch (err) {
      // rollback
      set({ ingredients: prev, loadError: err instanceof Error ? err.message : String(err) });
      recompute(set, get);
      throw err;
    }
  },

  async deleteIngredient(id) {
    const prev = get().ingredients;
    set({ ingredients: prev.filter((i) => i.id !== id) });
    recompute(set, get);
    try {
      await api.deleteIngredient(id);
    } catch (err) {
      set({ ingredients: prev, loadError: err instanceof Error ? err.message : String(err) });
      recompute(set, get);
      throw err;
    }
  },

  async upsertRecipe(r) {
    const now = new Date().toISOString();
    const next: Recipe = normalizeRecipe({
      ...r,
      id: r.id || nanoid(),
      created_at: r.created_at || now,
      updated_at: now,
    } as Recipe);

    const prev = get().recipes;
    const idx = prev.findIndex((x) => x.id === next.id);
    const optimistic = idx >= 0
      ? [...prev.slice(0, idx), next, ...prev.slice(idx + 1)]
      : [...prev, next];
    set({ recipes: optimistic });
    recompute(set, get);

    try {
      await api.putRecipe(next);
    } catch (err) {
      set({ recipes: prev, loadError: err instanceof Error ? err.message : String(err) });
      recompute(set, get);
      throw err;
    }
  },

  async deleteRecipe(id) {
    const prev = get().recipes;
    set({ recipes: prev.filter((r) => r.id !== id) });
    recompute(set, get);
    try {
      await api.deleteRecipe(id);
    } catch (err) {
      set({ recipes: prev, loadError: err instanceof Error ? err.message : String(err) });
      recompute(set, get);
      throw err;
    }
  },

  costFor(recipeId) {
    const { recipes, ingredientsById, recipesById } = get();
    const r = recipes.find((x) => x.id === recipeId);
    if (!r) return null;
    return computeRecipeCost(r, ingredientsById, recipesById);
  },

  async setPeriodLabel(label) {
    const next: AppSettings = { id: "singleton", period_label: label };
    set({ settings: next });
    try {
      await api.putSettings(next);
    } catch (err) {
      set({ loadError: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  async replaceAll(state) {
    const ingredients = (state.ingredients ?? []).map(normalize);
    const recipes = (state.recipes ?? []).map(normalizeRecipe);
    const settings = state.settings ?? { id: "singleton", period_label: "per day" };
    await api.replaceState({ ingredients, recipes, settings });
    set({ ingredients, recipes, settings });
    recompute(set, get);
  },
}));
