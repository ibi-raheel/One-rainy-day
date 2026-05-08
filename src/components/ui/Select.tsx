import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, onValueChange, options, placeholder, className, disabled }: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger
        className={cn(
          "input-base flex items-center justify-between gap-2 disabled:opacity-50",
          className
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[320px] overflow-hidden rounded-md border border-border bg-bg-surface shadow-modal"
        >
          <RSelect.ScrollUpButton className="flex h-6 items-center justify-center text-text-muted">
            ▲
          </RSelect.ScrollUpButton>
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center gap-2 rounded px-3 py-1.5 text-sm",
                  "data-[highlighted]:bg-accent-soft data-[highlighted]:outline-none",
                  "data-[state=checked]:text-text-primary"
                )}
              >
                <RSelect.ItemIndicator>
                  <Check className="h-3.5 w-3.5 text-accent" strokeWidth={1.8} />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
          <RSelect.ScrollDownButton className="flex h-6 items-center justify-center text-text-muted">
            ▼
          </RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
