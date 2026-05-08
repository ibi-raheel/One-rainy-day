/**
 * Tabbed Recipe edit modal — matches the design screenshot exactly.
 *
 * Tabs:
 *   - Basics            (name, type, sale price, sales/period)
 *   - Ingredients (N)   (input rows: ingredient/sub-recipe selector + qty + unit)
 *   - Yield & density   (yield qty + unit; density factors when sub-recipe)
 *   - Procedure         (step-by-step text + hold temp/time + equipment)
 *   - Dietary & notes   (allergen + diet chips, free-text notes)
 *
 * Footer:
 *   - Final cost · Margin (left)
 *   - Cancel · Save draft · Save recipe (right)
 *
 * Live cost recompute uses the same engine (computeRecipeCost) as before.
 * Existing rich tooling — breakdown dialog, scale dialog — opens from this
 * modal as additional dialogs on top.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useApp } from "@/store/app";
import {
  ALL_UNITS,
  baseUnitFor,
  unitClass,
  unitLabel,
  type DensityFactor,
  type Unit,
} from "@/lib/units";
import { DensityFactorRow } from "@/components/DensityFactorRow";
import { computeRecipeCost, formatMoney, formatPercent, findRecipeCycle } from "@/lib/cost";
import { type Recipe, type RecipeInput } from "@/db/types";
import { aggregateRecipeAllergens } from "@/lib/allergens";
import { Modal } from "@/components/design/Modal";
import { I } from "@/components/design/Icons";
import { InputPicker } from "./InputPicker";
import { BreakdownDialog } from "./BreakdownDialog";
import { ScaleDialog } from "./ScaleDialog";

type TabKey = "basics" | "ingredients" | "yield" | "procedure" | "notes";

interface Props {
  recipe: Recipe;
  onClose: () => void;
}

export function RecipeEditModal({ recipe, onClose }: Props) {
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);
  const recipes = useApp((s) => s.recipes);
  const upsert = useApp((s) => s.upsertRecipe);
  const remove = useApp((s) => s.deleteRecipe);

  const [draft, setDraft] = useState<Recipe>(recipe);
  const [tab, setTab] = useState<TabKey>("basics");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [savedNote, setSavedNote] = useState<string>("");
  const debounceRef = useRef<number | null>(null);

  // Reset when the recipe id changes (defensive; modals are per-recipe though)
  useEffect(() => { setDraft(recipe); }, [recipe.id]);

  // Live cost
  const cost = useMemo(
    () => computeRecipeCost(draft, ingredientsById, recipesById),
    [draft, ingredientsById, recipesById]
  );
  const margin = useMemo(() => {
    if (draft.type !== "menu_item" || !draft.sale_price || cost.total_cost <= 0) return null;
    return (draft.sale_price - cost.total_cost) / draft.sale_price;
  }, [draft, cost]);

  const update = (patch: Partial<Recipe>) => setDraft((d) => ({ ...d, ...patch }));

  const updateInput = (rowId: string, patch: Partial<RecipeInput>) =>
    setDraft((d) => ({
      ...d,
      inputs: d.inputs.map((i) => (i.row_id === rowId ? { ...i, ...patch } : i)),
    }));

  const addInput = () =>
    setDraft((d) => ({
      ...d,
      inputs: [
        ...d.inputs,
        { row_id: nanoid(), type: "ingredient", ref_id: "", quantity: 1, unit: "g" },
      ],
    }));

  const removeInput = (rowId: string) =>
    setDraft((d) => ({ ...d, inputs: d.inputs.filter((i) => i.row_id !== rowId) }));

  // Save handlers
  const saveDraft = async () => {
    const next = recipes.map((r) => (r.id === draft.id ? draft : r));
    const map = new Map(next.map((r) => [r.id, r]));
    const cycle = findRecipeCycle(draft, map);
    if (cycle) {
      alert("Cycle detected — this recipe references itself indirectly. Adjust inputs to remove the loop.");
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    await upsert(draft as any);
    setSavedNote("Draft saved");
    setTimeout(() => setSavedNote(""), 1500);
  };

  const saveRecipe = async () => {
    await saveDraft();
    if (savedNote === "") onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${draft.name}"?`)) return;
    await remove(draft.id);
    onClose();
  };

  const TABS: { key: TabKey; label: string; sub?: string }[] = [
    { key: "basics",      label: "Basics" },
    { key: "ingredients", label: `Ingredients (${draft.inputs.length})` },
    { key: "yield",       label: "Yield & density" },
    { key: "procedure",   label: "Procedure" },
    { key: "notes",       label: "Dietary & notes" },
  ];

  return (
    <>
      <Modal
        title={`Edit · ${draft.name}`}
        sub={`${draft.type === "menu_item" ? "Menu item" : "Sub-recipe"} · ${draft.inputs.length} inputs · final cost ${formatMoney(cost.total_cost)}`}
        onClose={onClose}
        width={920}
        footer={
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontSize: 13 }}>
              <span style={{ color: "var(--text-2)" }}>
                Final cost <strong style={{ color: "var(--ink)", fontFamily: "Fraunces, serif", fontSize: 15 }}>{formatMoney(cost.total_cost)}</strong>
              </span>
              {margin != null && (
                <span style={{ color: "var(--text-2)" }}>
                  · Margin{" "}
                  <strong style={{
                    color: margin < 0.6 ? "var(--error)" : margin < 0.7 ? "var(--warning)" : "var(--success)",
                    fontFamily: "Fraunces, serif", fontSize: 15,
                  }}>
                    {formatPercent(margin)}
                  </strong>
                </span>
              )}
              {savedNote && (
                <span style={{ color: "var(--success)", fontSize: 11.5 }}>✓ {savedNote}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn" onClick={saveDraft}>Save draft</button>
              <button className="btn primary" onClick={saveRecipe}>
                Save recipe <I.Check />
              </button>
            </div>
          </>
        }
      >
        {/* Tab bar */}
        <div style={{
          display: "flex",
          gap: 24,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: "8px 0 12px",
                  color: active ? "var(--ink)" : "var(--text-2)",
                  fontWeight: active ? 600 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  position: "relative",
                  fontFamily: "inherit",
                }}
              >
                {t.label}
                {active && (
                  <span style={{
                    position: "absolute",
                    left: 0, right: 0, bottom: -1,
                    height: 2,
                    background: "var(--accent)",
                    borderRadius: "2px 2px 0 0",
                  }}/>
                )}
              </button>
            );
          })}
        </div>

        {tab === "basics"      && <BasicsTab draft={draft} update={update} onDelete={handleDelete} onScale={() => setScaleOpen(true)} onBreakdown={() => setBreakdownOpen(true)} />}
        {tab === "ingredients" && <IngredientsTabContent draft={draft} updateInput={updateInput} addInput={addInput} removeInput={removeInput} />}
        {tab === "yield"       && <YieldDensityTab draft={draft} update={update} />}
        {tab === "procedure"   && <ProcedureTab draft={draft} update={update} />}
        {tab === "notes"       && <NotesTab draft={draft} update={update} />}
      </Modal>

      {breakdownOpen && (
        <BreakdownDialog
          open={breakdownOpen}
          onOpenChange={setBreakdownOpen}
          recipe={draft}
          result={cost}
          ingredientsById={ingredientsById}
          recipesById={recipesById}
        />
      )}
      {scaleOpen && (
        <ScaleDialog
          open={scaleOpen}
          onOpenChange={setScaleOpen}
          recipe={draft}
        />
      )}
    </>
  );
}

// ─── Basics ─────────────────────────────────────────────────────────────────

function BasicsTab({
  draft,
  update,
  onDelete,
  onScale,
  onBreakdown,
}: {
  draft: Recipe;
  update: (p: Partial<Recipe>) => void;
  onDelete: () => void;
  onScale: () => void;
  onBreakdown: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Field label="Name">
        <input
          className="input-base"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Recipe name"
        />
      </Field>

      <Field label="Type">
        <div className="segmented" style={{ alignSelf: "flex-start" }}>
          <button
            className={draft.type === "sub_recipe" ? "on" : ""}
            onClick={() => update({ type: "sub_recipe" })}
          >Sub-recipe</button>
          <button
            className={draft.type === "menu_item" ? "on" : ""}
            onClick={() => update({ type: "menu_item" })}
          >Menu item</button>
        </div>
      </Field>

      {draft.type === "menu_item" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Sale price">
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: 9, color: "var(--text-muted)" }}>$</span>
              <input
                className="input-base"
                type="number"
                step="0.01"
                value={draft.sale_price ?? ""}
                onChange={(e) => update({ sale_price: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                style={{ paddingLeft: 22 }}
                placeholder="0.00"
              />
            </div>
          </Field>
          <Field label="Sales / period">
            <input
              className="input-base"
              type="number"
              step="1"
              value={draft.sales_volume_per_period ?? ""}
              onChange={(e) => update({ sales_volume_per_period: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
              placeholder="0"
            />
          </Field>
        </div>
      )}

      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 8,
        paddingTop: 16,
        borderTop: "1px solid var(--border)",
      }}>
        <button className="btn" onClick={onScale}>Scale to batch</button>
        <button className="btn" onClick={onBreakdown}>View cost breakdown</button>
        <button
          className="btn ghost"
          onClick={onDelete}
          style={{ color: "var(--error)", marginLeft: "auto" }}
        >
          Delete recipe
        </button>
      </div>
    </div>
  );
}

// ─── Ingredients ────────────────────────────────────────────────────────────

const UNIT_OPTIONS = ALL_UNITS.map((u) => ({ value: u, label: unitLabel(u as Unit) }));

function IngredientsTabContent({
  draft,
  updateInput,
  addInput,
  removeInput,
}: {
  draft: Recipe;
  updateInput: (rowId: string, p: Partial<RecipeInput>) => void;
  addInput: () => void;
  removeInput: (rowId: string) => void;
}) {
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
        {draft.inputs.length} input{draft.inputs.length === 1 ? "" : "s"}
      </div>

      {draft.inputs.length === 0 ? (
        <div style={{
          padding: 24,
          border: "1px dashed var(--border)",
          borderRadius: 10,
          textAlign: "center",
          color: "var(--text-muted)",
        }}>
          No inputs yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {draft.inputs.map((inp) => {
            const target = inp.type === "ingredient"
              ? ingredientsById.get(inp.ref_id)
              : recipesById.get(inp.ref_id);
            const baseClass = target
              ? unitClass(
                  inp.type === "ingredient"
                    ? (target as any).base_unit
                    : (target as Recipe).yield_unit
                )
              : null;
            const validUnit = !baseClass || unitClass(inp.unit) === baseClass ||
              (inp.type === "ingredient" &&
                (target as any)?.density_factors?.some((f: any) => unitClass(f.from_unit) === unitClass(inp.unit))) ||
              (inp.type === "recipe" &&
                (target as Recipe)?.density_factors?.some((f) => unitClass(f.from_unit) === unitClass(inp.unit)));

            return (
              <div
                key={inp.row_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 110px 110px auto",
                  gap: 10,
                  alignItems: "start",
                }}
              >
                <InputPicker
                  excludeRecipeId={draft.id}
                  selected={inp.ref_id ? { type: inp.type, ref_id: inp.ref_id } : null}
                  onSelect={(sel) => {
                    let nextUnit: Unit = "g";
                    if (sel.type === "ingredient") {
                      const ing = ingredientsById.get(sel.ref_id);
                      if (ing) nextUnit = ing.base_unit as Unit;
                    } else {
                      const rec = recipesById.get(sel.ref_id);
                      if (rec) nextUnit = rec.yield_unit;
                    }
                    updateInput(inp.row_id, { type: sel.type, ref_id: sel.ref_id, unit: nextUnit });
                  }}
                />
                <input
                  className="input-base"
                  type="number"
                  step="any"
                  min="0"
                  value={inp.quantity}
                  onChange={(e) => updateInput(inp.row_id, { quantity: parseFloat(e.target.value) || 0 })}
                />
                <div>
                  <select
                    className="input-base"
                    value={inp.unit}
                    onChange={(e) => updateInput(inp.row_id, { unit: e.target.value as Unit })}
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {!validUnit && (
                    <div style={{ fontSize: 10, color: "var(--warning)", marginTop: 2 }}>
                      Need density factor
                    </div>
                  )}
                </div>
                <button
                  className="btn ghost"
                  onClick={() => removeInput(inp.row_id)}
                  aria-label="Remove"
                  style={{ alignSelf: "start" }}
                >
                  <I.X />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="btn"
        onClick={addInput}
        style={{ alignSelf: "flex-start" }}
      >
        <I.Plus /> Add input
      </button>
    </div>
  );
}

// ─── Yield & density ────────────────────────────────────────────────────────

function YieldDensityTab({
  draft,
  update,
}: {
  draft: Recipe;
  update: (p: Partial<Recipe>) => void;
}) {
  const yieldBase = baseUnitFor(draft.yield_unit);
  const yieldClass = unitClass(draft.yield_unit);

  const updateFactor = (idx: number, field: keyof DensityFactor, value: string | Unit) => {
    const next = [...(draft.density_factors ?? [])];
    const f = { ...next[idx] };
    if (field === "base_unit_amount") f.base_unit_amount = parseFloat(value as string) || 0;
    if (field === "from_unit") f.from_unit = value as Unit;
    if (field === "source") f.source = value as DensityFactor["source"];
    next[idx] = f;
    update({ density_factors: next });
  };

  const addFactor = () => {
    const used = new Set((draft.density_factors ?? []).map((f) => f.from_unit));
    const candidate = (["tbsp", "tsp", "cup", "g", "ml", "oz", "lb", "piece"] as Unit[]).find(
      (u) => !used.has(u) && unitClass(u) !== yieldClass
    );
    update({
      density_factors: [
        ...(draft.density_factors ?? []),
        { from_unit: candidate ?? "tbsp", base_unit_amount: 0, source: "user" },
      ],
    });
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "140px 140px 1fr", gap: 16, alignItems: "end" }}>
        <Field label="Yield quantity">
          <input
            className="input-base"
            type="number"
            step="any"
            min="0"
            value={draft.yield_quantity}
            onChange={(e) => update({ yield_quantity: parseFloat(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Yield unit">
          <select
            className="input-base"
            value={draft.yield_unit}
            onChange={(e) => update({ yield_unit: e.target.value as Unit })}
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          {draft.type === "sub_recipe"
            ? "How much this recipe makes — required so other recipes can use it as an input."
            : "Usually 1 — what the customer gets per order."}
        </p>
      </div>

      {draft.type === "sub_recipe" && (
        <div style={{
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          display: "grid",
          gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 16 }}>
              Density factors
            </h3>
            <button className="btn ghost" onClick={addFactor}>
              <I.Plus /> Add factor
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Optional. Lets other recipes call for this in a different unit class than your yield.
            For example, a syrup that yields in <strong>{unitLabel(draft.yield_unit)}</strong> can declare{" "}
            {yieldClass === "weight" ? "1 cup = ___ g" : yieldClass === "volume" ? "1 g = ___ ml" : "1 g = ___ piece"}{" "}
            so callers can ask for it in volume or weight as needed.
          </p>
          {(draft.density_factors ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
              No factors. Recipes can only call for this in {yieldClass} units.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {(draft.density_factors ?? []).map((f, idx) => (
                <DensityFactorRow
                  key={idx}
                  factor={f}
                  baseUnit={yieldBase}
                  onChange={(field, value) => updateFactor(idx, field, value)}
                  onDelete={() =>
                    update({ density_factors: (draft.density_factors ?? []).filter((_, i) => i !== idx) })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Procedure ──────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = [
  "—",
  "Espresso machine + steam",
  "Espresso machine",
  "Hot water boiler",
  "Stovetop",
  "Oven",
  "Sandwich press",
  "Fryer",
  "Blender",
  "Hand mixer",
  "Standmixer",
  "Cold brew tower",
  "Drip filter",
  "French press",
  "Microwave",
  "Counter prep · cold",
  "Counter prep · hot",
];

function ProcedureTab({
  draft,
  update,
}: {
  draft: Recipe;
  update: (p: Partial<Recipe>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Field label="Step-by-step procedure">
        <textarea
          className="input-base"
          value={draft.procedure ?? ""}
          onChange={(e) => update({ procedure: e.target.value })}
          rows={10}
          placeholder={"1. Pull a double espresso shot.\n2. Steam milk to 150°F with fine micro-foam.\n3. Add 22 ml vanilla syrup to cup.\n4. Pour espresso, then steamed milk, free-pouring a rosetta."}
          style={{ fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 16 }}>
        <Field label="Hold temp">
          <input
            className="input-base"
            value={draft.hold_temp ?? ""}
            onChange={(e) => update({ hold_temp: e.target.value })}
            placeholder="e.g. 150°F"
          />
        </Field>
        <Field label="Hold time">
          <input
            className="input-base"
            value={draft.hold_time ?? ""}
            onChange={(e) => update({ hold_time: e.target.value })}
            placeholder="e.g. 2 hr"
          />
        </Field>
        <Field label="Equipment">
          <select
            className="input-base"
            value={draft.equipment ?? "—"}
            onChange={(e) => update({ equipment: e.target.value === "—" ? undefined : e.target.value })}
          >
            {EQUIPMENT_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

// ─── Dietary & notes ────────────────────────────────────────────────────────

function NotesTab({
  draft,
  update,
}: {
  draft: Recipe;
  update: (p: Partial<Recipe>) => void;
}) {
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);

  // Real aggregated allergens — not a static legend. Walks transitively
  // through sub-recipes via the same engine the rest of the app uses.
  const summary = aggregateRecipeAllergens(draft, ingredientsById, recipesById);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Field label="Notes">
        <textarea
          className="input-base"
          value={draft.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          rows={6}
          placeholder="Plating notes, brand-specific overrides, allergen warnings, prep tips…"
          style={{ fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
        />
      </Field>

      <div style={{
        paddingTop: 16,
        borderTop: "1px solid var(--border)",
        display: "grid",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
            Auto-detected allergens
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            from this recipe's ingredients
          </span>
        </div>

        {summary.allergens.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
            No allergens detected. Add ingredients (or sub-recipes) for this to populate.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {summary.allergens.map((a) => {
              const sources = summary.sources[a] ?? [];
              return (
                <span
                  key={a}
                  className="tag"
                  style={{
                    background: "rgba(200, 137, 58, 0.12)",
                    borderColor: "rgba(200, 137, 58, 0.35)",
                    color: "var(--warning)",
                  }}
                  title={`From: ${sources.join(", ")}`}
                >
                  {a}
                </span>
              );
            })}
          </div>
        )}

        {summary.allergens.length > 0 && (
          <details style={{ fontSize: 12, color: "var(--text-2)" }}>
            <summary style={{ cursor: "pointer" }}>Show source ingredients</summary>
            <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
              {summary.allergens.map((a) => (
                <li key={a} style={{ marginTop: 4 }}>
                  <strong style={{ color: "var(--ink)" }}>{a}:</strong>{" "}
                  {(summary.sources[a] ?? []).join(", ")}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
