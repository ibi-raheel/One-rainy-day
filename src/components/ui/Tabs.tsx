import { cn } from "@/lib/cn";
import { Sprout, BookOpen, BarChart3, Store } from "lucide-react";
import type { ReactNode } from "react";

interface TabDef {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  tabs: TabDef[];
}

const ICON_MAP: Record<string, ReactNode> = {
  ingredients: <Sprout className="h-4 w-4" strokeWidth={1.5} />,
  recipes: <BookOpen className="h-4 w-4" strokeWidth={1.5} />,
  market: <Store className="h-4 w-4" strokeWidth={1.5} />,
  dashboard: <BarChart3 className="h-4 w-4" strokeWidth={1.5} />,
};

export function Tabs({ value, onValueChange, tabs }: TabsProps) {
  return (
    <div className="border-b border-border">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const active = t.value === value;
          const icon = t.icon ?? ICON_MAP[t.value];
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onValueChange(t.value)}
              className={cn(
                "relative flex items-center gap-2 px-4 pt-2.5 pb-3 outline-none transition-all duration-150 ease-out-soft",
                "rounded-t-md",
                active
                  ? "bg-accent-soft/60 text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-surfaceAlt/60"
              )}
            >
              <span className={cn(active ? "text-accent" : "text-text-muted")}>{icon}</span>
              <span className={cn("display text-base", active && "font-medium")}>{t.label}</span>
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-px left-3 right-3 h-[2px] rounded-full transition-all duration-200 ease-out-soft",
                  active ? "opacity-100 bg-accent" : "opacity-0"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
