import { useEffect, useRef, useState } from "react";
import { useApp } from "./store/app";
import { api } from "./db/api";
import { Tabs } from "./components/ui/Tabs";
import { TooltipProvider } from "./components/ui/Tooltip";
import { IngredientsTab } from "./features/ingredients/IngredientsTab";
import { RecipesTab } from "./features/recipes/RecipesTab";
import { DashboardTab } from "./features/dashboard/DashboardTab";
import { MarketTab } from "./features/market/MarketTab";

type TabKey = "ingredients" | "recipes" | "market" | "dashboard";

function UmbrellaMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="-mb-1 shrink-0"
    >
      {/* faint background coin */}
      <circle cx="32" cy="32" r="30" fill="#F4EAD3" />
      {/* canopy */}
      <path d="M10 33 C10 21 19 14.5 32 14.5 C45 14.5 54 21 54 33 Z" fill="#A86F3D" />
      <path
        d="M21 33 C21 25 26 19 32 19 C38 19 43 25 43 33"
        stroke="#FAF5EA"
        strokeWidth="1.4"
        opacity="0.55"
        fill="none"
      />
      <path d="M32 14.5 L32 33" stroke="#FAF5EA" strokeWidth="1" opacity="0.45" />
      {/* canopy ridge highlight */}
      <path d="M10 33 L54 33" stroke="#8C5A2E" strokeWidth="1" opacity="0.5" />
      {/* handle */}
      <path
        d="M32 33 L32 47 Q32 53 26 53"
        stroke="#A86F3D"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* raindrops in teal */}
      <ellipse cx="14" cy="48" rx="1.6" ry="2.4" fill="#2D575E" opacity="0.6" />
      <ellipse cx="49" cy="44" rx="1.8" ry="2.8" fill="#2D575E" opacity="0.78" />
      <ellipse cx="56" cy="52" rx="1.4" ry="2" fill="#2D575E" opacity="0.55" />
      <ellipse cx="20" cy="56" rx="1.2" ry="1.8" fill="#2D575E" opacity="0.45" />
    </svg>
  );
}


export default function App() {
  const load = useApp((s) => s.load);
  const loaded = useApp((s) => s.loaded);
  const [tab, setTab] = useState<TabKey>("ingredients");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    load();
    // Subscribe to server change events; debounce-refetch so a burst of
    // edits from a remote client only triggers one refetch.
    const unsubscribe = api.subscribeToChanges(() => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        load();
      }, 400);
    });
    return () => {
      unsubscribe();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [load]);

  return (
    <TooltipProvider>
      <div className="min-h-full">
        {/* Full-bleed palette bar — directly references the swatch palette */}
        <div className="h-1.5 w-full flex">
          <div className="bg-success" style={{ width: "26%" }} />
          <div className="bg-info" style={{ width: "14%" }} />
          <div className="bg-accent" style={{ width: "34%" }} />
          <div className="bg-warning" style={{ width: "14%" }} />
          <div className="bg-error" style={{ width: "12%" }} />
        </div>

        <div className="mx-auto max-w-[1200px] px-8 pt-10 pb-20">
          <header className="mb-10">
            <div className="flex items-end gap-5">
              <UmbrellaMark size={64} />
              <div className="flex-1">
                <h1 className="display text-[44px] font-medium tracking-tight text-text-primary leading-[1.02]">
                  One Rainy Day
                </h1>
                <p className="mt-2 text-sm text-text-secondary tracking-wide">
                  Cost & recipes
                </p>
              </div>
            </div>
          </header>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabKey)}
            tabs={[
              { value: "ingredients", label: "Ingredients" },
              { value: "recipes", label: "Recipes" },
              { value: "market", label: "Market" },
              { value: "dashboard", label: "Dashboard" },
            ]}
          />

          <div className="mt-7">
            {!loaded ? (
              <div className="text-text-muted">Loading…</div>
            ) : tab === "ingredients" ? (
              <IngredientsTab />
            ) : tab === "recipes" ? (
              <RecipesTab />
            ) : tab === "market" ? (
              <MarketTab />
            ) : (
              <DashboardTab />
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
