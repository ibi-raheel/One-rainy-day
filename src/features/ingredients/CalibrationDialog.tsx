import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ALL_UNITS, baseUnitFor, unitClass, unitLabel, type DensityFactor, type Unit } from "@/lib/units";
import type { Ingredient } from "@/db/types";

interface Props {
  ingredient: Ingredient;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (factor: DensityFactor) => void;
}

/**
 * Calibration weigh: user scoops 1 tbsp, weighs it, enters the weight.
 * We store it as a calibrated factor for that unit.
 */
export function CalibrationDialog({ ingredient, open, onOpenChange, onSave }: Props) {
  const baseClass = unitClass(ingredient.base_unit as Unit);
  const candidateUnits = ALL_UNITS.filter((u) => unitClass(u) !== baseClass);
  const [fromQty, setFromQty] = useState("1");
  const [fromUnit, setFromUnit] = useState<Unit>("tbsp");
  const [measured, setMeasured] = useState("");

  const measuredNum = parseFloat(measured);
  const fromNum = parseFloat(fromQty) || 1;
  const baseUnitAmount = isFinite(measuredNum) && fromNum > 0 ? measuredNum / fromNum : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Calibrate ${ingredient.name}`}
      description="Measure however you normally would, weigh it, and enter the result. We'll use your number from now on."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>You measured</Label>
            <Input
              type="number"
              step="any"
              value={fromQty}
              onChange={(e) => setFromQty(e.target.value)}
            />
          </div>
          <div>
            <Label>Of unit</Label>
            <Select
              value={fromUnit}
              onValueChange={(v) => setFromUnit(v as Unit)}
              options={candidateUnits.map((u) => ({ value: u, label: unitLabel(u) }))}
            />
          </div>
          <div>
            <Label>It weighed ({ingredient.base_unit})</Label>
            <Input
              type="number"
              step="any"
              placeholder="e.g. 5.8"
              value={measured}
              onChange={(e) => setMeasured(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        {baseUnitAmount > 0 && (
          <div className="rounded-md bg-bg-surfaceAlt border border-border px-4 py-3 text-sm">
            Will save: <span className="font-medium nums">1 {unitLabel(fromUnit)} = {baseUnitAmount.toFixed(3)} {ingredient.base_unit}</span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!(baseUnitAmount > 0)}
            onClick={() => {
              onSave({
                from_unit: fromUnit,
                base_unit_amount: baseUnitAmount,
                source: "calibrated",
              });
              onOpenChange(false);
            }}
          >
            Save calibration
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
