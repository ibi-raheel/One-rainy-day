/**
 * Cafe — local server.
 *
 * Persists ingredients, recipes, and settings to cafe-data.json on disk.
 * Serves the built React app at / and a small REST API at /api/*.
 *
 * Run:
 *   npm run build        # produce dist/
 *   node server.mjs      # listens on :4174
 *
 * Or all at once:
 *   npm run start
 *
 * Then expose to the world with:
 *   ngrok http 4174
 */

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { readMarket, writeMarket, refreshMarket, SHOPIFY_SOURCES } from "./server/market.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4174;
const DATA_FILE = process.env.CAFE_DATA_FILE || path.join(__dirname, "cafe-data.json");
const MARKET_FILE = process.env.CAFE_MARKET_FILE || path.join(__dirname, "market.json");
const BACKUP_DIR = process.env.CAFE_BACKUP_DIR || path.join(__dirname, "backups");
const BACKUP_KEEP_DAYS = Number(process.env.CAFE_BACKUP_KEEP_DAYS || 14);
const DIST_DIR = path.join(__dirname, "dist");

const DEFAULT_STATE = {
  version: 1,
  ingredients: [],
  recipes: [],
  suppliers: [],
  settings: { id: "singleton", period_label: "per day" },
};

// ───────────────── Storage layer (JSON file with atomic writes) ─────────────────

let cache = null;
let writePromise = Promise.resolve();

async function readState() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    // Migrations: tolerate older shapes
    cache = {
      version: parsed.version ?? 1,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
      settings: parsed.settings && typeof parsed.settings === "object"
        ? { id: "singleton", period_label: "per day", ...parsed.settings }
        : { ...DEFAULT_STATE.settings },
    };
  } catch (err) {
    if (err.code === "ENOENT") {
      cache = structuredClone(DEFAULT_STATE);
      await writeState(cache);
    } else if (err instanceof SyntaxError) {
      // Corrupt file — back it up and start fresh
      const backup = `${DATA_FILE}.corrupt-${Date.now()}`;
      await fs.copyFile(DATA_FILE, backup).catch(() => {});
      console.error(`[cafe] Corrupt data file. Backed up to ${backup}, starting fresh.`);
      cache = structuredClone(DEFAULT_STATE);
      await writeState(cache);
    } else {
      throw err;
    }
  }
  return cache;
}

async function writeState(state, writerId = null) {
  cache = state;
  // Serialize atomic writes so concurrent requests don't trample each other
  writePromise = writePromise.then(async () => {
    const tmp = `${DATA_FILE}.tmp`;
    const json = JSON.stringify(state, null, 2);
    await fs.writeFile(tmp, json, "utf8");
    await fs.rename(tmp, DATA_FILE);
    await maybeBackup(state).catch((err) => console.error("[cafe] backup failed:", err));
    broadcastChange(writerId);
  });
  return writePromise;
}

// ───────────────── Server-Sent Events for live cross-client updates ─────────────────

const sseClients = new Set();

function broadcastChange(writerId) {
  const payload = `event: state-changed\ndata: ${JSON.stringify({ writerId, at: new Date().toISOString() })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

let lastBackupDate = null; // YYYY-MM-DD
async function maybeBackup(state) {
  const today = new Date().toISOString().slice(0, 10);
  if (lastBackupDate === today) return;
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const dest = path.join(BACKUP_DIR, `cafe-data-${today}.json`);
  // Skip if today's backup already exists (e.g. server restart mid-day)
  try {
    await fs.access(dest);
    lastBackupDate = today;
    return;
  } catch {}
  await fs.writeFile(dest, JSON.stringify(state, null, 2), "utf8");
  lastBackupDate = today;
  console.log(`[cafe] daily backup → ${dest}`);
  await pruneOldBackups();
}

async function pruneOldBackups() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const dated = files
      .filter((f) => /^cafe-data-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    const toDelete = dated.slice(0, Math.max(0, dated.length - BACKUP_KEEP_DAYS));
    for (const f of toDelete) {
      await fs.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }
  } catch {}
}

// ───────────────── HTTP API ─────────────────

const app = express();
app.use(express.json({ limit: "10mb" }));

// CORS — allow any origin (ngrok URLs change, plus this app runs on a
// trusted laptop with no cross-site auth concerns)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Full-state hydration (called on app load)
app.get("/api/state", async (_req, res, next) => {
  try {
    const state = await readState();
    res.json(state);
  } catch (e) { next(e); }
});

// Replace entire state — used by the Import button
app.put("/api/state", async (req, res, next) => {
  try {
    const body = req.body || {};
    const next_state = {
      version: 1,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
      recipes: Array.isArray(body.recipes) ? body.recipes : [],
      suppliers: Array.isArray(body.suppliers) ? body.suppliers : [],
      settings: body.settings && typeof body.settings === "object"
        ? { id: "singleton", period_label: "per day", ...body.settings }
        : (Array.isArray(body.settings) && body.settings[0]) || { ...DEFAULT_STATE.settings },
    };
    await writeState(next_state, req.headers["x-client-id"] || null);
    res.json(next_state);
  } catch (e) { next(e); }
});

// Ingredients
app.put("/api/ingredients/:id", async (req, res, next) => {
  try {
    const state = await readState();
    const incoming = { ...req.body, id: req.params.id };
    const idx = state.ingredients.findIndex((i) => i.id === incoming.id);
    if (idx >= 0) state.ingredients[idx] = incoming;
    else state.ingredients.push(incoming);
    await writeState(state, req.headers["x-client-id"] || null);
    res.json(incoming);
  } catch (e) { next(e); }
});

app.delete("/api/ingredients/:id", async (req, res, next) => {
  try {
    const state = await readState();
    state.ingredients = state.ingredients.filter((i) => i.id !== req.params.id);
    await writeState(state, req.headers["x-client-id"] || null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Recipes
app.put("/api/recipes/:id", async (req, res, next) => {
  try {
    const state = await readState();
    const incoming = { ...req.body, id: req.params.id };
    const idx = state.recipes.findIndex((r) => r.id === incoming.id);
    if (idx >= 0) state.recipes[idx] = incoming;
    else state.recipes.push(incoming);
    await writeState(state, req.headers["x-client-id"] || null);
    res.json(incoming);
  } catch (e) { next(e); }
});

app.delete("/api/recipes/:id", async (req, res, next) => {
  try {
    const state = await readState();
    state.recipes = state.recipes.filter((r) => r.id !== req.params.id);
    await writeState(state, req.headers["x-client-id"] || null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Suppliers (custom records, separate from vendor strings on ingredients)
app.put("/api/suppliers/:id", async (req, res, next) => {
  try {
    const state = await readState();
    if (!Array.isArray(state.suppliers)) state.suppliers = [];
    const incoming = { ...req.body, id: req.params.id };
    const idx = state.suppliers.findIndex((s) => s.id === incoming.id);
    if (idx >= 0) state.suppliers[idx] = incoming;
    else state.suppliers.push(incoming);
    await writeState(state, req.headers["x-client-id"] || null);
    res.json(incoming);
  } catch (e) { next(e); }
});

app.delete("/api/suppliers/:id", async (req, res, next) => {
  try {
    const state = await readState();
    if (!Array.isArray(state.suppliers)) state.suppliers = [];
    state.suppliers = state.suppliers.filter((s) => s.id !== req.params.id);
    await writeState(state, req.headers["x-client-id"] || null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Settings (single record)
app.put("/api/settings", async (req, res, next) => {
  try {
    const state = await readState();
    state.settings = { id: "singleton", period_label: "per day", ...(req.body || {}) };
    await writeState(state, req.headers["x-client-id"] || null);
    res.json(state.settings);
  } catch (e) { next(e); }
});

// SSE endpoint — clients subscribe here to hear about state changes
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write(`: connected ${new Date().toISOString()}\n\n`);
  sseClients.add(res);
  // Heartbeat every 25s to keep proxies (ngrok, nginx) from killing the connection
  const hb = setInterval(() => {
    try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch {}
  }, 25000);
  req.on("close", () => {
    clearInterval(hb);
    sseClients.delete(res);
  });
});

// ───────────────── Market (price intelligence) ─────────────────

let marketRefreshing = false;

app.get("/api/market", async (_req, res, next) => {
  try {
    const snap = await readMarket(MARKET_FILE);
    res.json({ ...snap, sources_available: SHOPIFY_SOURCES.map(s => ({ id: s.id, name: s.name })) });
  } catch (e) { next(e); }
});

app.post("/api/market/refresh", async (_req, res, next) => {
  if (marketRefreshing) {
    return res.status(409).json({ error: "Refresh already in progress" });
  }
  marketRefreshing = true;
  try {
    const state = await readState();
    const snap = await refreshMarket({
      marketFile: MARKET_FILE,
      ingredients: state.ingredients ?? [],
      onProgress: (p) => console.log("[market]", p),
    });
    res.json({
      fetched_at: snap.fetched_at,
      products: snap.products.length,
      sources: snap.sources,
      errors: snap.errors,
      matches: snap.matches.length,
    });
  } catch (e) {
    next(e);
  } finally {
    marketRefreshing = false;
  }
});

app.get("/api/health", async (_req, res) => {
  const state = await readState().catch(() => null);
  res.json({
    ok: true,
    data_file: DATA_FILE,
    counts: state
      ? { ingredients: state.ingredients.length, recipes: state.recipes.length }
      : null,
  });
});

// ───────────────── Static React app (production build) ─────────────────

app.use(express.static(DIST_DIR, { index: "index.html", maxAge: "1h" }));

// SPA fallback — serve index.html for unknown routes (the app currently has
// no client-side router, but this is harmless and future-proofs it)
app.use(async (req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  try {
    const html = await fs.readFile(path.join(DIST_DIR, "index.html"), "utf8");
    res.type("html").send(html);
  } catch (e) {
    if (e.code === "ENOENT") {
      res.status(503).type("text").send(
        "dist/ not built yet. Run: npm run build\n\n" +
        "Or use: npm run start (build + serve in one shot)\n"
      );
    } else next(e);
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[cafe]", err);
  res.status(500).json({ error: String(err && err.message || err) });
});

// ───────────────── Bind ─────────────────

const server = app.listen(PORT, () => {
  const ifaces = os.networkInterfaces();
  const lans = [];
  for (const list of Object.values(ifaces)) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal) lans.push(i.address);
    }
  }
  console.log(`\n  Café — cost & recipe management`);
  console.log(`  ────────────────────────────────`);
  console.log(`  Local:    http://localhost:${PORT}`);
  for (const ip of lans) {
    console.log(`  Network:  http://${ip}:${PORT}`);
  }
  console.log(`  Data:     ${DATA_FILE}`);
  console.log(`\n  To expose online:  ngrok http ${PORT}\n`);
});

// Graceful shutdown — flush pending writes before exiting
async function shutdown(signal) {
  console.log(`\n[cafe] ${signal} received, flushing data...`);
  await writePromise.catch(() => {});
  server.close(() => process.exit(0));
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
