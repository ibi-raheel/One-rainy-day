/**
 * HTTP client for the local Cafe server.
 *
 * Replaces the Dexie/IndexedDB storage layer. Same shape as before from the
 * store's perspective: load full state once on mount, then upsert/delete via
 * the API as the user makes changes.
 *
 * The base URL is empty (same-origin) — works for both:
 *   - localhost:4174 served by server.mjs in production mode
 *   - localhost:5173 dev mode, where Vite proxies /api/* to localhost:4174
 *   - any ngrok URL pointing at the local server
 */

import type { Ingredient, Recipe, AppSettings, Supplier, StockItem, PrepItem } from "./types";

export interface ServerState {
  version: number;
  ingredients: Ingredient[];
  recipes: Recipe[];
  suppliers?: Supplier[];
  stockItems?: StockItem[];
  prepItems?: PrepItem[];
  settings: AppSettings;
}

const BASE = ""; // same-origin

/** Stable per-tab id so we can tell our own SSE echoes apart from others' edits. */
export const CLIENT_ID = (() => {
  // crypto.randomUUID is in modern browsers; fall back if not
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) + "_" + Date.now();
})();

async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "X-Client-Id": CLIENT_ID };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status} on ${method} ${url}`;
    try {
      const data = await res.json();
      if (data?.error) msg += `: ${data.error}`;
    } catch {}
    throw new Error(msg);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  loadState(): Promise<ServerState> {
    return http("GET", "/api/state");
  },

  replaceState(state: { ingredients: Ingredient[]; recipes: Recipe[]; suppliers?: Supplier[]; stockItems?: StockItem[]; settings: AppSettings | AppSettings[] }) {
    return http<ServerState>("PUT", "/api/state", state);
  },

  putIngredient(ing: Ingredient): Promise<Ingredient> {
    return http("PUT", `/api/ingredients/${encodeURIComponent(ing.id)}`, ing);
  },

  deleteIngredient(id: string): Promise<{ ok: true }> {
    return http("DELETE", `/api/ingredients/${encodeURIComponent(id)}`);
  },

  putRecipe(r: Recipe): Promise<Recipe> {
    return http("PUT", `/api/recipes/${encodeURIComponent(r.id)}`, r);
  },

  deleteRecipe(id: string): Promise<{ ok: true }> {
    return http("DELETE", `/api/recipes/${encodeURIComponent(id)}`);
  },

  putSettings(settings: AppSettings): Promise<AppSettings> {
    return http("PUT", "/api/settings", settings);
  },

  putSupplier(s: Supplier): Promise<Supplier> {
    return http("PUT", `/api/suppliers/${encodeURIComponent(s.id)}`, s);
  },

  deleteSupplier(id: string): Promise<{ ok: true }> {
    return http("DELETE", `/api/suppliers/${encodeURIComponent(id)}`);
  },

  putStockItem(s: StockItem): Promise<StockItem> {
    return http("PUT", `/api/stock-items/${encodeURIComponent(s.id)}`, s);
  },

  deleteStockItem(id: string): Promise<{ ok: true }> {
    return http("DELETE", `/api/stock-items/${encodeURIComponent(id)}`);
  },

  putPrepItem(p: PrepItem): Promise<PrepItem> {
    return http("PUT", `/api/prep-items/${encodeURIComponent(p.id)}`, p);
  },

  deletePrepItem(id: string): Promise<{ ok: true }> {
    return http("DELETE", `/api/prep-items/${encodeURIComponent(id)}`);
  },

  loadMarket(): Promise<any> {
    return http("GET", "/api/market");
  },

  refreshMarket(): Promise<any> {
    return http("POST", "/api/market/refresh");
  },

  /**
   * Subscribe to server-sent change events. Calls `onRemoteChange` whenever
   * another client writes (skips events originated by this tab).
   * Returns an unsubscribe function.
   */
  subscribeToChanges(onRemoteChange: () => void): () => void {
    let stopped = false;
    let es: EventSource | null = null;
    let retryHandle: number | null = null;

    const open = () => {
      if (stopped) return;
      try {
        es = new EventSource("/api/events");
      } catch {
        retry();
        return;
      }
      es.addEventListener("state-changed", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          if (data.writerId && data.writerId === CLIENT_ID) return; // own echo
        } catch {}
        onRemoteChange();
      });
      es.onerror = () => {
        es?.close();
        es = null;
        retry();
      };
    };

    const retry = () => {
      if (stopped) return;
      retryHandle = window.setTimeout(open, 2000);
    };

    open();
    return () => {
      stopped = true;
      if (retryHandle != null) window.clearTimeout(retryHandle);
      es?.close();
    };
  },
};
