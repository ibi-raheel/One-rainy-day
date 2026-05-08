import libraryRaw from "../data/density-library.json";
import type { BaseUnit, DensityFactor, Unit } from "./units";

export interface LibraryEntry {
  name: string;
  aliases: string[];
  suggested_base: BaseUnit;
  density_factors: { from_unit: Unit; base_unit_amount: number }[];
}

interface LibraryFile {
  version: number;
  source_note: string;
  entries: LibraryEntry[];
}

const LIBRARY = libraryRaw as LibraryFile;

export const DENSITY_LIBRARY: readonly LibraryEntry[] = LIBRARY.entries;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const cleanedNames: { entry: LibraryEntry; tokens: string[] }[] = LIBRARY.entries.map((entry) => ({
  entry,
  tokens: [normalize(entry.name), ...entry.aliases.map(normalize)].filter(Boolean),
}));

/** Tiny fuzzy: exact > startsWith > word-overlap score. Returns up to `limit` candidates. */
export function searchLibrary(query: string, limit = 6): LibraryEntry[] {
  const q = normalize(query);
  if (!q) return [];

  type Scored = { entry: LibraryEntry; score: number };
  const scored: Scored[] = [];

  for (const { entry, tokens } of cleanedNames) {
    let best = 0;
    for (const t of tokens) {
      if (t === q) {
        best = Math.max(best, 1000);
        continue;
      }
      if (t.startsWith(q)) {
        best = Math.max(best, 500 - (t.length - q.length));
        continue;
      }
      if (t.includes(q)) {
        best = Math.max(best, 300 - (t.length - q.length));
        continue;
      }
      // word-overlap
      const qWords = q.split(" ");
      const tWords = t.split(" ");
      const overlap = qWords.filter((w) => tWords.includes(w)).length;
      if (overlap > 0) {
        best = Math.max(best, 100 + overlap * 10 - Math.abs(qWords.length - tWords.length));
      }
    }
    if (best > 0) scored.push({ entry, score: best });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}

/** Returns the single best library entry above a confidence threshold, or null. */
export function bestMatch(query: string): LibraryEntry | null {
  const top = searchLibrary(query, 1);
  if (top.length === 0) return null;
  // Re-score: only return if very confident.
  const q = normalize(query);
  const tokens = [normalize(top[0].name), ...top[0].aliases.map(normalize)];
  const isStrong = tokens.some((t) => t === q || t.startsWith(q) || q.startsWith(t));
  return isStrong ? top[0] : null;
}

/** Convert a library entry's factors into the user's chosen base, if possible. Right now we trust the suggested_base — if it doesn't match, we drop the factors and let the user define their own. */
export function libraryFactorsForBase(
  entry: LibraryEntry,
  chosenBase: BaseUnit
): DensityFactor[] {
  if (entry.suggested_base !== chosenBase) return [];
  return entry.density_factors.map((f) => ({
    from_unit: f.from_unit,
    base_unit_amount: f.base_unit_amount,
    source: "library" as const,
  }));
}
