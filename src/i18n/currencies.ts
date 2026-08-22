/**
 * Currency catalog + static fallback rates (base = SAR).
 *
 * All prices in the store are authored in SAR. The CurrencyContext converts
 * SAR amounts to the user's selected display currency at render time using
 * live rates (with this static table as a fallback when the network fetch
 * fails).
 *
 * Rates here are approximate market rates updated 2025-Q1. They exist purely
 * so the UI never breaks when the live-rates endpoint is unreachable.
 */

export type CurrencyCode =
  | "SAR" | "AED" | "KWD" | "BHD" | "QAR";

export type CurrencyInfo = {
  code: CurrencyCode;
  symbol: string;          // Latin symbol / ISO short form for non-Arabic UI
  symbolAr: string;        // Arabic symbol/short form
  nameEn: string;
  nameAr: string;
  decimals: number;        // typical display precision
  locale: string;          // Intl number locale for grouping
};

export const CURRENCIES: CurrencyInfo[] = [
  { code: "SAR", symbol: "SAR", symbolAr: "ر.س",  nameEn: "Saudi Riyal",      nameAr: "ريال سعودي",   decimals: 2, locale: "ar-SA" },
  { code: "AED", symbol: "AED", symbolAr: "د.إ",  nameEn: "UAE Dirham",       nameAr: "درهم إماراتي", decimals: 2, locale: "ar-AE" },
  { code: "KWD", symbol: "KWD", symbolAr: "د.ك",  nameEn: "Kuwaiti Dinar",    nameAr: "دينار كويتي",  decimals: 3, locale: "ar-KW" },
  { code: "BHD", symbol: "BHD", symbolAr: "د.ب",  nameEn: "Bahraini Dinar",   nameAr: "دينار بحريني", decimals: 3, locale: "ar-BH" },
  { code: "QAR", symbol: "QAR", symbolAr: "ر.ق",  nameEn: "Qatari Riyal",     nameAr: "ريال قطري",    decimals: 2, locale: "ar-QA" },
];

export const CURRENCY_MAP: Record<CurrencyCode, CurrencyInfo> =
  CURRENCIES.reduce((acc, c) => { acc[c.code] = c; return acc; }, {} as Record<CurrencyCode, CurrencyInfo>);

export const BASE_CURRENCY: CurrencyCode = "SAR";

/**
 * Static fallback rates — how many <code> per 1 SAR.
 * Used only when the live exchange-rate endpoint fails.
 */
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  SAR: 1,
  AED: 0.98,
  KWD: 0.082,
  BHD: 0.10,
  QAR: 0.97,
};

/** Map browser locale/region → preferred currency. */
export function guessCurrencyFromLocale(locale?: string): CurrencyCode {
  if (!locale) return BASE_CURRENCY;
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  const map: Record<string, CurrencyCode> = {
    SA: "SAR", AE: "AED", KW: "KWD", BH: "BHD", QA: "QAR",
  };
  return (region && map[region]) || BASE_CURRENCY;
}
