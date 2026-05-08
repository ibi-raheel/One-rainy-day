import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Accent = "accent" | "info" | "success" | "warning";

interface TabHeroProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  accent?: Accent;
  /** Right-aligned stat tiles. */
  stats?: Array<{ label: string; value: string | number; accent?: Accent }>;
  /** Right-aligned slot for a button or filter. */
  action?: ReactNode;
}

const ACCENT: Record<Accent, { ring: string; chipBg: string; chipText: string; from: string }> = {
  accent:  { ring: "ring-accent/30",  chipBg: "bg-accent/15",  chipText: "text-accent",  from: "from-accent/10"  },
  info:    { ring: "ring-info/30",    chipBg: "bg-info/15",    chipText: "text-info",    from: "from-info/10"    },
  success: { ring: "ring-success/30", chipBg: "bg-success/15", chipText: "text-success", from: "from-success/10" },
  warning: { ring: "ring-warning/30", chipBg: "bg-warning/15", chipText: "text-warning", from: "from-warning/10" },
};

export function TabHero({ title, subtitle, icon, accent = "accent", stats, action }: TabHeroProps) {
  const a = ACCENT[accent];
  return (
    <div
      className={cn(
        "card relative overflow-hidden mb-7 ring-1",
        a.ring
      )}
    >
      {/* gradient wash */}
      <div className={cn("absolute inset-0 bg-gradient-to-br", a.from, "to-transparent pointer-events-none")} />

      <div className="relative px-6 sm:px-7 py-5 flex items-center gap-5">
        {/* Icon disc */}
        <div
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center shrink-0 ring-1 ring-inset",
            a.chipBg,
            a.chipText,
            a.ring
          )}
        >
          {icon}
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <h2 className="display text-[26px] sm:text-[30px] font-medium text-text-primary tracking-tight leading-none">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>

        {/* Stat tiles */}
        {stats && stats.length > 0 && (
          <div className="hidden sm:flex items-stretch gap-2 shrink-0">
            {stats.map((s, i) => {
              const sa = s.accent ? ACCENT[s.accent] : a;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-md px-3 py-2 min-w-[78px] text-right ring-1 ring-inset",
                    sa.chipBg,
                    sa.ring
                  )}
                >
                  <div className={cn("hero-num text-xl nums leading-none", sa.chipText)}>
                    {s.value}
                  </div>
                  <div className="text-[10px] text-text-secondary mt-1 tracking-wide uppercase">
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action slot */}
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

