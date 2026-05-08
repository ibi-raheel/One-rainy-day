# One Rainy Day — unified plan

A working document. The point: tie together what the cafe knows about its
**recipes**, **ingredients**, **market prices**, and **on-hand inventory** so
they all work off the same numbers and feed each other. Nothing here breaks
what's already shipping.

---

## The four domains and how they relate

```
                          ┌────────────────────────┐
                          │        RECIPES         │  ← already built
                          │  - inputs (ingr/sub)   │
                          │  - yield, sale price   │
                          │  - sales/period        │
                          └───────────┬────────────┘
                                      │ usage
                                      ▼
                          ┌────────────────────────┐
                          │      INGREDIENTS       │  ← already built
   Receipt OCR ──updates──│  - cost_per_base_unit  │
                          │  - density factors     │
   Market scrape ─info──→ │  - allergens           │
                          │  + on_hand_qty   (new) │
                          │  + reorder_point (new) │
                          │  + price_history (new) │
                          └─┬──────────────────┬───┘
                            │                  │
                  ┌─────────▼──────┐   ┌───────▼──────────┐
                  │     STOCK      │   │      MARKET      │
                  │  (new tab)     │   │  (new tab)       │
                  │ on-hand · ROP  │   │ FRED/BLS · sales │
                  │ shopping list  │   │ alternatives     │
                  └────────────────┘   └──────────────────┘
                            ▲                   ▲
                            │                   │
                  Receipt   │                   │ Daily scrape
                  OCR queue │                   │ (FRED, BLS,
                            │                   │ public Shopify)
                            │                   │
                  ┌─────────┴───────────────────┴────────┐
                  │           DASHBOARD                  │  ← already built
                  │ + Today's prep · Stock-out alerts ·  │
                  │   Price-drop alerts (new sections)   │
                  └──────────────────────────────────────┘
```

The whole thing already works without market or inventory. We're adding two
domains on top, both of which **read from but never silently mutate** the
existing ingredient/recipe data.

---

## Data model additions

### On `Ingredient` (extends current shape)

```ts
interface Ingredient {
  // ... everything that exists today (unchanged) ...

  // NEW: inventory
  on_hand_qty: number;          // in package_unit (e.g. 2.5 if she has 2.5 gallons of milk)
  reorder_point?: number;       // also in package_unit; when on_hand drops below, alert
  last_restocked_at?: string;   // ISO timestamp of last positive restock

  // NEW: price history (small ring buffer, last 24 entries)
  price_history?: Array<{
    at: string;                 // ISO date
    package_cost: number;       // total package cost at that moment
    delivery_cost: number;
    cost_per_base_unit: number; // computed at the time, frozen
    source: "manual" | "ocr" | "import";
  }>;
}
```

Three small additions; all optional; they default to 0/empty so existing
ingredients still work.

### New file `market.json` — separate from `cafe-data.json`

Refreshed by the Market agent. Never touches ingredient costs directly; the
UI surfaces it as suggestions only.

```ts
interface MarketSnapshot {
  fetched_at: string;
  commodities: Array<{
    series_id: string;          // e.g. "APU0000709112"
    name: string;               // "Whole Milk CPI"
    unit: string;
    series: Array<{ period: string; value: number }>; // last 18 months
    latest: number;
    prev: number;
    change_pct: number;
  }>;
  public_products: Array<{
    supplier: string;
    title: string;
    vendor: string;
    url: string;
    price: number;
    compare_at_price: number | null;
    pack_size: string;
    per_unit_price: number;     // normalized $/g or $/ml
    per_unit_label: string;     // "g" or "ml"
    on_sale: boolean;
    discount_pct: number;
    fetched_at: string;
  }>;
  /**
   * Pre-computed matches between her ingredients and market data,
   * built by the agent so the UI doesn't have to recompute on every render.
   */
  ingredient_matches: Array<{
    ingredient_id: string;
    commodity_series_id?: string;       // best matching commodity
    cheapest_public?: { supplier: string; per_unit_price: number; url: string };
    on_sale_anywhere?: Array<{ supplier: string; discount_pct: number }>;
    delta_vs_her_price?: number;        // % cheaper public (negative = good)
  }>;
}
```

### New file `receipts/` — directory of in-flight OCR drafts

Each receipt the user uploads becomes a JSON file with line items + matches,
sitting in a "review and confirm" queue. Confirmed receipts apply their
updates to `cafe-data.json` (price history + on-hand) and then move to a
`receipts/applied/` archive.

```ts
interface ReceiptDraft {
  id: string;
  uploaded_at: string;
  image_path: string;           // points to public/receipts/{id}.jpg
  source_supplier?: string;     // user-tagged or inferred
  status: "pending" | "applied" | "discarded";
  total?: number;               // OCR'd grand total
  line_items: Array<{
    raw_text: string;           // what was on the receipt
    parsed_qty?: number;
    parsed_unit?: string;
    parsed_price: number;
    match?: {
      ingredient_id: string;
      confidence: "high" | "medium" | "low";
    };
    user_decision?: "accept" | "skip" | "fix";
  }>;
}
```

---

## Tab structure (two new tabs)

```
[ Ingredients ]  [ Recipes ]  [ Stock ]  [ Market ]  [ Dashboard ]
```

### Stock — the daily-ops view

What the cafe owner / cousin checks every morning and at end-of-day.

- **On-hand table** — every ingredient with `on_hand_qty`, `reorder_point`,
  status pill (OK / low / out), last restocked date.
- **"Order soon" panel** — ingredients below their reorder point. One-click
  "Send shopping list" copies a formatted list to clipboard, grouped by
  supplier.
- **Receipt drop zone** — drag-drop or photo-upload a receipt image. Goes
  into the OCR queue. Pending receipts list shows up here for review.
- **End-of-day stock check** — quick UI to mark current quantities. Used
  to reconcile against estimated depletion from sales.

### Market — the watch-the-prices view

A rebrand of CafeRadar's three-tab dashboard, merged into one page in the
One Rainy Day palette.

- **Top alerts strip** — actionable notes:
  *"Milk CPI down 4.2% MoM — script: '…'."*
  *"Matcha cheaper at Barista Underground (-12%)."*
  *"Heavy cream on sale at Elmhurst, 22% off."*
- **Commodity charts** — FRED/BLS series with sparklines, filtered to ones
  that match her ingredients.
- **Find Cheapest** — apples-to-apples public price compare (CafeRadar's
  current "prices" tab), with each result linking back to the matched
  ingredient when relevant.
- **Refresh button** — manual trigger, shows last-fetched-at timestamp.
- **Schedule toggle** — daily auto-refresh on/off (only fires when laptop
  is on; obvious caveat surfaced).

### Dashboard — gets two new sections at the top

Existing Menu economics + Order planning are unchanged. Above them:

- **Today's prep** — auto-generated from menu items with sales volume +
  current stock. Pulls in sub-recipe batches that need to be made first
  (uses existing `scaleRecipe` logic).
- **Action items** — combined feed of stock-out alerts + market alerts.
  Click any item, jumps to the relevant tab.

---

## How everything actually links

### 1. Sales feed inventory depletion

When she enters or imports daily sales (existing `sales_volume_per_period`
on each menu item, plus a future "sold today" entry), the system computes
ingredient depletion through `computeDemand` (already built) and decrements
`on_hand_qty` accordingly. End-of-day actual stock check reconciles drift
("recipe theoretically used 2.4 lb chicken; on-hand counted shows 2.1 lb
used — yield/waste factor needs adjustment for chicken thigh").

### 2. Receipts feed ingredient prices + restock

User photographs a Sam's invoice. OCR returns line items. For each match:
- Append to `price_history` with `source: "ocr"` and date.
- Update `package_cost` + `cost_per_base_unit` going forward.
- Add the line-item quantity to `on_hand_qty`.
- Set `last_restocked_at`.

This is the **only** path that turns market reality into her data.

### 3. Market data feeds advice, never mutates

Agent reads ingredients, fuzzy-matches each against:
- FRED/BLS series (matcha → no match; milk → APU0000709112; coffee →
  PCOFFOTMUSDM; etc.)
- Public Shopify products
- Public sale flags

Writes results to `market.json`. UI reads from there. No change to her
ingredient costs without her clicking through.

### 4. Recipes pull from current ingredient costs

Already built. Stays the same. The cost engine doesn't care where the
price came from (manual, OCR, import) — it just reads
`cost_per_base_unit`.

### 5. Stock status appears in two more places

- **Ingredients tab** — small "low / out" pill next to ingredients below
  reorder point.
- **Recipes editor** — when a recipe input references an ingredient that
  is currently out of stock, the input row shows a small warning chip.
  Doesn't block costing, just communicates reality.

---

## Build phases (smallest useful chunk first)

### Phase 1 — Stock tab without OCR (~2–3 hours)

Add `on_hand_qty`, `reorder_point`, `last_restocked_at` to the Ingredient
type with safe defaults. New Stock tab. On-hand table with inline edit.
"Low stock" alerts based on reorder point. Manual restock button that
adds N to on-hand and bumps `last_restocked_at`.

**Why first:** zero external dependencies, no agent, no API key, no
scraping. Immediately useful as a stock checklist. If we never get to
later phases, this is still valuable.

### Phase 2 — Price history (~1 hour)

Whenever an ingredient's `package_cost`, `delivery_cost`, or
`cost_per_base_unit` changes, append to `price_history`. Show a small
sparkline next to each ingredient in the Ingredients table. New badge:
"+8% in 90 days" if rising, "−5%" if falling.

**Why second:** also zero external dependency. Wins on data she already
enters.

### Phase 3 — Market tab + commodity refresh (~3–4 hours)

Bring in CafeRadar's commodity scraper code, port to ESM in our server.
New Market tab with FRED/BLS charts only (skip the public-product
scraper for now). Manual "Refresh market data" button. Optional daily
schedule via setInterval in `server.mjs`. Match commodities to
ingredients by name, generate the renegotiation alert text.

**Why third:** no auth needed, public data only, low risk.

### Phase 4 — Public Shopify scrape + Find Cheapest (~3 hours)

Port CafeRadar's Shopify scraper for the three configured wholesalers.
Adds the "Find Cheapest" comparison view to the Market tab. Match
results back to her ingredients (matcha, syrups, alt-milks).

**Why fourth:** still public data, but slightly more brittle (Shopify
endpoints can change). Worth gating until commodities feel solid.

### Phase 5 — Receipt OCR (~4–5 hours, needs API key)

Photo upload → Anthropic Claude API call with image → structured line
items returned → review-and-confirm dialog → on accept, append to
price history and on-hand. Most useful single feature; biggest scope;
needs the API key so I'm putting it later in the order.

**Why last:** depends on Anthropic API key from you, costs ~pennies per
receipt but real money over a month, and adds a third-party dependency.
Worth waiting until phases 1–4 prove their value.

---

## Open questions before any code

1. **Phase 1 ordering** — does it match what you'd actually use first, or
   would you rather start with Market alerts (Phase 3)?
2. **Inventory units** — display on-hand in package units (gallons,
   pounds) or base units (ml, g)? My recommendation: package units, since
   that's how she shops. Base units shown as a smaller "= 4536 g"
   underneath.
3. **Stock-on-recipe display** — should an out-of-stock ingredient show
   as a hard error in the recipe editor, or just a soft warning chip?
   Probably soft (cost still calculated; she might be making a future
   plan). Confirm.
4. **Market refresh schedule** — once daily at 6 a.m., or just a manual
   button? Or both? My recommendation: manual button for now, add a
   schedule toggle later.
5. **Sales entry method** — she currently enters sales volume per
   period as a number on each menu item. For inventory depletion to
   work properly, do we want a daily "today I sold X" log instead, or
   keep using the period average? Period average is simpler; daily log
   is more accurate.
6. **Where does Receipt OCR live in the UI** — only on the Stock tab
   ("upload a delivery receipt"), or also on the Ingredients tab (for
   updating prices)? My recommendation: one entry point on Stock since
   receipts naturally bundle restock + repricing.

---

## What I will NOT touch in any phase

- `src/lib/units.ts` — the conversion engine.
- `src/lib/cost.ts` — the costing engine.
- `src/lib/density.ts` and `src/data/density-library.json`.
- The Recipes tab editor or its sub-recipe / breakdown / scale logic.
- The existing Dashboard's Menu economics and Order planning sections
  (only adding new sections above them).
- `cafe-data.json` schema — only adding optional fields with safe
  defaults, never renaming or removing.

If any of those have to change for some reason, I stop and we discuss.

---

## Timeline estimate

If we work through phases 1–5 in order, optimistic estimate: ~14–17 hours
of build time. Each phase is independently shippable, so we can stop at
any point and the app remains functional.
