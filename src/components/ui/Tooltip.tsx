import * as RTooltip from "@radix-ui/react-tooltip";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={200}>{children}</RTooltip.Provider>;
}

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

export function Tooltip({ children, content, side = "top", align = "center", className }: TooltipProps) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-50 max-w-sm rounded-md border border-border bg-bg-surface shadow-modal px-3 py-2 text-sm text-text-primary",
            className
          )}
        >
          {content}
          <RTooltip.Arrow className="fill-bg-surface stroke-border" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
