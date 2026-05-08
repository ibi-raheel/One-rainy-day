import { useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app";
import type { Ingredient, Recipe } from "@/db/types";
import { cn } from "@/lib/cn";
import { ChefHat, Sprout } from "lucide-react";

interface Props {
  excludeRecipeId?: string;
  selected: { type: "ingredient" | "recipe"; ref_id: string } | null;
  onSelect: (sel: { type: "ingredient" | "recipe"; ref_id: string }) => void;
}

export function InputPicker({ excludeRecipeId, selected, onSelect }: Props) {
  const ingredients = useApp((s) => s.ingredients);
  const recipes = useApp((s) => s.recipes);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    const subRecipes = recipes
      .filter((r) => r.type === "sub_recipe" && r.id !== excludeRecipeId)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .slice(0, 8);
    const ings = ingredients
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .slice(0, 12);
    return { subRecipes, ings };
  }, [query, ingredients, recipes, excludeRecipeId]);

  const selectedLabel = useMemo(() => {
    if (!selected) return null;
    if (selected.type === "ingredient")
      return ingredients.find((i) => i.id === selected.ref_id)?.name;
    return recipes.find((r) => r.id === selected.ref_id)?.name;
  }, [selected, ingredients, recipes]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cn(
          "input-base text-left flex items-center justify-between w-full",
          !selectedLabel && "text-text-muted"
        )}
      >
        {selectedLabel ?? "Select ingredient or sub-recipe…"}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setOpen(false);
              setQuery("");
            }}
          />
          <div className="absolute z-40 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-bg-surface shadow-modal">
            <div className="p-2 border-b border-border sticky top-0 bg-bg-surface">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                className="input-base !py-1.5 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                }}
              />
            </div>
            {matches.subRecipes.length > 0 && (
              <>
                <div className="label-cap px-3 pt-2 pb-1">Sub-recipes</div>
                {matches.subRecipes.map((r) => (
                  <RowItem
                    key={r.id}
                    onClick={() => {
                      onSelect({ type: "recipe", ref_id: r.id });
                      setOpen(false);
                      setQuery("");
                    }}
                    icon={<ChefHat className="h-3.5 w-3.5 text-info" strokeWidth={1.5} />}
                    label={r.name}
                  />
                ))}
              </>
            )}
            {matches.ings.length > 0 && (
              <>
                <div className="label-cap px-3 pt-2 pb-1">Ingredients</div>
                {matches.ings.map((i) => (
                  <RowItem
                    key={i.id}
                    onClick={() => {
                      onSelect({ type: "ingredient", ref_id: i.id });
                      setOpen(false);
                      setQuery("");
                    }}
                    icon={<Sprout className="h-3.5 w-3.5 text-success" strokeWidth={1.5} />}
                    label={i.name}
                    sublabel={i.vendor}
                  />
                ))}
              </>
            )}
            {matches.subRecipes.length === 0 && matches.ings.length === 0 && (
              <div className="p-4 text-sm text-text-muted">
                {ingredients.length + recipes.length === 0
                  ? "No ingredients or sub-recipes yet."
                  : "No matches."}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RowItem({
  onClick,
  icon,
  label,
  sublabel,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent-soft transition-colors duration-100 ease-out-soft"
    >
      {icon}
      <span className="text-text-primary">{label}</span>
      {sublabel && <span className="text-text-muted text-xs ml-auto">{sublabel}</span>}
    </button>
  );
}
