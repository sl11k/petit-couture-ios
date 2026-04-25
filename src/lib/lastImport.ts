/**
 * Hand-off store for the most recent wishlist share import.
 *
 * The share route writes the freshly-added IDs here right before redirecting
 * to /wishlist; the wishlist screen reads them on mount, displays an "Undo
 * import" affordance, and clears the slot so the affordance never reappears
 * on a subsequent visit (e.g. back/forward navigation).
 */

const KEY = "maisonnet:wishlist:last-import:v1";

export type LastImport = {
  ids: string[];
  ts: number;
};

export function setLastImport(ids: string[]): void {
  if (typeof sessionStorage === "undefined") return;
  if (ids.length === 0) {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ids, ts: Date.now() }));
  } catch {
    /* quota or privacy mode — ignore */
  }
}

export function readLastImport(): LastImport | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.ids) ||
      typeof parsed.ts !== "number"
    ) {
      return null;
    }
    const ids = parsed.ids.filter((v: unknown): v is string => typeof v === "string");
    return ids.length > 0 ? { ids, ts: parsed.ts } : null;
  } catch {
    return null;
  }
}

export function clearLastImport(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
