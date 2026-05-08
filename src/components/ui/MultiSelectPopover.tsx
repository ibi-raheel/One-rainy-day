import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  label: string;
  options: MultiSelectOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Total count for the "All" pseudo-row, defaults to sum of option counts. */
  totalCount?: number;
  /** Width of the popover (px). */
  width?: number;
}

export function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
  totalCount,
  width = 320,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const total = totalCount ?? options.reduce((s, o) => s + (o.count ?? 0), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };

  const clear = () => onChange(new Set());

  const triggerLabel =
    selected.size === 0
      ? `All (${total})`
      : selected.size === 1
      ? Array.from(selected)[0]
      : `${selected.size} selected`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors duration-150 ease-out-soft",
            selected.size > 0
              ? "bg-accent-soft border-accent text-text-primary"
              : "bg-bg-surface border-border text-text-secondary hover:border-border-strong"
          )}
        >
          <span className="label-cap !mb-0">{label}</span>
          <span className="text-text-primary truncate max-w-[160px]" title={triggerLabel}>
            {triggerLabel}
          </span>
          {selected.size > 0 && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="ml-1 rounded-sm p-0.5 hover:bg-accent/20 cursor-pointer"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" strokeWidth={1.5} />
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          style={{ width }}
          className="z-50 rounded-md border border-border bg-bg-surface shadow-modal flex flex-col max-h-[420px] overflow-hidden"
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="input-base !py-1.5 !pl-8 !pr-2 text-sm w-full"
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-surfaceAlt/40">
            <button
              type="button"
              onClick={clear}
              className={cn(
                "text-xs hover:text-text-primary transition-colors",
                selected.size === 0 ? "text-text-primary font-medium" : "text-text-secondary"
              )}
            >
              All ({total})
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-accent hover:text-accent-hover"
              >
                Clear {selected.size}
              </button>
            )}
          </div>

          <ul className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-text-muted italic">No matches</li>
            ) : (
              filtered.map((o) => {
                const on = selected.has(o.value);
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-100",
                        on ? "bg-accent-soft/50" : "hover:bg-bg-surfaceAlt"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-sm border transition-colors shrink-0",
                          on ? "bg-accent border-accent text-white" : "border-border-strong"
                        )}
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={2.4} />}
                      </span>
                      <span className="flex-1 text-text-primary truncate">{o.label}</span>
                      {o.count != null && (
                        <span className="text-xs text-text-muted nums">{o.count}</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
