import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ALL_UNITS, baseUnitFor, unitClass, unitLabel, type DensityFactor, type Unit } from "@/lib/units";
import { DensityFactorRow } from "@/components/DensityFactorRow";
import { searchLibrary, libraryFactorsForBase, type LibraryEntry } from "@/lib/density";
import { computeCostPerBaseUnit, formatMoney } from "@/lib/cost";
import { detectAllergens } from "@/lib/allergens";
import { ALLERGENS, DIETARY_FLAGS, type Allergen, type DietaryFlag, type Ingredient } from "@/db/types";
import { Trash2, Sparkles, Plus } from "lucide-react";

interface Props {
  initial?: Partial<Ingredient>;
  onSubmit: (ing: Omit<Ingredient, "created_at" | "updated_at" | "id"> & { id?: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const UNIT_OPTIONS = ALL_UNITS.map((u) => ({
  value: u,
  label: unitLabel(u as Unit),
}));

export function IngredientForm({ initial, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [packageQty, setPackageQty] = useState<string>(initial?.package_quantity?.toString() ?? "");
  const [packageUnit, setPackageUnit] = useState<Unit>((initial?.package_unit as Unit) ?? "g");
  const [packageCost, setPackageCost] = useState<string>(initial?.package_cost?.toString() ?? "");
  const [deliveryCost, setDeliveryCost] = useState<string>((initial?.delivery_cost ?? 0).toString());
  const [wasteFactor, setWasteFactor] = useState<string>((initial?.waste_factor ?? 1).toString());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [factors, setFactors] = useState<DensityFactor[]>(initial?.density_factors ?? []);
  const [allergens, setAllergens] = useState<Allergen[]>(initial?.allergens ?? []);
  const [dietary, setDietary] = useState<DietaryFlag[]>(initial?.dietary_flags ?? []);
  const [autoFilledFromLibrary, setAutoFilledFromLibrary] = useState(false);
  const [autoFilledAllergens, setAutoFilledAllergens] = useState(false);

  const baseUnit = baseUnitFor(packageUnit);

  // Reset density factors if the user changes base-unit class entirely.
  useEffect(() => {
    if (initial) return;
    setFactors([]);
  }, [baseUnit, initial]);

  const matches = useMemo<LibraryEntry[]>(() => {
    if (!name.trim()) return [];
    return searchLibrary(name, 5);
  }, [name]);

  const applyLibraryEntry = (entry: LibraryEntry) => {
    const newFactors = libraryFactorsForBase(entry, baseUnit);
    setFactors(newFactors);
    setAutoFilledFromLibrary(true);
    // Also pre-fill allergens by name
    if (allergens.length === 0 && dietary.length === 0) {
      const detected = detectAllergens(entry.name);
      if (detected.allergens.length || detected.dietary_flags.length) {
        setAllergens(detected.allergens);
        setDietary(detected.dietary_flags);
        setAutoFilledAllergens(true);
      }
    }
  };

  // Also pre-fill allergens when the user types a name (debounced via render)
  useEffect(() => {
    if (initial || allergens.length > 0 || dietary.length > 0 || !name.trim()) return;
    const detected = detectAllergens(name);
    if (detected.allergens.length || detected.dietary_flags.length) {
      setAllergens(detected.allergens);
      setDietary(detected.dietary_flags);
      setAutoFilledAllergens(true);
    }
  }, [name, initial]);

  const toggleAllergen = (a: Allergen) =>
    setAllergens((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  const toggleDietary = (d: DietaryFlag) =>
    setDietary((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const deliveryNum = parseFloat(deliveryCost) || 0;
  const costPerBase = useMemo(() => {
    const qty = parseFloat(packageQty);
    const cost = parseFloat(packageCost);
    if (!isFinite(qty) || !isFinite(cost) || qty <= 0) return 0;
    return computeCostPerBaseUnit(qty, packageUnit, cost, baseUnit, factors, deliveryNum);
  }, [packageQty, packageUnit, packageCost, baseUnit, factors, deliveryNum]);

  const updateFactor = (idx: number, field: keyof DensityFactor, value: string | Unit) => {
    setFactors((prev) => {
      const next = [...prev];
      const f = { ...next[idx] };
      if (field === "base_unit_amount") f.base_unit_amount = parseFloat(value as string) || 0;
      if (field === "from_unit") f.from_unit = value as Unit;
      if (field === "source") f.source = value as DensityFactor["source"];
      next[idx] = f;
      return next;
    });
  };

  const addFactor = () => {
    const used = new Set(factors.map((f) => f.from_unit));
    const candidate = (["tbsp", "tsp", "cup", "g", "ml", "piece"] as Unit[]).find(
      (u) => !used.has(u) && unitClass(u) !== unitClass(baseUnit as Unit)
    );
    setFactors((prev) => [
      ...prev,
      { from_unit: candidate ?? "tbsp", base_unit_amount: 0, source: "user" },
    ]);
  };

  const canSubmit = name.trim() && parseFloat(packageQty) > 0 && parseFloat(packageCost) >= 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const qty = parseFloat(packageQty);
    const cost = parseFloat(packageCost);
    onSubmit({
      id: initial?.id,
      name: name.trim(),
      vendor: vendor.trim() || undefined,
      package_quantity: qty,
      package_unit: packageUnit,
      package_cost: cost,
      delivery_cost: deliveryNum,
      base_unit: baseUnit,
      cost_per_base_unit: costPerBase,
      density_factors: factors,
      waste_factor: parseFloat(wasteFactor) || 1,
      allergens,
      dietary_flags: dietary,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Name</Label>
          <Input
            placeholder="e.g. Whole milk"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!initial}
          />
          {!initial && matches.length > 0 && !autoFilledFromLibrary && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs text-text-muted self-center">
                <Sparkles className="inline h-3 w-3 mr-1 text-accent" strokeWidth={1.5} />
                From library:
              </span>
              {matches.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => {
                    setName(m.name);
                    applyLibraryEntry(m);
                  }}
                  className="chip hover:bg-accent hover:text-white transition-colors duration-150 ease-out-soft"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label>Vendor</Label>
          <Input
            placeholder="e.g. Sam's Club"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>

        <div>
          <Label>Waste factor</Label>
          <Input
            type="number"
            step="0.01"
            min="1"
            value={wasteFactor}
            onChange={(e) => setWasteFactor(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-muted">1.0 = no waste; 1.05 = 5% loss in prep</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Package qty</Label>
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="100"
            value={packageQty}
            onChange={(e) => setPackageQty(e.target.value)}
          />
        </div>
        <div>
          <Label>Unit</Label>
          <Select
            value={packageUnit}
            onValueChange={(v) => setPackageUnit(v as Unit)}
            options={UNIT_OPTIONS}
          />
        </div>
        <div>
          <Label>Package cost ($)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="38.00"
            value={packageCost}
            onChange={(e) => setPackageCost(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Delivery cost ($)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={deliveryCost}
          onChange={(e) => setDeliveryCost(e.target.value)}
        />
        <p className="mt-1 text-xs text-text-muted">
          Optional. Supplier delivery fee allocated to this ingredient. Adds to package cost when calculating per-unit price.
        </p>
      </div>

      <div className="rounded-md bg-bg-surfaceAlt border border-border px-4 py-3 space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="label-cap">Cost per {baseUnit}</span>
          <span className="hero-num text-xl text-text-primary nums">
            {costPerBase > 0 ? formatMoney(costPerBase) : "—"}
          </span>
        </div>
        {deliveryNum > 0 && parseFloat(packageCost) > 0 && (
          <div className="text-xs text-text-muted nums">
            ({formatMoney(parseFloat(packageCost))} package + {formatMoney(deliveryNum)} delivery = {formatMoney(parseFloat(packageCost) + deliveryNum)} total)
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="mb-0">Density factors</Label>
          <button
            type="button"
            onClick={addFactor}
            className="btn-text text-sm"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add factor
          </button>
        </div>
        <p className="text-xs text-text-muted mb-2">
          Tells the system how to convert other units (e.g. tbsp, cup) into <span className="font-medium">{baseUnit}</span> for this ingredient.
        </p>
        {factors.length === 0 ? (
          <div className="text-sm text-text-muted italic">
            No density factors. Same-class conversions (e.g. {baseUnit === "g" ? "oz → g" : baseUnit === "ml" ? "cup → ml" : "piece"}) work automatically.
          </div>
        ) : (
          <div className="space-y-2">
            {factors.map((f, idx) => (
              <DensityFactorRow
                key={idx}
                factor={f}
                baseUnit={baseUnit}
                onChange={(field, value) => updateFactor(idx, field, value)}
                onDelete={() => setFactors((p) => p.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <Label className="mb-0">Allergens & dietary flags</Label>
          {autoFilledAllergens && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.5} />
              auto-detected — adjust as needed
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ALLERGENS.map((a) => {
            const on = allergens.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAllergen(a)}
                className={cn(
                  "rounded-sm px-2 py-1 text-xs border transition-colors duration-100",
                  on
                    ? "bg-error/15 border-error/40 text-error"
                    : "bg-bg-surface border-border text-text-secondary hover:border-border-strong"
                )}
              >
                {on ? "✓ " : ""}{a}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_FLAGS.map((d) => {
            const on = dietary.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDietary(d)}
                className={cn(
                  "rounded-sm px-2 py-1 text-xs border transition-colors duration-100",
                  on
                    ? "bg-success/15 border-success/40 text-success"
                    : "bg-bg-surface border-border text-text-secondary hover:border-border-strong"
                )}
              >
                {on ? "✓ " : ""}{d}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Notes (optional)</Label>
        <Textarea
          placeholder="e.g. Switch to local supplier in summer"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="btn-text text-sm text-error hover:bg-error/10"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {initial?.id ? "Save changes" : "Add ingredient"}
          </Button>
        </div>
      </div>
    </div>
  );
}

