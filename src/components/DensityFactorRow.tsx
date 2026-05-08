import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ALL_UNITS, unitClass, unitLabel, type DensityFactor, type Unit, type BaseUnit } from "@/lib/units";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  factor: DensityFactor;
  baseUnit: BaseUnit;
  onChange: (field: keyof DensityFactor, value: string | Unit) => void;
  onDelete: () => void;
}

export function DensityFactorRow({ factor, baseUnit, onChange, onDelete }: Props) {
  // Factor's from_unit must be a class DIFFERENT from baseUnit's class — same-class is universal.
  const baseClass = unitClass(baseUnit);
  const validFromUnits = ALL_UNITS.filter((u) => unitClass(u) !== baseClass);
  return (
    <div className="flex items-center gap-2 bg-bg-surfaceAlt border border-border rounded px-3 py-2">
      <span className="text-sm text-text-secondary nums shrink-0">1</span>
      <Select
        value={factor.from_unit}
        onValueChange={(v) => onChange("from_unit", v as Unit)}
        options={validFromUnits.map((u) => ({ value: u, label: unitLabel(u) }))}
        className="!py-1.5 w-24"
      />
      <span className="text-sm text-text-secondary shrink-0">=</span>
      <Input
        type="number"
        step="any"
        value={factor.base_unit_amount}
        onChange={(e) => onChange("base_unit_amount", e.target.value)}
        className="!py-1.5 max-w-[120px]"
      />
      <span className="text-sm text-text-secondary shrink-0">{baseUnit}</span>
      <span
        className={cn(
          "ml-auto chip text-xs",
          factor.source === "calibrated" && "bg-success/15 text-success",
          factor.source === "user" && "bg-warning/15 text-warning"
        )}
      >
        {factor.source}
      </span>
      <button onClick={onDelete} className="btn-text shrink-0 p-1">
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
