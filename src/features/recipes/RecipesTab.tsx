import React, { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, Search, ChefHat, CupSoda, BookOpen } from "lucide-react";
import { TabHero } from "@/components/ui/TabHero";
import type { Recipe } from "@/db/types";
import { cn } from "@/lib/cn";
import { RecipeEditor } from "./RecipeEditor";
import { computeRecipeCost, formatMoney } from "@/lib/cost";

export function RecipesTab() {
  const recipes = useApp((s) => s.recipes);
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);
  const upsert = useApp((s) => s.upsertRecipe);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const subRecipes = useMemo(() => {
    return recipes
      .filter((r) => r.type === "sub_recipe")
      .filter((r) => !query.trim() || r.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, query]);

  const menuItems = useMemo(() => {
    return recipes
      .filter((r) => r.type === "menu_item")
      .filter((r) => !query.trim() || r.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, query]);

  const selected = recipes.find((r) => r.id === selectedId) || null;

  const createRecipe = async (type: Recipe["type"]) => {
    const id = nanoid();
    const recipe: Recipe = {
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
    await upsert(recipe as any);
    setSelectedId(id);
  };

  if (recipes.length === 0) {
    return (
      <>
        <TabHero
          title="Recipes"
          subtitle="The menu and the prep behind it. Costs update live."
          accent="accent"
          icon={<BookOpen className="h-7 w-7" strokeWidth={1.4} />}
        />
        <EmptyState
          title="No recipes yet"
          description="Build a sub-recipe (like a sauce or syrup) or a menu item directly. Sub-recipes can be reused as ingredients in menu items."
          action={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => createRecipe("sub_recipe")}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                New sub-recipe
              </Button>
              <Button onClick={() => createRecipe("menu_item")}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                New menu item
              </Button>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
    <TabHero
      title="Recipes"
      subtitle="The menu and the prep behind it. Costs update live."
      accent="accent"
      icon={<BookOpen className="h-7 w-7" strokeWidth={1.4} />}
      stats={[
        { label: "menu", value: menuItems.length, accent: "accent" },
        { label: "prep", value: subRecipes.length, accent: "info" },
      ]}
    />
    <div className="grid grid-cols-[280px_1fr] gap-7 min-h-[600px]">
      {/* Sidebar */}
      <div className="card overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none"
              strokeWidth={1.5}
            />
            <Input
              placeholder="Search recipes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="!py-2 !pl-8 !pr-2 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Section
            label="Menu items"
            count={menuItems.length}
            onAdd={() => createRecipe("menu_item")}
            icon={<CupSoda className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />}
            railClass="bg-accent"
          >
            {menuItems.map((r) => (
              <SidebarItem
                key={r.id}
                recipe={r}
                selected={r.id === selectedId}
                onSelect={() => setSelectedId(r.id)}
                ingredientsById={ingredientsById}
                recipesById={recipesById}
              />
            ))}
          </Section>
          <Section
            label="Sub-recipes"
            count={subRecipes.length}
            onAdd={() => createRecipe("sub_recipe")}
            icon={<ChefHat className="h-3.5 w-3.5 text-info" strokeWidth={1.5} />}
            railClass="bg-info"
          >
            {subRecipes.map((r) => (
              <SidebarItem
                key={r.id}
                recipe={r}
                selected={r.id === selectedId}
                onSelect={() => setSelectedId(r.id)}
                ingredientsById={ingredientsById}
                recipesById={recipesById}
              />
            ))}
          </Section>
        </div>
      </div>

      {/* Editor */}
      <div className="card p-7">
        {selected ? (
          <RecipeEditor recipe={selected} key={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-text-muted">
            Select a recipe on the left, or create a new one.
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function Section({
  label,
  count,
  onAdd,
  icon,
  railClass,
  children,
}: {
  label: string;
  count: number;
  onAdd: () => void;
  icon: React.ReactNode;
  railClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="label-cap">{label}</span>
          <span className="text-xs text-text-muted nums">{count}</span>
        </div>
        <button onClick={onAdd} className="btn-text p-1" title={`New ${label.toLowerCase()}`}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {count === 0 ? (
        <div className="px-2 pb-2 text-xs text-text-muted italic">none yet</div>
      ) : (
        <div className="space-y-0.5">{children}</div>
      )}
    </div>
  );
}

function SidebarItem({
  recipe,
  selected,
  onSelect,
  ingredientsById,
  recipesById,
}: {
  recipe: Recipe;
  selected: boolean;
  onSelect: () => void;
  ingredientsById: Map<string, any>;
  recipesById: Map<string, any>;
}) {
  const cost = useMemo(() => computeRecipeCost(recipe, ingredientsById, recipesById), [recipe, ingredientsById, recipesById]);
  const margin =
    recipe.type === "menu_item" && recipe.sale_price && cost.total_cost > 0
      ? (recipe.sale_price - cost.total_cost) / recipe.sale_price
      : null;
  const isMenu = recipe.type === "menu_item";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group w-full text-left pl-3.5 pr-3 py-2 rounded transition-all duration-150 ease-out-soft flex items-start gap-2.5",
        selected
          ? isMenu
            ? "bg-accent-soft ring-1 ring-accent/30"
            : "bg-info/10 ring-1 ring-info/30"
          : "hover:bg-bg-surfaceAlt"
      )}
    >
      <span
        className={cn(
          "shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center transition-colors",
          isMenu ? "bg-accent/15 text-accent" : "bg-info/15 text-info"
        )}
      >
        {isMenu ? (
          <CupSoda className="h-3.5 w-3.5" strokeWidth={1.6} />
        ) : (
          <ChefHat className="h-3.5 w-3.5" strokeWidth={1.6} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary truncate">{recipe.name}</div>
        <div className="text-xs text-text-muted nums mt-0.5 flex items-center gap-2">
          <span>{formatMoney(cost.total_cost)}</span>
          {recipe.sale_price ? (
            <>
              <span>·</span>
              <span>{formatMoney(recipe.sale_price)}</span>
            </>
          ) : null}
          {margin != null && (
            <span
              className={cn(
                "ml-auto rounded-full px-1.5 text-[10px] hero-num",
                margin < 0.6
                  ? "bg-error/15 text-error"
                  : margin < 0.75
                  ? "bg-warning/15 text-warning"
                  : "bg-success/15 text-success"
              )}
            >
              {(margin * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
