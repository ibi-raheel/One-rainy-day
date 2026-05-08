import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/store/app";
import { formatMoney } from "@/lib/cost";
import { unitLabel } from "@/lib/units";
import { ArrowRight, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  buildApplyPreview,
  applyToIngredient,
  type MarketProductLite,
} from "./applyMarketProduct";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ingredientId: string;
  product: MarketProductLite;
}

export function ApplyToIngredientDialog({ open, onOpenChange, ingredientId, product }: Props) {
  const ingredient = useApp((s) => s.ingredientsById.get(ingredientId));
  const upsert = useApp((s) => s.upsertIngredient);
  const [submitting, setSubmitting] = useState(false);

  if (!ingredient) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} title="Ingredient not found" size="md">
        <div className="text-sm text-text-secondary">That ingredient seems to have been deleted.</div>
      </Dialog>
    );
  }

  const preview = buildApplyPreview(ingredient, product);
  const cannotApply = preview.cannot != null;

  const apply = async () => {
    const next = applyToIngredient(ingredient, product);
    if (!next) return;
    setSubmitting(true);
    try {
      await upsert(next);
      onOpenChange(false);
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Update ${ingredient.name}`}
      description="Replace this ingredient's package with the market product. Your name, density factors, allergens, and notes are preserved."
      size="md"
    >
      <div className="space-y-5">
        {/* Product card */}
        <div className="rounded-md border border-border bg-bg-surfaceAlt px-4 py-3">
          <div className="text-xs text-text-muted">From {product.source_name}</div>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-0.5 text-text-primary hover:text-accent text-sm font-medium"
          >
            {product.title}
            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
          </a>
          <div className="text-xs text-text-muted nums mt-1">
            {product.pack_size_text || "—"} · {formatMoney(product.price)}
          </div>
        </div>

        {/* Side-by-side preview */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Side label="Current" data={preview.current} />
          <ArrowRight className="h-5 w-5 text-text-muted shrink-0" strokeWidth={1.5} />
          <Side
            label="After applying"
            data={preview.next}
            highlight={!cannotApply}
            disabled={cannotApply}
          />
        </div>

        {/* Delta strip */}
        {!cannotApply && (
          <div className="rounded-md border border-border bg-bg-surface px-4 py-3 flex items-baseline justify-between">
            <span className="text-sm text-text-secondary">Cost per {ingredient.base_unit} changes</span>
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-text-muted nums">
                {formatMoney(preview.current.cost_per_base)} → {formatMoney(preview.next.cost_per_base)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs hero-num nums",
                  preview.delta_pct < -0.5
                    ? "bg-success/15 text-success"
                    : preview.delta_pct > 0.5
                    ? "bg-error/15 text-error"
                    : "bg-bg-surfaceAlt text-text-secondary"
                )}
              >
                {preview.delta_pct > 0 ? "+" : ""}
                {preview.delta_pct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Cannot-apply warning */}
        {cannotApply && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <div className="text-text-primary font-medium">Can't apply automatically</div>
              <div className="text-text-secondary text-xs mt-0.5">{preview.cannot}</div>
              <div className="text-text-muted text-xs mt-1">
                Open the ingredient editor (Ingredients tab) and update the package fields by hand.
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={cannotApply || submitting}>
            {submitting ? "Saving…" : "Apply changes"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Side({
  label,
  data,
  highlight,
  disabled,
}: {
  label: string;
  data: {
    vendor: string | undefined;
    package_quantity: number;
    package_unit: any;
    package_cost: number;
    cost_per_base: number;
  };
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 transition-colors",
        highlight
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-bg-surface",
        disabled && "opacity-50"
      )}
    >
      <div className="label-cap mb-1.5">{label}</div>
      <div className="text-sm text-text-primary truncate">{data.vendor || "(no supplier)"}</div>
      <div className="text-xs text-text-muted nums mt-1">
        {data.package_quantity || "?"} {unitLabel(data.package_unit)} · {formatMoney(data.package_cost)}
      </div>
      {data.cost_per_base > 0 && (
        <div className="hero-num text-base text-text-primary nums mt-1.5">
          {formatMoney(data.cost_per_base)}
          <span className="text-xs text-text-muted ml-1 font-normal">/ {data.package_unit === "piece" ? "piece" : data.package_unit === "ml" || ["ml","l","cup","tbsp","tsp","fl_oz","gallon","pint","quart"].includes(data.package_unit) ? "ml" : "g"}</span>
        </div>
      )}
    </div>
  );
}
