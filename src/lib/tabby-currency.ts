/**
 * Tabby settlement-currency helpers.
 *
 * Store prices are authored in SAR, but a Tabby merchant account is bound to a
 * single settlement currency (ours is AED). Gulf currencies are USD-pegged, so
 * the conversion below is deterministic: the checkout call and the webhook both
 * derive the exact same figures without needing a live FX lookup.
 */

/** Fixed units per 1 USD (official pegs / stable central-bank rates). */
const UNITS_PER_USD: Record<string, number> = {
  USD: 1,
  SAR: 3.75,
  AED: 3.6725,
  QAR: 3.64,
  BHD: 0.376,
  OMR: 0.3845,
  KWD: 0.3065,
};

export const TABBY_MERCHANT_CODES: Record<string, string> = {
  SAR: "sa",
  AED: "ae",
  KWD: "kw",
  BHD: "bh",
  QAR: "qa",
};

export function isConvertibleCurrency(code: string) {
  return Boolean(UNITS_PER_USD[code.toUpperCase()]);
}

/** Convert an amount between two pegged currencies, rounded to 2 decimals. */
export function convertPegged(amount: number, from: string, to: string): number {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  if (source === target) return Math.round(amount * 100) / 100;
  const fromRate = UNITS_PER_USD[source];
  const toRate = UNITS_PER_USD[target];
  if (!fromRate || !toRate) {
    throw new Error(`Unsupported currency conversion ${source} → ${target}`);
  }
  return Math.round(((amount / fromRate) * toRate + Number.EPSILON) * 100) / 100;
}

/**
 * Tabby answers an unsupported currency with:
 * "could not create payment: only 'AED' is supported, but got 'SAR'".
 * Pull the required currency out so checkout can self-heal on the first call.
 */
export function parseRequiredCurrency(payload: unknown): string | null {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload ?? "").toUpperCase();
  const match = /ONLY\s+'?([A-Z]{3})'?\s+IS\s+SUPPORTED/i.exec(text.toUpperCase());
  return match?.[1] ?? null;
}
