import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { useApp } from "@/store/app";
import { computeRecipeCost } from "@/lib/cost";
import { unitLabel } from "@/lib/units";
import { I } from "@/components/design/Icons";
import { Rainfield } from "@/components/design/Rain";
import { RecipeEditModal } from "./RecipeEditModal";
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

  const enriched = useMemo(() => {
    return recipes.map((r) => {
      const cost = computeRecipeCost(r, ingredientsById, recipesById);
      const margin =
        r.type === "menu_item" && r.sale_price && cost.total_cost > 0
          ? (r.sale_price - cost.total_cost) / r.sale_price
          : null;
      return { recipe: r, cost: cost.total_cost, margin };
    });
  }, [recipes, ingredientsById, recipesById]);

  const menuRows = useMemo(
    () =>
      enriched
        .filter((e) => e.recipe.type === "menu_item")
        .sort((a, b) => (b.margin ?? -2) - (a.margin ?? -2)),
    [enriched]
  );
  const subRows = useMemo(
    () =>
      enriched
        .filter((e) => e.recipe.type === "sub_recipe")
        .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name)),
    [enriched]
  );

  const showMenu = filter === "all" || filter === "menu";
  const showSub = filter === "all" || filter === "sub";

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

  const openRecipe = recipes.find((r) => r.id === openId) || null;

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
            <button className="btn" onClick={() => createRecipe("sub_recipe")}>
              <I.Plus /> Sub-recipe
            </button>
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

      {recipes.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ marginTop: 0 }}>No recipes yet — start with a menu item or a sub-recipe.</p>
          <div style={{ display: "inline-flex", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => createRecipe("sub_recipe")}><I.Plus /> Sub-recipe</button>
            <button className="btn primary" onClick={() => createRecipe("menu_item")}><I.Plus /> Menu item</button>
          </div>
        </div>
      ) : (
        <>
          {showMenu && (
            <RecipeSection
              kind="menu"
              count={menuRows.length}
              onAdd={() => createRecipe("menu_item")}
              rows={menuRows}
              onOpen={(id) => setOpenId(id)}
            />
          )}
          {showSub && (
            <div style={{ marginTop: showMenu ? 28 : 0 }}>
              <RecipeSection
                kind="sub"
                count={subRows.length}
                onAdd={() => createRecipe("sub_recipe")}
                rows={subRows}
                onOpen={(id) => setOpenId(id)}
              />
            </div>
          )}
        </>
      )}

      {openRecipe && (
        <RecipeEditModal
          recipe={openRecipe}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

interface SectionProps {
  kind: "menu" | "sub";
  count: number;
  onAdd: () => void;
  rows: { recipe: import("@/db/types").Recipe; cost: number; margin: number | null }[];
  onOpen: (id: string) => void;
}

function RecipeSection({ kind, count, onAdd, rows, onOpen }: SectionProps) {
  const isMenu = kind === "menu";
  const accentColor = isMenu ? "var(--accent)" : "var(--info)";
  const accentSoft = isMenu ? "var(--accent-soft)" : "var(--info-soft)";
  const title = isMenu ? "Menu items" : "Sub-recipes";
  const desc = isMenu
    ? "What customers buy. Tap to edit pricing, ingredients, procedure."
    : "Prep components reused across menu items — sauces, syrups, batters.";

  return (
    <section>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: `1px solid ${accentSoft}`,
      }}>
        <div style={{
          width: 6, height: 24, borderRadius: 3,
          background: accentColor,
        }}/>
        <h2 style={{
          margin: 0, fontFamily: "Fraunces, serif",
          fontSize: 20, color: "var(--ink)",
          letterSpacing: "-0.012em",
        }}>{title}</h2>
        <span style={{
          fontSize: 11, color: "var(--text-2)", fontWeight: 600,
          letterSpacing: ".08em", textTransform: "uppercase",
        }}>{count}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)", flex: 1 }}>
          {desc}
        </span>
        <button className="btn" onClick={onAdd}>
          <I.Plus /> New {isMenu ? "menu item" : "sub-recipe"}
        </button>
      </div>

      {count === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {isMenu
            ? "No menu items yet. Add one to start tracking margins."
            : "No sub-recipes yet. Use sub-recipes for syrups, sauces, fillings — anything reused."}
        </div>
      ) : (
        <div className="rcards stagger">
          {rows.map(({ recipe: r, cost, margin }) => {
            const tone = margin == null ? "cool" : margin < 0.6 ? "red" : margin < 0.7 ? "amber" : "green";
            return (
              <div
                key={r.id}
                className="rcard"
                onClick={() => onOpen(r.id)}
                style={{
                  borderLeft: `3px solid ${accentColor}`,
                  paddingLeft: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span
                    className="tag"
                    style={{
                      background: accentSoft,
                      color: isMenu ? "var(--accent-deep)" : "var(--info)",
                      borderColor: isMenu ? "rgba(168,111,61,.3)" : "rgba(45,87,94,.3)",
                    }}
                  >
                    {isMenu ? "Menu item" : "Sub-recipe"}
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
    </section>
  );
}
