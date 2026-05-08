import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { useApp } from "@/store/app";
import { computeRecipeCost } from "@/lib/cost";
import { unitLabel } from "@/lib/units";
import { I } from "@/components/design/Icons";
import { Rainfield } from "@/components/design/Rain";
import { RecipeEditor } from "./RecipeEditor";
import type { Recipe } from "@/db/types";

type Filter = "all" | "menu" | "sub";

export function RecipesTab() {
  const recipes = useApp((s) => s.recipes);
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);
  const upsert = useApp((s) => s.upsertRecipe);

  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = {
    all: recipes.length,
    menu: recipes.filter((r) => r.type === "menu_item").length,
    sub: recipes.filter((r) => r.type === "sub_recipe").length,
  };

  const list = useMemo(() => {
    const filtered = recipes.filter((r) =>
      filter === "all"
        ? true
        : filter === "menu"
        ? r.type === "menu_item"
        : r.type === "sub_recipe"
    );
    // Compute cost + margin for sort-by-margin
    const enriched = filtered.map((r) => {
      const cost = computeRecipeCost(r, ingredientsById, recipesById);
      const margin =
        r.type === "menu_item" && r.sale_price && cost.total_cost > 0
          ? (r.sale_price - cost.total_cost) / r.sale_price
          : null;
      return { recipe: r, cost: cost.total_cost, margin };
    });
    enriched.sort((a, b) => (b.margin ?? -2) - (a.margin ?? -2));
    return enriched;
  }, [recipes, filter, ingredientsById, recipesById]);

  const createRecipe = async (type: Recipe["type"]) => {
    const id = nanoid();
    const rec: Recipe = {
      id,
      name: type === "menu_item" ? "New menu item" : "New sub-recipe",
      type,
      inputs: [],
      yield_quantity: 1,
      yield_unit: type === "menu_item" ? "piece" : "ml",
      density_factors: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await upsert(rec as any);
    setOpenId(id);
  };

  // Editor mode — keep the existing editor functionality intact but show
  // it on top of the cards page so all the rich tooling (breakdown, scale,
  // density factors, etc.) keeps working.
  const openRecipe = recipes.find((r) => r.id === openId) || null;

  if (openRecipe) {
    return (
      <div className="view">
        <div className="page-head fade-up">
          <Rainfield count={14} />
          <div className="head-row">
            <div style={{ flex: 1 }}>
              <h1>{openRecipe.name}</h1>
              <p className="subtle">
                {openRecipe.type === "menu_item" ? "Menu item" : "Sub-recipe"} · {openRecipe.inputs.length} inputs ·
                yields {openRecipe.yield_quantity} {unitLabel(openRecipe.yield_unit)}
              </p>
            </div>
            <div className="head-stats">
              <button className="btn" onClick={() => setOpenId(null)}>
                ← All recipes
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <RecipeEditor recipe={openRecipe} />
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="page-head fade-up">
        <Rainfield count={14} />
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>Recipes</h1>
            <p className="subtle">
              Menu items and sub-recipes. Costs roll up automatically. Click any recipe to scale or break down.
            </p>
          </div>
          <div className="head-stats">
            <button className="btn"><I.Filter /> Filter</button>
            <button className="btn primary" onClick={() => createRecipe("menu_item")}>
              <I.Plus /> New recipe
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div className="segmented">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All ({counts.all})</button>
          <button className={filter === "menu" ? "on" : ""} onClick={() => setFilter("menu")}>Menu items ({counts.menu})</button>
          <button className={filter === "sub" ? "on" : ""} onClick={() => setFilter("sub")}>Sub-recipes ({counts.sub})</button>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginLeft: "auto" }}>Sorted by margin</div>
      </div>

      {list.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ marginTop: 0 }}>No recipes yet — start with a menu item or a sub-recipe.</p>
          <div style={{ display: "inline-flex", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => createRecipe("sub_recipe")}><I.Plus /> Sub-recipe</button>
            <button className="btn primary" onClick={() => createRecipe("menu_item")}><I.Plus /> Menu item</button>
          </div>
        </div>
      ) : (
        <div className="rcards stagger">
          {list.map(({ recipe: r, cost, margin }) => {
            const isSub = r.type === "sub_recipe";
            const tone = margin == null ? "cool" : margin < 0.6 ? "red" : margin < 0.7 ? "amber" : "green";
            return (
              <div key={r.id} className="rcard" onClick={() => setOpenId(r.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span className={`tag ${isSub ? "sub" : ""}`}>
                    {isSub ? "Sub-recipe" : "Menu item"}
                  </span>
                </div>
                <h4>{r.name}</h4>
                <div className="meta">
                  Yields {r.yield_quantity} {unitLabel(r.yield_unit)} · {r.inputs.length} inputs
                </div>
                <div className="row">
                  <div>
                    <div className="label-cap" style={{ fontSize: 9.5 }}>Cost</div>
                    <div className="cost">${cost.toFixed(2)}</div>
                  </div>
                  {margin != null ? (
                    <div style={{ textAlign: "right" }}>
                      <div className="label-cap" style={{ fontSize: 9.5 }}>Margin</div>
                      <span className={`pill ${tone}`}>{(margin * 100).toFixed(0)}%</span>
                    </div>
                  ) : r.sale_price ? (
                    <div style={{ textAlign: "right" }}>
                      <div className="label-cap" style={{ fontSize: 9.5 }}>Price</div>
                      <span className="cost" style={{ fontSize: 18 }}>${r.sale_price.toFixed(2)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
