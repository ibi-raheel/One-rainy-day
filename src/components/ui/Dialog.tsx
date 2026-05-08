import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "md" | "lg";
}

export function Dialog({ open, onOpenChange, title, description, children, size = "md" }: DialogProps) {
  const widths = { md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay
          className="fixed inset-0 z-40 bg-text-primary/30 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <RDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw]",
            widths[size],
            "rounded-lg bg-bg-surface shadow-modal border border-border",
            "max-h-[90vh] overflow-y-auto"
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-border">
            <div>
              <RDialog.Title className="display text-xl font-medium text-text-primary">{title}</RDialog.Title>
              {description && <RDialog.Description className="mt-1 text-sm text-text-secondary">{description}</RDialog.Description>}
            </div>
            <RDialog.Close className="btn-text -mt-1 -mr-1 p-1.5">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </RDialog.Close>
          </div>
          <div className="px-6 py-5">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
