/**
 * Market scraper + storage.
 *
 * Hits public catalog endpoints from foodservice / cafe wholesalers and
 * normalizes their products into a single shape. Stores results in
 * `market.json` next to `cafe-data.json`.
 *
 * Pure module — no side effects beyond writing market.json. Mounted into
 * the existing Express server in server.mjs without touching the cafe data
 * file.
 */

import fs from "node:fs/promises";
import path from "node:path";

// ────── sources ──────
// Public Shopify storefronts expose /products.json by default.
// We use these 5 as the seed set — proven to work.
export const SHOPIFY_SOURCES = [
  {
    id: "barista_underground",
    name: "Barista Underground",
    base_url: "https://www.baristaunderground.com",
    delay_ms: 2500,
  },
  {
    id: "westrock_coffee",
    name: "Westrock Coffee",
    base_url: "https://shop.westrockcoffee.com",
    delay_ms: 2500,
  },
  {
    id: "elmhurst_1925",
    name: "Elmhurst 1925",
    base_url: "https://www.elmhurst1925.com",
    delay_ms: 2500,
  },
  {
    id: "rishi_tea",
    name: "Rishi Tea & Botanicals",
    base_url: "https://rishi-tea.com",
    delay_ms: 2500,
  },
  {
    id: "monin",
    name: "Monin",
    base_url: "https://www.monin.com",
    delay_ms: 2500,
  },
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.5",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Best-effort extraction of pack quantity from a Shopify variant title. */
function parsePackSize(text) {
  if (!text) return { count: 1, raw: "" };
  const t = text.toLowerCase();
  const out = { count: 1, raw: text, oz: null, ml: null, g: null, count_pack: 1 };

  // "32 fl oz" / "32 oz" / "1 gallon" / "5 lb" / "750 ml" / "1 L"
  const flOz = t.match(/(\d+(?:\.\d+)?)\s*fl\.?\s*oz/);
  if (flOz) {
    out.ml = parseFloat(flOz[1]) * 29.5735;
    out.oz = parseFloat(flOz[1]);
  } else {
    const oz = t.match(/(\d+(?:\.\d+)?)\s*oz\b/);
    if (oz && !t.includes("fl")) {
      out.g = parseFloat(oz[1]) * 28.3495;
      out.oz = parseFloat(oz[1]);
    }
  }
  const lb = t.match(/(\d+(?:\.\d+)?)\s*lb\b/);
  if (lb) out.g = (out.g ?? 0) + parseFloat(lb[1]) * 453.592;

  const gMatch = t.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gMatch && !lb) out.g = parseFloat(gMatch[1]);

  const kg = t.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kg) out.g = parseFloat(kg[1]) * 1000;

  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (ml && !flOz) out.ml = parseFloat(ml[1]);
  const l = t.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if (l && !ml) out.ml = parseFloat(l[1]) * 1000;

  const gal = t.match(/(\d+(?:\.\d+)?)\s*gal/);
  if (gal) out.ml = (out.ml ?? 0) + parseFloat(gal[1]) * 3785.41;

  // pack count: "12 pack", "case of 24", "24 ct", "(12 cartons)"
  const packMatch =
    t.match(/(\d+)\s*-?\s*pack/) ||
    t.match(/case\s*of\s*(\d+)/) ||
    t.match(/(\d+)\s*ct\b/) ||
    t.match(/\((\d+)\s*(?:cartons?|total|units?|bottles?|cans?)\)/);
  if (packMatch) out.count_pack = parseInt(packMatch[1], 10);
  out.count = out.count_pack;

  if (out.ml != null) out.ml *= out.count_pack;
  if (out.g != null) out.g *= out.count_pack;

  return out;
}

/** Normalize one Shopify variant into our market product shape. */
function normalizeProduct(source, product, variant) {
  const price = parseFloat(variant.price);
  const cmpRaw = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
  const compare = cmpRaw && cmpRaw > price ? cmpRaw : null;
  const pack = parsePackSize(variant.title || product.title);
  const url = `${source.base_url}/products/${product.handle}`;
  const oz = pack.oz != null ? pack.oz * pack.count_pack : null;
  const ml = pack.ml ?? null;
  const g = pack.g ?? null;
  const per_g = g && g > 0 ? price / g : null;
  const per_ml = ml && ml > 0 ? price / ml : null;
  return {
    id: `${source.id}_${product.id}_${variant.id}`,
    source_id: source.id,
    source_name: source.name,
    title: product.title,
    vendor: product.vendor || null,
    product_type: product.product_type || null,
    handle: product.handle,
    url,
    variant_title: variant.title || null,
    pack_size_text: variant.title || "",
    price,
    compare_at_price: compare,
    on_sale: !!compare,
    discount_pct: compare ? Math.round(((compare - price) / compare) * 100) : 0,
    available: variant.available !== false,
    pack: { count: pack.count, oz, ml, g },
    per_g,
    per_ml,
    per_oz: oz && oz > 0 ? price / oz : null,
    fetched_at: new Date().toISOString(),
  };
}

async function scrapeShopifyOne(source) {
  const products = [];
  let page = 1;
  let pages = 0;
  const maxPages = 8; // safety stop
  while (page <= maxPages) {
    const url = `${source.base_url}/products.json?limit=250&page=${page}`;
    const data = await fetchJson(url, { timeoutMs: 15000 });
    const list = data?.products || [];
    if (list.length === 0) break;
    for (const product of list) {
      for (const variant of product.variants || []) {
        try {
          products.push(normalizeProduct(source, product, variant));
        } catch {}
      }
    }
    pages = page;
    if (list.length < 250) break;
    page++;
    await sleep(source.delay_ms);
  }
  return { products, pages };
}

export async function scrapeAllShopify({ onProgress } = {}) {
  const all = [];
  const errors = [];
  const sourceStats = [];
  for (const source of SHOPIFY_SOURCES) {
    onProgress?.({ phase: "start", source: source.name });
    try {
      const { products, pages } = await scrapeShopifyOne(source);
      all.push(...products);
      sourceStats.push({ id: source.id, name: source.name, products: products.length, pages, ok: true });
      onProgress?.({ phase: "done", source: source.name, count: products.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ source: source.id, error: msg });
      sourceStats.push({ id: source.id, name: source.name, products: 0, pages: 0, ok: false, error: msg });
      onProgress?.({ phase: "error", source: source.name, error: msg });
    }
    await sleep(800);
  }
  return { products: all, errors, sources: sourceStats };
}

// ────── ingredient matching ──────

const STOPWORDS = new Set([
  "the", "and", "or", "of", "with", "for", "to", "fresh", "organic", "natural",
  "premium", "pure", "100", "10", "20", "30", "40", "50", "100g", "16oz",
  "1lb", "5lb", "1gal",
]);

function tokens(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !STOPWORDS.has(w));
}

function tokenSet(s) {
  return new Set(tokens(s));
}

/** Score how much an ingredient name matches a market product. 0-1. */
function matchScore(ingredientName, product) {
  const ing = tokenSet(ingredientName);
  const prod = tokenSet(`${product.title} ${product.vendor ?? ""} ${product.variant_title ?? ""}`);
  if (ing.size === 0 || prod.size === 0) return 0;
  let overlap = 0;
  for (const t of ing) if (prod.has(t)) overlap++;
  // require at least 1 strong word in common to count
  if (overlap === 0) return 0;
  return overlap / ing.size;
}

/** For each user ingredient, find candidate market products. */
export function buildIngredientMatches(ingredients, products) {
  const matches = [];
  for (const ing of ingredients) {
    const candidates = [];
    for (const p of products) {
      const score = matchScore(ing.name, p);
      if (score < 0.4) continue; // require at least 40% token overlap
      const baseUnit = ing.base_unit; // "g" | "ml" | "piece"
      let estimated_per_base = null;
      if (baseUnit === "g" && p.per_g != null) estimated_per_base = p.per_g;
      else if (baseUnit === "ml" && p.per_ml != null) estimated_per_base = p.per_ml;
      else if (baseUnit === "g" && p.per_ml != null) estimated_per_base = p.per_ml; // close-enough proxy for liquids weighed
      const her_per_base = ing.cost_per_base_unit || 0;
      const delta_pct =
        estimated_per_base != null && her_per_base > 0
          ? ((estimated_per_base - her_per_base) / her_per_base) * 100
          : null;
      candidates.push({
        product_id: p.id,
        score,
        confidence: score >= 0.75 ? "high" : score >= 0.55 ? "medium" : "low",
        estimated_per_base_unit: estimated_per_base,
        delta_pct,
      });
    }
    candidates.sort((a, b) => {
      // cheaper first (when comparable), else higher confidence
      const ap = a.estimated_per_base_unit ?? Infinity;
      const bp = b.estimated_per_base_unit ?? Infinity;
      if (ap !== bp) return ap - bp;
      return b.score - a.score;
    });
    matches.push({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      base_unit: ing.base_unit,
      her_per_base: ing.cost_per_base_unit,
      candidates: candidates.slice(0, 8),
    });
  }
  return matches;
}

// ────── storage ──────

const DEFAULT_SNAPSHOT = {
  fetched_at: null,
  products: [],
  sources: [],
  errors: [],
  matches: [],
};

export async function readMarket(marketFile) {
  try {
    const raw = await fs.readFile(marketFile, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return { ...DEFAULT_SNAPSHOT };
    throw err;
  }
}

export async function writeMarket(marketFile, snapshot) {
  await fs.mkdir(path.dirname(marketFile), { recursive: true });
  const tmp = `${marketFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  await fs.rename(tmp, marketFile);
}

/**
 * Run a full market refresh: scrape all sources, build matches against the
 * cafe data ingredients, write market.json.
 */
export async function refreshMarket({ marketFile, ingredients, onProgress }) {
  const { products, errors, sources } = await scrapeAllShopify({ onProgress });
  const matches = buildIngredientMatches(ingredients ?? [], products);
  const snapshot = {
    fetched_at: new Date().toISOString(),
    products,
    sources,
    errors,
    matches,
  };
  await writeMarket(marketFile, snapshot);
  return snapshot;
}
