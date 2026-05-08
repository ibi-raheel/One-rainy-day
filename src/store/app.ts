import { create } from "zustand";
import { api } from "@/db/api";
import type { Ingredient, Recipe, AppSettings, Supplier, StockItem } from "@/db/types";
import { computeRecipeCost, type RecipeCostResult } from "@/lib/cost";
import { nanoid } from "nanoid";

interface AppState {
  ingredients: Ingredient[];
  recipes: Recipe[];
  suppliers: Supplier[];
  stockItems: StockItem[];
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

  upsertSupplier: (s: Omit<Supplier, "created_at" | "updated_at"> & { created_at?: string }) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  upsertStockItem: (s: Omit<StockItem, "created_at" | "updated_at"> & { created_at?: string }) => Promise<void>;
  deleteStockItem: (id: string) => Promise<void>;

  costFor: (recipeId: string) => RecipeCostResult | null;

  setPeriodLabel: (label: string) => Promise<void>;

  hideVendor: (name: string) => Promise<void>;
  unhideVendor: (name: string) => Promise<void>;

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
  on_hand_qty: i.on_hand_qty ?? 0,
  reorder_point: i.reorder_point ?? 0,
  last_restocked_at: i.last_restocked_at,
});

const normalizeRecipe = (r: any): Recipe => ({
  ...r,
  density_factors: r.density_factors ?? [],
});

export const useApp = create<AppState>((set, get) => ({
  ingredients: [],
  recipes: [],
  suppliers: [],
  stockItems: [],
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
      const suppliers = (state.suppliers ?? []) as Supplier[];
      const stockItems = (state.stockItems ?? []) as StockItem[];
      set({
        ingredients,
        recipes,
        suppliers,
        stockItems,
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

  async upsertSupplier(s) {
    const now = new Date().toISOString();
    const next: Supplier = {
      ...s,
      id: s.id || nanoid(),
      created_at: s.created_at || now,
      updated_at: now,
    } as Supplier;
    const prev = get().suppliers;
    const idx = prev.findIndex((x) => x.id === next.id);
    const optimistic = idx >= 0
      ? [...prev.slice(0, idx), next, ...prev.slice(idx + 1)]
      : [...prev, next];
    set({ suppliers: optimistic });
    try {
      await api.putSupplier(next);
    } catch (err) {
      set({ suppliers: prev, loadError: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  async deleteSupplier(id) {
    const prev = get().suppliers;
    set({ suppliers: prev.filter((s) => s.id !== id) });
    try {
      await api.deleteSupplier(id);
    } catch (err) {
      set({ suppliers: prev, loadError: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  async upsertStockItem(s) {
    const now = new Date().toISOString();
    const next: StockItem = {
      ...s,
      id: s.id || nanoid(),
      created_at: s.created_at || now,
      updated_at: now,
    } as StockItem;
    const prev = get().stockItems;
    const idx = prev.findIndex((x) => x.id === next.id);
    const optimistic = idx >= 0
      ? [...prev.slice(0, idx), next, ...prev.slice(idx + 1)]
      : [...prev, next];
    set({ stockItems: optimistic });
    try {
      await api.putStockItem(next);
    } catch (err) {
      set({ stockItems: prev, loadError: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  async deleteStockItem(id) {
    const prev = get().stockItems;
    set({ stockItems: prev.filter((s) => s.id !== id) });
    try {
      await api.deleteStockItem(id);
    } catch (err) {
      set({ stockItems: prev, loadError: err instanceof Error ? err.message : String(err) });
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
    const cur = get().settings ?? { id: "singleton", period_label: "per day" };
    const next: AppSettings = { ...cur, id: "singleton", period_label: label };
    const prev = get().settings;
    set({ settings: next });
    try {
      await api.putSettings(next);
    } catch (err) {
      set({ settings: prev, loadError: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  async hideVendor(name) {
    const cur = get().settings ?? { id: "singleton", period_label: "per day" };
    const hidden = new Set(cur.hiddenVendors ?? []);
    if (hidden.has(name)) return;
    hidden.add(name);
    const next: AppSettings = { ...cur, hiddenVendors: Array.from(hidden) };
    const prev = get().settings;
    set({ settings: next });
    try {
      await api.putSettings(next);
    } catch (err) {
      set({ settings: prev, loadError: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  async unhideVendor(name) {
    const cur = get().settings ?? { id: "singleton", period_label: "per day" };
    const hidden = (cur.hiddenVendors ?? []).filter((v) => v !== name);
    const next: AppSettings = { ...cur, hiddenVendors: hidden };
    const prev = get().settings;
    set({ settings: next });
    try {
      await api.putSettings(next);
    } catch (err) {
      set({ settings: prev, loadError: err instanceof Error ? err.message : String(err) });
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
