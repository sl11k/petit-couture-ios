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
  | "SAR" | "AED" | "USD" | "EUR" | "GBP"
  | "KWD" | "BHD" | "QAR" | "OMR" | "EGP"
  | "JOD" | "TRY" | "INR" | "PKR" | "CAD"
  | "AUD" | "JPY" | "CNY";

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
  { code: "USD", symbol: "$",   symbolAr: "$",    nameEn: "US Dollar",        nameAr: "دولار أمريكي", decimals: 2, locale: "en-US" },
  { code: "EUR", symbol: "€",   symbolAr: "€",    nameEn: "Euro",             nameAr: "يورو",         decimals: 2, locale: "en-IE" },
  { code: "GBP", symbol: "£",   symbolAr: "£",    nameEn: "British Pound",    nameAr: "جنيه إسترليني",decimals: 2, locale: "en-GB" },
  { code: "KWD", symbol: "KWD", symbolAr: "د.ك",  nameEn: "Kuwaiti Dinar",    nameAr: "دينار كويتي",  decimals: 3, locale: "ar-KW" },
  { code: "BHD", symbol: "BHD", symbolAr: "د.ب",  nameEn: "Bahraini Dinar",   nameAr: "دينار بحريني", decimals: 3, locale: "ar-BH" },
  { code: "QAR", symbol: "QAR", symbolAr: "ر.ق",  nameEn: "Qatari Riyal",     nameAr: "ريال قطري",    decimals: 2, locale: "ar-QA" },
  { code: "OMR", symbol: "OMR", symbolAr: "ر.ع",  nameEn: "Omani Rial",       nameAr: "ريال عماني",   decimals: 3, locale: "ar-OM" },
  { code: "EGP", symbol: "EGP", symbolAr: "ج.م",  nameEn: "Egyptian Pound",   nameAr: "جنيه مصري",    decimals: 2, locale: "ar-EG" },
  { code: "JOD", symbol: "JOD", symbolAr: "د.أ",  nameEn: "Jordanian Dinar",  nameAr: "دينار أردني",  decimals: 3, locale: "ar-JO" },
  { code: "TRY", symbol: "₺",   symbolAr: "₺",    nameEn: "Turkish Lira",     nameAr: "ليرة تركية",   decimals: 2, locale: "tr-TR" },
  { code: "INR", symbol: "₹",   symbolAr: "₹",    nameEn: "Indian Rupee",     nameAr: "روبية هندية",  decimals: 2, locale: "en-IN" },
  { code: "PKR", symbol: "₨",   symbolAr: "₨",    nameEn: "Pakistani Rupee",  nameAr: "روبية باكستانية", decimals: 0, locale: "en-PK" },
  { code: "CAD", symbol: "C$",  symbolAr: "C$",   nameEn: "Canadian Dollar",  nameAr: "دولار كندي",   decimals: 2, locale: "en-CA" },
  { code: "AUD", symbol: "A$",  symbolAr: "A$",   nameEn: "Australian Dollar",nameAr: "دولار أسترالي",decimals: 2, locale: "en-AU" },
  { code: "JPY", symbol: "¥",   symbolAr: "¥",    nameEn: "Japanese Yen",     nameAr: "ين ياباني",    decimals: 0, locale: "ja-JP" },
  { code: "CNY", symbol: "¥",   symbolAr: "¥",    nameEn: "Chinese Yuan",     nameAr: "يوان صيني",    decimals: 2, locale: "zh-CN" },
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
  USD: 0.267,
  EUR: 0.245,
  GBP: 0.21,
  KWD: 0.082,
  BHD: 0.10,
  QAR: 0.97,
  OMR: 0.103,
  EGP: 13.1,
  JOD: 0.189,
  TRY: 9.2,
  INR: 22.4,
  PKR: 74.5,
  CAD: 0.37,
  AUD: 0.41,
  JPY: 40.0,
  CNY: 1.93,
};

/** Map browser locale/region → preferred currency. */
export function guessCurrencyFromLocale(locale?: string): CurrencyCode {
  if (!locale) return BASE_CURRENCY;
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  const map: Record<string, CurrencyCode> = {
    SA: "SAR", AE: "AED", KW: "KWD", BH: "BHD", QA: "QAR", OM: "OMR",
    EG: "EGP", JO: "JOD", TR: "TRY", IN: "INR", PK: "PKR",
    US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", JP: "JPY", CN: "CNY",
    DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", IE: "EUR", PT: "EUR",
  };
  return (region && map[region]) || BASE_CURRENCY;
}
