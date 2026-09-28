<div align="center">

# One Rainy Day — Cost & Recipe Manager

**Ingredients, nested sub-recipes and live cost-per-serving for a working café.**

<p>
</p>

<p>
<img alt="React" src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=white">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
<img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white">
<img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white">
<img alt="Express" src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white">
<img alt="Vitest" src="https://img.shields.io/badge/Vitest-646CFF?style=flat-square&logo=vite&logoColor=white">
</p>

</div>

<br>

> **Cost per serving, recalculated the moment an ingredient price moves**  
> for One Rainy Day, a café pricing its menu

## What it did

Ingredients carry a cost per base unit; recipes declare a yield; a sub-recipe becomes an input with its own cost-per-yield. Cross-unit conversions (tablespoons of matcha to grams) use per-ingredient densities pre-filled from a 230-entry library. One JSON file on the owner's laptop, served over the LAN.

## Run it locally

```sh
npm install
npm run start         # builds the React app, then starts the server on :4174
```

Open `http://localhost:4174`. To stop, `Ctrl+C` in the terminal.

## Run it online (share with someone)

In one terminal:

```sh
npm run start         # http://localhost:4174
```

In another terminal:

```sh
ngrok http 4174
```

ngrok prints an `https://…ngrok-free.app` URL. Send that to whoever needs access. Anyone hitting it talks to **your** laptop — every change writes to `cafe-data.json` on **your** disk. When your laptop sleeps or you stop the server, the link goes dark; the data stays.

## Develop the React app

```sh
npm run server        # terminal 1: API on :4174
npm run dev           # terminal 2: Vite dev server on :5173 with HMR
```

Vite proxies `/api/*` calls to the API server, so the front end behaves identically in dev and prod.

## Tests

```sh
npm test              # 35 unit-conversion tests
```

## Files

- `cafe-data.json` — your data. Backup-friendly: just copy this file. Human-readable JSON.
- `server.mjs` — tiny Express server. Atomic JSON writes, CORS open, listens on `:4174`.
- `src/db/api.ts` — HTTP client used by the front end (replaces the old IndexedDB layer).
- `src/store/app.ts` — Zustand store with optimistic updates.

## How it works

Ingredients store an internal `cost_per_base_unit` (per gram, per ml, or per piece). Recipes declare a yield. A sub-recipe with a yield can be used as an input to other recipes — its cost-per-yield-unit becomes its effective price. Cross-class conversions (e.g. tablespoons of matcha → grams) use density factors stored on each ingredient or sub-recipe; common ingredients pre-fill from a 230-entry density library.

## Backup

The Dashboard's **Export** button downloads a JSON snapshot. **Import** uploads one and replaces all current data on the server. To migrate to a new computer: copy `cafe-data.json` to the new project folder before first run.

---

<div align="center">

<sub>Built by <a href="https://github.com/ibi-raheel">Muhammad Ibrahim Raheel</a> · more work at <a href="https://ibiraheel.com">ibiraheel.com</a></sub>

</div>
