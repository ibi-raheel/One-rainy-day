# Cafe Data Import Preview

This is the verification artifact for the bulk import. Read it against the source files (`cafe-pricing-reference.docx` and `recipe just ingredient list Raber.pdf`). Tell me what to fix; only after sign-off do I generate the actual import JSON.

## Decisions applied

- **Price ranges** → midpoint
- **Sub-recipe yields not in PDF** → computed from sum of input volumes (flagged below)
- **Pinch / to taste / decor** → skipped
- **Labeled inline sections** (Batter:, Sauce:, Basil Pesto:) → promoted to sub-recipes

**Totals:** 101 ingredients, 12 sub-recipes, 31 menu items.

## Open questions (decide before I generate the JSON)

- **1. Brand price ranges with high variance** — e.g. Espresso beans `$45–70`, Sakura powder `$25–45`. Midpoint applied. Tell me if you have a specific brand and price.
- **2. QUOTE-confidence items.** I will create them with `package_cost: 0` and a notes flag so they don't pollute cost math:
   - Pink lemonade *Dominade* powder (After-the-Storm drink)
   - Old Soul taiyaki mix (price estimate is $0.013/g but unverified)
   - Sakura powder (could be powder or syrup — confirm form factor)
- **3. Cold Foam batch yield** — PDF specifies 50-serving batch with no total volume. I computed ~250 ml (sum of the listed ingredients) ⇒ ~5 ml/serving. Confirm or override.
- **4. Mixed Milk batch yield** — PDF lists ingredients; I computed ~4732 ml from sum of inputs (1 cup water + 1 cup coffee mate powder + 1 gallon milk + 2 cup heavy cream). Earlier our spec used 5000 ml — minor discrepancy.
- **5. Simple Syrup yield** — PDF says only `1:1 ratio sugar water`. Used 1 cup sugar + 1 cup water → ~355 ml syrup as the working batch (matches our earlier spec). Tell me if she actually batches a different size.
- **6. Latte sub-recipe quantities (Raspberry Danish, Biscoff)** — these reference batch preps that yield enough for many drinks. The PDF doesn't specify per-drink quantities. I've put `1 piece` of each sub-recipe in the menu item as a placeholder. I need either:
   - the per-drink amounts (e.g. 30 g compote + 30 g foam per Raspberry Danish), or
   - confirmation that 1 latte uses one batch (unlikely)
- **7. Lemon Garlic Chicken Sauce** — same issue: how much sauce per sandwich? Currently `1 piece` of the sub-recipe.
- **8. Tuscan Pasta has both fettuccine AND penne** in source (lines 7 and 18 of the PDF entry). Likely a copy-paste bug. Currently keeping both. Probably should drop one.
- **9. "Water" as an ingredient** — used in many recipes but not in pricing doc. I'll create a `Water` ingredient at `$0` (essentially free) so recipes reference it cleanly.
- **10. Lettuce / cucumber / lemon are 'piece'-based** in pricing doc but recipes sometimes use partial pieces (½ lettuce, ¼ tsp lemon). Density factors from pricing doc (e.g. lemon = 100 g per piece, ~3 tbsp juice) will cover the cross-class conversions. Confirmed already by the docx.
- **11. Whipped cream / chocolate drizzle (Hot Chocolate)** — non-quantified styling. Skipped per decision.
- **12. Espresso shot** — pricing doc has `Espresso beans (whole)` priced per gram. A standard double shot uses ~14–18 g of dry beans. I'll create `espresso shot` as a sub-recipe (`1 shot = 8 g espresso beans`, or whatever you confirm) so menu items can reference 'shot' counts cleanly. Confirm grammage.

## Reconciliation

### Recipe ingredients with no pricing-doc match (1 items)

- `Just Bagels — Original` — would map to *Just Bagels — Original* but not present in pricing doc

### Pricing-doc ingredients NOT used by any recipe (16 items)

_(These will still be created as ingredients so they're available to add to recipes later.)_

- Ginger root, fresh
- Lotus Biscoff crumb topping
- Just Bagels — Original (frozen)
- Just Bagels — Everything
- Just Bagels — Jalapeño
- Bridor Perfect Croissant (2.8 oz)
- Bridor Butter Chocolatine (chocolate croissant)
- Bridor Spinach & Feta Bistro
- Bridor Tomato & Olive Bistro
- Bridor Peach Danish
- Bridor Strawberry Cheesecake Danish
- Bridor Apple Butter Danish
- Frozen French fries (shoestring/regular cut)
- Frozen chicken nuggets
- Gelato (foodservice tubs)
- Mochi (frozen, 4 flavors)

## Ingredients to be created

### Proteins (3)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| Chicken thigh, boneless skinless | 40 lb case (frozen) | $130.00 (from `~$130`) | $0.0072/g | Lean meat: ~3 lb/qt; portion-priced | HIGH | Restaurant Depot / Sam's |
| Eggs, large grade A | 15-doz flat (180 ct) | $52.50 (from `$45–$60`) | $0.27/egg = $0.0054/g | 1 egg ≈ 50 g (whole), 33 g white, 17 g yolk | HIGH | Restaurant Depot / Sam's |
| Turkey ham, sliced deli | 10 lb tray (sliced) | $55.00 (from `~$45–$65`) | $0.0125/g | Pre-sliced, weight-based | MED | Restaurant Depot |

### Dairy (9)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| Whole milk | 1 gallon (3,785 mL) | $3.48 (from `$3.48`) | $0.000919/mL | 1 cup = 244 g · 1 tbsp = 15.3 g | HIGH | Sam's Club |
| Heavy cream | Half gallon × 3-pack (5,678 mL) | $14.72 (from `$14.72`) | $0.00259/mL | 1 cup = 232 g · 1 tbsp = 14.5 g | HIGH | Sam's Club |
| Mayonnaise (Hellmann's Real) | 1 gallon × 4-case | $19.75 (from `$78.99 case = $19.75/gal`) | $0.00521/g | 1 cup = 226 g · 1 tbsp = 14 g | HIGH | Webstaurant |
| Greek yogurt, plain whole | 32 oz tub (907 g) | $5.75 (from `$5.50–$6.00`) | $0.0064/g | 1 cup = 245 g | MED | Sam's Club |
| Shredded Parmesan | 5 lb bag (2,268 g) | $29.00 (from `$26–$32`) | $0.0128/g | 1 cup = 100 g · 1 tbsp = 6.3 g | MED | Sam's Club / Restaurant Depot |
| Sliced cheddar (Colby Jack) | 120-slice (3 lb / 1,360 g) | $16.50 (from `$15–$18`) | $0.013/g | 1 slice ≈ 19 g | MED | Sam's Club |
| Cream cheese | 3 lb bar (1,360 g) | $9.50 (from `$8–$11`) | $0.0066/g | 1 cup = 227 g · 1 tbsp = 14 g | MED | Sam's Club |
| Butter, unsalted | 1 lb (4 sticks, 454 g) | $5.00 (from `$4.50–$5.50`) | $0.0110/g | 1 cup = 226 g · 1 tbsp = 14.2 g | HIGH | Sam's Club |
| Sweetened condensed milk | 14 oz can (397 g) — 24/case | $55.00 (from `$50–$60 case`) | $0.00591/g (per can $2.20) | 1 cup = 306 g | MED | Webstaurant / Restaurant Depot |

### Produce & Aromatics (14)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| Iceberg / romaine lettuce | Per head (~600 g) | $2.00 (from `$1.50–$2.50`) | $0.003–$0.004/g | Weight-based | MED | Restaurant Depot / Sam's |
| Roma tomato | 25 lb case (~11.3 kg) | $27.00 (from `$22–$32`) | $0.0024/g | 1 medium ~120 g | MED | Restaurant Depot |
| English / Persian cucumber | Each (~270 g) | $1.02 (from `$0.79–$1.25`) | $0.0034/g | 1 medium ~270 g | MED | Sam's Club / RD |
| Radishes | Bunch (~150 g, ~6 ct) | $1.75 (from `$1.50–$2.00`) | $0.012/g | 1 radish ~25 g | MED | Sam's / grocery |
| Yellow onion | 50 lb bag | $18.50 (from `$15–$22`) | $0.00081/g | 1 medium ~110 g · 1 cup diced ~142 g | HIGH | Restaurant Depot |
| Garlic, peeled fresh | 5 lb tub (2,268 g) | $18.00 (from `$14–$22`) | $0.0079/g | 1 clove ~4 g | MED | Restaurant Depot |
| Lemons (fresh) | 5 lb bag (~15 ct) | $8.50 (from `$7–$10`) | $0.55–$0.65/lemon | 1 lemon = 100 g (~3 tbsp juice + 2 tsp zest) | HIGH | Sam's Club |
| Mint, fresh | Bunch / 1 oz clamshell | $2.75 (from `$2.00–$3.50`) | $0.07–$0.12/g | Hard to weigh; count leaves | MED | Grocery / RD |
| Parsley, flat-leaf fresh | Bunch (~60 g) | $1.50 (from `$1.00–$2.00`) | $0.025/g | Variable | MED | Grocery / RD |
| Basil, fresh | Bunch (~30 g) | $2.75 (from `$2.00–$3.50`) | $0.10/g | 1 cup leaves ~25 g | MED | Grocery / Sam's |
| Spinach, baby | 1 lb clamshell (454 g) | $4.00 (from `$3.50–$4.50`) | $0.0088/g | 1 cup chopped ~30 g | MED | Sam's Club |
| Spring onions / scallions | Bunch (~80 g) | $1.25 (from `$0.99–$1.50`) | $0.014/g | 1 cup sliced ~64 g | MED | Sam's / grocery |
| Raspberries, fresh | 6 oz clamshell (170 g) | $4.25 (from `$3.50–$5.00`) | $0.026/g | 1 cup = 120 g | HIGH | Sam's (12 oz $4.99) |
| Ginger root, fresh | Per lb | $3.25 (from `$2.50–$4.00/lb`) | $0.0066/g | 1 inch ~6 g · 1 cup sliced ~96 g | MED | Sam's / RD |

### Dry Goods, Spices & Pantry (22)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| All-purpose flour | 25 lb bag (11,340 g) | $13.50 (from `$12–$15`) | $0.00118/g | 1 cup = 120 g · 1 tbsp = 7.5 g | HIGH | Sam's Club / Restaurant Depot |
| Cake flour | 5 lb bag (2,268 g) | $6.25 (from `$5.50–$7.00`) | $0.0027/g | 1 cup = 120 g · 1 tbsp = 7.5 g | MED | Sam's / Walmart Business |
| Granulated white sugar | 10 lb bag (4,536 g) | $6.58 (from `$6.58`) | $0.00145/g | 1 cup = 198 g · 1 tbsp = 12.4 g · 1 tsp = 4.1 g | HIGH | Sam's Club |
| Brown sugar (light, packed) | 7 lb bag (3,175 g) | $9.00 (from `$8–$10`) | $0.0028/g | 1 cup PACKED = 213 g · 1 tbsp = 13.3 g | MED | Sam's Club |
| Cane sugar | 4 lb bag (1,814 g) | $8.50 (from `$7–$10`) | $0.0044/g | 1 cup = 200 g (treat as granulated) | MED | Sam's / Walmart |
| Salt (Diamond Crystal kosher) | 3 lb box (1,360 g) | $6.25 (from `$5.50–$7.00`) | $0.0044/g | 1 cup = 128 g · 1 tbsp = 8 g · 1 tsp = 2.7 g | HIGH | Sam's / Restaurant Depot |
| Black pepper, ground | 16 oz container (454 g) | $12.50 (from `$10–$15`) | $0.026/g | 1 tsp = 2.2 g | MED | Sam's / Restaurant Depot |
| Red pepper / cayenne | 16 oz container (454 g) | $10.00 (from `$8–$12`) | $0.022/g | 1 tsp = 1.8 g | MED | Restaurant Depot |
| Paprika (smoked or sweet) | 16 oz container (454 g) | $11.00 (from `$8–$14`) | $0.024/g | 1 tsp = 2.3 g · 1 tbsp = 6.8 g | MED | Restaurant Depot / Sam's |
| Ground cumin | 16 oz container (454 g) | $10.00 (from `$8–$12`) | $0.022/g | 1 tsp = 2.2 g | MED | Restaurant Depot |
| Garlic powder | 21 oz container (595 g) | $10.00 (from `$8–$12`) | $0.017/g | 1 tsp = 3.3 g · 1 tbsp = 9.8 g | HIGH | Sam's (Tone's brand) |
| Onion powder | 20 oz container (567 g) | $8.50 (from `$7–$10`) | $0.014/g | 1 tsp = 2.5 g | HIGH | Sam's (Tone's brand) |
| Italian seasoning | 5 oz container (142 g) | $6.50 (from `$5–$8`) | $0.042/g | 1 tsp = 1.2 g | MED | Sam's / RD |
| Baking powder | 4 lb container (1,814 g) | $11.50 (from `$10–$13`) | $0.0066/g | 1 tsp = 4 g · 1 tbsp = 12 g | HIGH | Sam's (Clabber Girl) |
| Cream of tartar | 8 oz jar (227 g) | $10.00 (from `$8–$12`) | $0.044/g | 1 tsp = 3.2 g | MED | Sam's / Walmart |
| Cornstarch | 1 lb box (454 g) | $2.50 (from `$2–$3`) | $0.0055/g | 1 tsp = 2.3 g · 1 tbsp = 7 g | HIGH | Sam's / Walmart |
| Yellow mustard (prepared) | 1 gallon | $12.00 (from `$10–$14`) | $0.0030/g | 1 cup = 250 g · 1 tbsp = 15.6 g | MED | Webstaurant / RD |
| Distilled white vinegar | 1 gallon (3,785 mL) | $4.25 (from `$3.50–$5.00`) | $0.00099/mL | Treat as ~1 g/mL | HIGH | Sam's / RD |
| Extra virgin olive oil | 3 L tin (3,000 mL) | $38.50 (from `$32–$45`) | $0.012/mL | 1 cup = 200 g · 1 tbsp = 13.5 g | MED | Sam's (Bertolli/Member's Mark) |
| Vanilla extract (pure) | 32 fl oz (946 mL) | $75.00 (from `$60–$90`) | $0.075/mL | 1 tsp = 4.7 g · 1 tbsp = 14 g | MED | Sam's (Tone's) or Costco |
| Honey | 5 lb jug (2,268 g) | $21.50 (from `$18–$25`) | $0.0094/g | 1 tbsp = 21 g · 1 tsp = 7 g | HIGH | Sam's / Costco |
| Maple syrup, pure | 32 oz (946 mL) | $20.00 (from `$15–$25`) | $0.020/mL | 1 cup = 312 g · 1 tbsp = 19.5 g | HIGH | Sam's / Costco (Kirkland) |

### Sauces, Specialty & Asian Pantry (8)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| Chipotle peppers in adobo | 28 oz can (794 g) | $6.00 (from `$5–$7`) | $0.0080/g | 1 pepper ~15 g | MED | Restaurant Depot / Sam's |
| Sundried tomato (oil-packed) | 32 oz jar (907 g) | $15.00 (from `$12–$18`) | $0.017/g | 1 tbsp diced ~14 g | MED | Sam's / RD |
| Tomato puree / passata | #10 can (102 oz / 2,892 g) | $6.50 (from `$5–$8`) | $0.0023/g | 1 cup = 245 g · 1 tbsp = 15 g | MED | Restaurant Depot |
| Tahini | 16 oz jar (454 g) | $8.50 (from `$7–$10`) | $0.020/g | 1 cup = 256 g · 1 tbsp = 16 g | MED | Sam's (Member's Mark) |
| Tamari (gluten-free soy sauce) | 32 oz bottle (946 mL) | $12.00 (from `$10–$14`) | $0.011/mL | 1 cup = 288 g · 1 tbsp = 18 g | MED | Webstaurant / Whole Foods |
| Chili oil | 8 oz bottle (237 mL) | $7.50 (from `$5–$10`) | $0.030/mL | Treat as oil density | LOW | Asian market / RD |
| Crunchy peanut butter | 5 lb tub (2,268 g) | $12.00 (from `$10–$14`) | $0.0053/g | 1 cup = 270 g · 1 tbsp = 16 g | HIGH | Sam's / RD |
| Sesame seeds, white | 16 oz bag (454 g) | $5.50 (from `$4–$7`) | $0.011/g | 1 tbsp = 9 g · 1 tsp = 3 g | MED | Restaurant Depot / Asian market |

### Tea, Coffee & Drink Specialty (22)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| Coffee Mate Original powder | 56 oz canister (1,587 g) | $10.00 (from `$10.00`) | $0.0063/g | 1 cup = 95 g (calibrated 94 g) · 1 tbsp = 6 g | HIGH | Sam's Club |
| Espresso beans (whole) | 5 lb bag (2,268 g) | $57.50 (from `$45–$70`) | $0.024/g | 1 cup whole = 110 g · 1 cup ground = 80 g | LOW | Specialty roaster (LaMarzocco, Lavazza, local) |
| Matcha powder (Rishi) | 100 g tin | $38.00 (from `$38.00`) | $0.380/g | 1 tsp = 2 g (calibrated) · 1 tbsp = 6 g | HIGH | Rishi Tea / specialty |
| Lotus Biscoff cookie butter spread | 17.64 lb pail (8 kg) | $97.50 (from `$85–$110`) | $0.0117/g | 1 cup = 288 g · 1 tbsp = 18 g (~cookie butter density) | HIGH | Webstaurant |
| Lotus Biscoff crumb topping | 16.53 lb pail (7,500 g) | $70.00 (from `$60–$80`) | $0.0080/g | Volume-based; weigh for cost | MED | Webstaurant |
| Yuzu purée | 1 kg bottle (1,000 g) | $36.50 (from `$28–$45`) | $0.030/g | Pourable purée; 1 oz ≈ 30 g | LOW | The Perfect Purée / Boiron / Asian market |
| Mango purée (Simply Squeeze) | 60 oz bottle (1,701 g) | $27.00 (from `$22–$32`) | $0.016/g | Smoothie-grade purée | MED | Webstaurant / FoodserviceDirect |
| Mango popping boba (bursting pearls) | 7 lb tub (3,175 g) | $33.00 (from `$28–$38`) | $0.011/g | 1 tbsp ~12–14 g (count by tbsp) | MED | Bossen / Tea Zone (Webstaurant) |
| Wildberry purée | 1 L bottle | $22.50 (from `$15–$30`) | $0.020/mL | Pourable; treat as ~1 g/mL | LOW | Boiron / Monin |
| Lychee syrup (Torani/Monin) | 750 mL bottle | $11.00 (from `$9–$13`) | $0.014/mL | Sugar syrup ~1.3 g/mL | HIGH | Webstaurant / Amazon |
| Rose syrup (Monin) | 750 mL bottle | $12.50 (from `$10–$15`) | $0.016/mL | Sugar syrup ~1.3 g/mL | HIGH | Webstaurant |
| Mint mojito syrup | 750 mL bottle | $11.50 (from `$10–$13`) | $0.015/mL | Sugar syrup | HIGH | Webstaurant (Torani/Monin) |
| Grenadine | 1 L bottle | $10.00 (from `$8–$12`) | $0.010/mL | Sugar syrup | MED | Webstaurant / liquor store |
| Pink lemonade dominade powder | Specialty (~1 lb) | — (from `—`) | — | Powder mix; weigh once | QUOTE | NEEDS QUOTE |
| Old Soul taiyaki mix | 1.5 lb / 5 lb bag | $22.50 (from `$15–$30`) | estimated $0.013/g | Pancake-style mix; treat as flour | LOW | Old Soul (specialty Asian dessert distributor) |
| Sakura (cherry blossom) powder | 100 g bag | $35.00 (from `$25–$45`) | $0.30/g | Treat similar to matcha (1 tsp ~2 g) | LOW | Specialty Japanese grocer / Amazon |
| Butterfly pea tea (loose, dried) | 1 oz / 4 oz bag | $11.50 (from `$8–$15`) | $0.30–$0.50/g | Light, fluffy; 1 tsp ~0.5 g | MED | Specialty tea / Amazon |
| Loose leaf tea (assorted: hibiscus, golden yunnan, elderberry, orange blossom, kashmiri, karak) | 1 lb bag (varies by tea) | $37.50 (from `$15–$60/lb`) | varies $0.03–$0.13/g | 1.5 tbsp = 4–6 g (varies by leaf) | MED | Rishi / TeaSource / local tea shop |
| Honeycomb | 1 lb container | $28.50 (from `$22–$35`) | $0.060/g | Cut piece by weight | LOW | Specialty / Sam's seasonal |
| Cardamom pods (green) | 16 oz container (454 g) | $20.00 (from `$15–$25`) | $0.045/g | 1 pod ~0.3 g | MED | Indo/Pak market or Sam's spice aisle |
| Pistachios, shelled | 2 lb bag (907 g) | $23.00 (from `$18–$28`) | $0.024/g | 1 cup shelled = 120 g | MED | Sam's / Costco |
| Walnuts, halves | 3 lb bag (1,360 g) | $20.00 (from `$18–$22`) | $0.014/g | 1 cup = 128 g | HIGH | Sam's / Costco |

### Pasta, Bread & Carbs (6)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| Penne / fettuccine pasta (dry) | 20 lb case (9,072 g) | $21.00 (from `$18–$24`) | $0.0024/g | Weight-priced; 100 g serving standard | MED | Restaurant Depot |
| Cassava pasta | 12 oz pack (340 g) | $6.00 (from `$5–$7`) | $0.018/g | Weight-priced | MED | Whole Foods / Amazon (Jovial, Cappello's) |
| Pita chips | 12 ct case (Stacy's individual bags) | $18.50 (from `$15–$22`) | $0.10/g | Per chip / per bag | MED | Sam's (Stacy's) / RD |
| Croutons | 5 lb bag (2,268 g) | $12.50 (from `$10–$15`) | $0.0055/g | Per crouton ~1.5 g | MED | Restaurant Depot / Webstaurant |
| Sliced sandwich bread | Loaf (24 oz, ~24 slices) | $4.00 (from `$3–$5`) | $0.13–$0.21/slice | 1 slice ~28 g | HIGH | Sam's / Walmart |
| Hoagie / sub bread | 8-pack par-baked | $7.50 (from `$5–$10`) | $0.65–$1.25/roll | Per roll | MED | Sam's bakery / RD |

### Frozen, Branded & Prepared (17)

| Name | Pack size | Price (midpoint) | Per-unit | Density factor | Conf | Supplier |
|---|---|---|---|---|---|---|
| Just Bagels — Original (frozen) | 75 ct case (4.5 oz each) | $80.00 (from `$70–$90`) | $0.93–$1.20/bagel | 1 bagel = 128 g | HIGH | Webstaurant (Original Bagel Co.) |
| Just Bagels — Everything | 75 ct case (4.5 oz each) | $87.50 (from `$80–$95`) | $1.07–$1.27/bagel | 1 bagel = 128 g | HIGH | Webstaurant |
| Just Bagels — Jalapeño | Approx 75 ct case | $90.00 (from `$80–$100`) | $1.07–$1.33/bagel | 1 bagel = 128 g | MED | Specialty distributor |
| Bridor Perfect Croissant (2.8 oz) | 80/case (frozen, ready-to-bake) | $99.99 (from `$99.99`) | $1.25/croissant | Per piece (80 g raw) | HIGH | Webstaurant (SKU 108BRI59103) |
| Bridor Butter Chocolatine (chocolate croissant) | 60/case (2.82 oz each) | $84.99 (from `$84.99`) | $1.42/each | Per piece (80 g raw) | HIGH | Webstaurant |
| Bridor Spinach & Feta Bistro | 36/case (3.88 oz each) | $88.49 (from `$88.49`) | $2.46/each | Per piece (110 g raw) | HIGH | Webstaurant |
| Bridor Tomato & Olive Bistro | 36/case (3.88 oz each) | $92.99 (from `$92.99`) | $2.58/each | Per piece (110 g raw) | HIGH | Webstaurant |
| Bridor Peach Danish | 42/case (3.2 oz each) | $59.99 (from `$59.99`) | $1.43/each | Per piece (91 g raw) | HIGH | Webstaurant |
| Bridor Strawberry Cheesecake Danish | 84/case (3.5 oz each) | $126.49 (from `$126.49`) | $1.51/each | Per piece (99 g raw) | HIGH | Webstaurant |
| Bridor Apple Butter Danish | 60/case (3.99 oz each) | $108.99 (from `$108.99`) | $1.82/each | Per piece (113 g raw) | HIGH | Webstaurant |
| Frozen French fries (shoestring/regular cut) | 30 lb case (6 × 5 lb bags) | $34.00 (from `$28–$40`) | $0.0024/g | Weight-based | MED | Restaurant Depot (Lamb Weston) |
| Frozen chicken nuggets | 10 lb bag | $32.50 (from `$25–$40`) | $0.0066/g | Weight-based; ~16 g/nugget | MED | Sam's / RD (Tyson) |
| Gelato (foodservice tubs) | 3 gal tub × 6 flavors = 18 gal | $47.50 (from `$35–$60/tub`) | $0.012–$0.020/g | 1 cup ~190 g (varies by flavor) | LOW | Talenti / G.S. Gelato / local distributor |
| Mochi (frozen, 4 flavors) | Box ~24 ct (Bubbies/My/Mo) | $20.00 (from `$15–$25/box`) | $0.65–$1.05/each | 1 mochi ~30 g | MED | Costco / H Mart |
| Sparkling water (plain) | Case 24 × 12 oz cans (~8.5 L) | $11.50 (from `$8–$15/case`) | $0.0010–$0.0018/mL | Treat as water (~1 g/mL) | HIGH | Sam's / Costco |
| Semi-sweet chocolate chips | 25 lb bag (11,340 g) | $67.50 (from `$55–$80`) | $0.0060/g | 1 cup = 170 g · 1 tbsp = 10.6 g | MED | Webstaurant / Restaurant Depot |
| Marshmallows, large | 1 lb bag (~50 ct) | $3.00 (from `$2–$4`) | $0.04–$0.08/each | 1 large ~7 g | HIGH | Sam's / Walmart |

## Sub-recipes

### Club Sandwich Batter

| Qty | Unit | Ingredient |
|---|---|---|
| 0.5 | tsp | mustard |
| 1 | cup | mayo |
| 0.25 | tsp | black pepper |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Lemon Garlic Chicken Sauce

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | piece | lemon |
| 2 | tbsp | olive oil |
| 4 | piece | garlic clove |
| 3 | tbsp | honey |
| 0.25 | cup | water |
| 1 | tbsp | italian seasoning |
| 0.5 | tsp | red pepper |
| 0.25 | cup | parsley |
| 3 | tbsp | mayo |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Basil Pesto

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | cup | basil |
| 2 | tbsp | olive oil |
| 1 | tbsp | walnut |
| 1 | piece | garlic clove |
| 2 | tbsp | parmesan cheese shredded |
| 1 | tsp | salt |
| 0.25 | tsp | lemon juice |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Chicken Basil Pesto Sauce

| Qty | Unit | Ingredient |
|---|---|---|
| 4 | tbsp | Basil Pesto (sub-recipe) |
| 6 | tbsp | heavy cream |
| 1 | tbsp | water |
| 2 | tbsp | parmesan cheese shredded |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Simple Syrup

_PDF says '1:1 ratio sugar water' with no batch size; using 1 cup sugar + 1 cup water as the working batch (matches the original spec — yield ~355 ml)._

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | cup | granulated sugar |
| 1 | cup | water |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Mixed Milk

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | cup | water |
| 1 | cup | Coffee Mate Original powder |
| 1 | gallon | whole milk |
| 2 | cup | heavy cream |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Cold Foam

_50-serving batch per PDF; total volume sums to ~250 ml ⇒ ~5 ml/serving._

| Qty | Unit | Ingredient |
|---|---|---|
| 96 | g | heavy cream |
| 5 | fl_oz | maple syrup |
| 2 | tsp | vanilla extract |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Matcha Sauce

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | tbsp | matcha powder |
| 3 | tbsp | water |
| 2 | tbsp | Simple Syrup (sub-recipe) |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Biscoff Sauce

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | cup | heavy cream |
| 1 | cup | Lotus Biscoff cookie butter spread |
| 2 | fl_oz | Simple Syrup (sub-recipe) |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Butterfly Pea Tea

| Qty | Unit | Ingredient |
|---|---|---|
| 4 | fl_oz | water |
| 1 | tsp | butterfly pea tea |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Raspberry Compote

_First half of Raspberry Danish Latte — promoted because it reads as a discrete prep._

| Qty | Unit | Ingredient |
|---|---|---|
| 200 | g | raspberries |
| 160 | g | granulated sugar |
| 30 | g | water |
| 5 | g | vanilla extract |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

### Danish Cream Cheese Foam

_Second half of Raspberry Danish Latte; pinch of salt skipped per decision._

| Qty | Unit | Ingredient |
|---|---|---|
| 50 | g | heavy cream |
| 30 | g | cream cheese |
| 20 | g | whole milk |
| 12 | g | cane sugar |
| 1 | g | vanilla extract |

**Yield unit:** ml (computed from sum of inputs — exact ml shown in JSON pass)

## Menu items

### Club Sandwich

_PDF says '1 tbsp lemon' — interpreted as lemon juice. Lettuce qty unspecified; treating as 1 head (or use the leaf-count alternative I'll flag). Batter sub-recipe used 1×._

| Qty | Unit | Ingredient |
|---|---|---|
| 300 | g | chicken thigh |
| 0.25 | tsp | salt |
| 0.25 | tsp | black pepper |
| 0.25 | tsp | red pepper |
| 1 | tbsp | lemon juice |
| 1 | piece | Club Sandwich Batter (sub-recipe) |
| 3 | piece | sliced sandwich bread |
| 1 | piece | lettuce head |
| 1 | piece | egg |

**Yield:** 1 piece

### Egg Sandwich

| Qty | Unit | Ingredient |
|---|---|---|
| 3 | piece | egg |
| 0.5 | cup | mayo |
| 0.5 | tsp | black pepper |
| 0.125 | tsp | salt |
| 1 | piece | lettuce head |
| 2 | piece | sliced sandwich bread |

**Yield:** 1 piece

### Chipotle Chicken Sandwich

_Quick cucumber pickle is inline (not labeled as a section). 'Pinch of salt and pepper' skipped per decision._

| Qty | Unit | Ingredient |
|---|---|---|
| 300 | g | chicken thigh |
| 4 | piece | chipotle pepper in adobo |
| 2 | piece | garlic clove |
| 0.5 | piece | yellow onion |
| 4 | tbsp | mayo |
| 2 | tbsp | greek yogurt |
| 4 | tbsp | lemon juice |
| 0.5 | tbsp | paprika |
| 1 | tsp | cumin |
| 1 | tsp | garlic powder |
| 1 | piece | cucumber |
| 1 | tbsp | vinegar |
| 1 | tbsp | olive oil |
| 0.25 | tsp | garlic powder |
| 0.25 | tsp | onion powder |
| 1 | piece | hoagie bread |
| 1 | piece | colby jack cheese slice |
| 1 | piece | lettuce head |

**Yield:** 1 piece

### Lemon Garlic Chicken Sandwich

_Sauce promoted to sub-recipe. Pinch of S&P skipped. Sauce sub-recipe used 1× — quantity TBD by you (probably 2-4 tbsp per sandwich)._

| Qty | Unit | Ingredient |
|---|---|---|
| 300 | g | chicken thigh |
| 1 | tsp | paprika |
| 0.25 | tsp | salt |
| 0.5 | tbsp | garlic powder |
| 0.5 | tbsp | onion powder |
| 0.25 | tsp | black pepper |
| 2 | tbsp | lemon juice |
| 1 | piece | Lemon Garlic Chicken Sauce (sub-recipe) |
| 1 | piece | hoagie bread |
| 1 | piece | colby jack cheese slice |
| 1 | piece | cucumber |
| 1 | tbsp | vinegar |
| 1 | tbsp | olive oil |
| 0.25 | tsp | garlic powder |
| 0.25 | tsp | onion powder |
| 1 | piece | lettuce head |

**Yield:** 1 piece

### Breakfast Sandwich

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | piece | turkey ham slice |
| 1 | piece | Just Bagels — Original |
| 1 | piece | lettuce head |
| 1 | piece | cheddar cheese slice |
| 1 | piece | egg |

**Yield:** 1 piece

### Chicken Basil Pesto Pasta

_PDF: '2 chicken thighs (~113g) cut in cubes' and 'Salt & pepper to taste' (skipped). Sauce sub-recipe used once._

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | piece | chicken thigh |
| 1 | tsp | garlic powder |
| 1 | tbsp | olive oil |
| 1 | piece | Chicken Basil Pesto Sauce (sub-recipe) |
| 100 | g | penne pasta |

**Yield:** 1 piece

### Alfredo Pasta

_PDF says '¾ salt' with no unit — interpreting as ¾ tsp._

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | tbsp | butter |
| 1 | tbsp | all-purpose flour |
| 0.5 | tsp | black pepper |
| 0.75 | tsp | salt |
| 1 | cup | whole milk |
| 0.5 | cup | water |
| 100 | g | fettuccine pasta |

**Yield:** 1 piece

### Tuscan Pasta

_Recipe lists both fettuccine AND penne — looks like a copy-paste artifact in the source. Will flag._

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | tbsp | butter |
| 1 | tbsp | all-purpose flour |
| 0.5 | tsp | black pepper |
| 0.75 | tsp | salt |
| 1 | cup | whole milk |
| 0.5 | cup | water |
| 100 | g | fettuccine pasta |
| 4 | tbsp | parmesan cheese shredded |
| 3.5 | tbsp | sundried tomato |
| 1.5 | tbsp | tomato puree |
| 0.5 | cup | spinach |
| 1 | tbsp | olive oil |
| 113 | g | chicken thigh |
| 0.5 | tsp | lemon juice |
| 0.25 | tsp | salt |
| 0.25 | tsp | black pepper |
| 100 | g | penne pasta |

**Yield:** 1 piece

### Peanut Chili Noodles

| Qty | Unit | Ingredient |
|---|---|---|
| 4 | piece | spring onion |
| 200 | g | cassava pasta |
| 3 | piece | garlic clove |
| 2 | tbsp | crunchy peanut butter |
| 0.25 | cup | tahini |
| 2 | tbsp | tamari |
| 2 | tbsp | chili oil |
| 1 | tbsp | lemon juice |
| 5 | tbsp | water |
| 2 | tbsp | sesame seeds |
| 113 | g | chicken thigh |
| 0.25 | tsp | salt |
| 0.25 | tsp | black pepper |

**Yield:** 1 piece

### Fattoush Salad

_Recipe lists '8 fresh parsley pieces' and '8 leaves of fresh mint' — counted by piece._

| Qty | Unit | Ingredient |
|---|---|---|
| 0.5 | piece | lettuce head |
| 2 | piece | tomato |
| 2 | piece | cucumber |
| 4 | piece | radish |
| 0.5 | piece | yellow onion |
| 8 | piece | parsley sprig |
| 8 | piece | mint leaf |
| 6 | piece | pita chip |

**Yield:** 1 piece

### Caesar Salad

_PDF says '8-10 croutons' — using midpoint (9)._

| Qty | Unit | Ingredient |
|---|---|---|
| 0.5 | piece | lettuce head |
| 0.25 | cup | parmesan cheese shredded |
| 9 | piece | crouton |

**Yield:** 1 piece

### Funnel Cake

_'Oil for frying' line is a non-quantified prep amount — skipped per decision._

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | cup | all-purpose flour |
| 2 | tbsp | granulated sugar |
| 1 | tsp | baking powder |
| 0.5 | tsp | salt |
| 2 | piece | egg |
| 1.5 | cup | whole milk |
| 1 | tsp | vanilla extract |

**Yield:** 1 piece

### Soufflé

_PDF: '1/4 cup (30 g) cake flour' — both stated; using 30 g (more precise). 'Neutral oil, very small amount' skipped._

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | piece | egg yolk |
| 2 | piece | egg white |
| 2 | tbsp | whole milk |
| 0.25 | tsp | vanilla extract |
| 30 | g | cake flour |
| 0.25 | tsp | baking powder |
| 2 | tbsp | granulated sugar |
| 0.125 | tsp | cream of tartar |
| 0.5 | tsp | cornstarch |

**Yield:** 1 piece

### Taiyaki

_PDF says yield is '6-9 taiyaki' — using midpoint 7._

| Qty | Unit | Ingredient |
|---|---|---|
| 1.5 | cup | Old Soul taiyaki mix |
| 1 | cup | water |
| 3 | tbsp | butter |

**Yield:** 7 piece

### Raspberry Danish Latte

_'Ice' line skipped. Compote and foam are large prep-batches — qty per drink is TBD. Likely 1 latte uses a fraction of each batch; flag for you._

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | piece | Raspberry Compote (sub-recipe) |
| 1 | piece | Danish Cream Cheese Foam (sub-recipe) |
| 200 | g | Mixed Milk (sub-recipe) |
| 2 | piece | espresso shot |

**Yield:** 1 piece

### Creme Brulee Latte

_'1 can condensed milk' interpreted as one 14 oz can. 'Pinch of salt' skipped._

| Qty | Unit | Ingredient |
|---|---|---|
| 0.5 | cup | light brown sugar |
| 1 | cup | water |
| 1 | piece | sweetened condensed milk can |
| 1 | tbsp | vanilla extract |
| 150 | g | Mixed Milk (sub-recipe) |
| 30 | g | Cold Foam (sub-recipe) |
| 2 | piece | espresso shot |

**Yield:** 1 piece

### Biscoff Latte

_'Biscoff paste spread in glass', 'Top with biscoff crumbs' — these are non-quantified styling. Cold foam qty per drink TBD._

| Qty | Unit | Ingredient |
|---|---|---|
| 8 | tbsp | Biscoff Sauce (sub-recipe) |
| 1.5 | cup | Mixed Milk (sub-recipe) |
| 2 | piece | espresso shot |
| 1 | piece | Cold Foam (sub-recipe) |

**Yield:** 1 piece

### Sakura Matcha Latte

_'Sakura froth' described as 3 tbsp each of heavy cream + simple syrup + sakura powder — included inline._

| Qty | Unit | Ingredient |
|---|---|---|
| 3 | tbsp | Matcha Sauce (sub-recipe) |
| 1.25 | cup | Mixed Milk (sub-recipe) |
| 3 | tbsp | heavy cream |
| 3 | tbsp | Simple Syrup (sub-recipe) |
| 3 | tbsp | sakura powder |

**Yield:** 1 piece

### Matcha Latte

_PDF says '1.5 cup milk' (not Mixed Milk). 'Ice' and 'Top with dusting of matcha' skipped._

| Qty | Unit | Ingredient |
|---|---|---|
| 4 | tbsp | Matcha Sauce (sub-recipe) |
| 1.5 | cup | whole milk |

**Yield:** 1 piece

### Hot Chocolate

_'Whipped cream', 'Chocolate drizzle' decor lines — flagged. PDF says 'milk' not specifying type; assuming whole milk._

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | tbsp | semi-sweet chocolate chips |
| 1 | tbsp | light brown sugar |
| 8 | fl_oz | whole milk |
| 2 | piece | marshmallow |

**Yield:** 1 piece

### Butterfly Pea Lemonade — After the Storm

_Decor and ice skipped._

| Qty | Unit | Ingredient |
|---|---|---|
| 1 | cup | water |
| 4.5 | tbsp | pink lemonade dominade powder |
| 1 | fl_oz | yuzu purée |
| 1 | cup | sparkling water |
| 4 | fl_oz | Butterfly Pea Tea (sub-recipe) |

**Yield:** 1 piece

### Mango Popping Boba Soda

_Listed twice in source: 5 tbsp boba in mix + 1 extra tbsp on top. Combined as 2 input rows. Mint/flower decor skipped._

| Qty | Unit | Ingredient |
|---|---|---|
| 1.5 | fl_oz | mango purée |
| 5 | tbsp | mango popping boba |
| 1.5 | cup | sparkling water |
| 1 | tbsp | mango popping boba |

**Yield:** 1 piece

### Wildberry Soda

_'Top with smoke bubble' skipped. Source uses ambiguous units like '0.5 wildberry puree' — assumed fl oz._

| Qty | Unit | Ingredient |
|---|---|---|
| 0.5 | fl_oz | wildberry purée |
| 2 | tbsp | Simple Syrup (sub-recipe) |
| 1.5 | cup | sparkling water |
| 0.25 | fl_oz | lemon juice |
| 1 | fl_oz | grenadine |

**Yield:** 1 piece

### Rose Lychee Soda

_Source has 'OR' alternative version (yuzu/lychee/rose with sparkling water) — using primary version per the layout._

| Qty | Unit | Ingredient |
|---|---|---|
| 0.5 | fl_oz | lychee syrup |
| 1 | fl_oz | rose syrup |
| 0.75 | fl_oz | lemon juice |
| 1.5 | cup | sparkling water |
| 1 | fl_oz | Butterfly Pea Tea (sub-recipe) |

**Yield:** 1 piece

### Mint Mojito with Butterfly

_Mint/lemon decor skipped._

| Qty | Unit | Ingredient |
|---|---|---|
| 2 | fl_oz | mint mojito syrup |
| 0.75 | fl_oz | lemon juice |
| 1 | cup | sparkling water |
| 3 | fl_oz | Butterfly Pea Tea (sub-recipe) |

**Yield:** 1 piece

### Elderberry Healer

| Qty | Unit | Ingredient |
|---|---|---|
| 8 | fl_oz | water |
| 1.5 | tbsp | loose leaf tea |
| 0.5 | tbsp | honeycomb |

**Yield:** 1 piece

### Hibiscus Berry Tea

| Qty | Unit | Ingredient |
|---|---|---|
| 8 | fl_oz | water |
| 1.5 | tbsp | loose leaf tea |
| 0.5 | tbsp | honeycomb |

**Yield:** 1 piece

### Orange Blossom

| Qty | Unit | Ingredient |
|---|---|---|
| 8 | fl_oz | water |
| 1.5 | tbsp | loose leaf tea |
| 0.5 | tbsp | honeycomb |

**Yield:** 1 piece

### Golden Yunnan

| Qty | Unit | Ingredient |
|---|---|---|
| 8 | fl_oz | water |
| 1.5 | tbsp | loose leaf tea |
| 0.5 | tbsp | honeycomb |

**Yield:** 1 piece

### Kashmiri Chai

| Qty | Unit | Ingredient |
|---|---|---|
| 8 | fl_oz | water |
| 1.5 | tbsp | loose leaf tea |
| 1 | tsp | pistachio crushed |

**Yield:** 1 piece

### Karak Chai

| Qty | Unit | Ingredient |
|---|---|---|
| 8 | fl_oz | water |
| 1.5 | tbsp | loose leaf tea |
| 1 | piece | cardamom pod |

**Yield:** 1 piece
