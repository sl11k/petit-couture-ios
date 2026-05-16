import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import {
  BASE_CURRENCY, CURRENCIES, CURRENCY_MAP, FALLBACK_RATES,
  guessCurrencyFromLocale, type CurrencyCode, type CurrencyInfo,
} from "@/i18n/currencies";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY = "lpp:currency:v1";
const RATES_CACHE_KEY = "lpp:currency-rates:v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type Rates = Record<CurrencyCode, number>;

type Ctx = {
  currency: CurrencyCode;
  info: CurrencyInfo;
  setCurrency: (c: CurrencyCode) => void;
  currencies: CurrencyInfo[];
  rates: Rates;
  ratesLoaded: boolean;
  /** Convert an amount from base (SAR) to the active display currency. */
  convert: (amountInBase: number, fromCurrency?: CurrencyCode) => number;
  /** Format an amount given in base (SAR) with the active display currency. */
  format: (amountInBase: number, opts?: { fromCurrency?: CurrencyCode; withSymbol?: boolean }) => string;
};

const CurrencyContext = createContext<Ctx | null>(null);

function readStoredCurrency(): CurrencyCode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (raw in CURRENCY_MAP)) return raw as CurrencyCode;
  } catch { /* noop */ }
  return null;
}

function readCachedRates(): Rates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; rates: Rates };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.rates;
  } catch { return null; }
}

function writeCachedRates(rates: Rates) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ at: Date.now(), rates }));
  } catch { /* noop */ }
}

async function fetchLiveRates(): Promise<Rates | null> {
  try {
    // Free, no-key endpoint. Base = SAR so values match our static fallback.
    const res = await fetch("https://open.er-api.com/v6/latest/SAR", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json() as { result?: string; rates?: Record<string, number> };
    if (json.result !== "success" || !json.rates) return null;
    const out: Rates = { ...FALLBACK_RATES };
    for (const c of CURRENCIES) {
      const v = json.rates[c.code];
      if (typeof v === "number" && isFinite(v) && v > 0) out[c.code] = v;
    }
    out.SAR = 1;
    return out;
  } catch { return null; }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  const [currency, setCurrencyState] = useState<CurrencyCode>(BASE_CURRENCY);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Hydrate currency after mount (SSR-safe).
  useEffect(() => {
    const stored = readStoredCurrency();
    if (stored) {
      setCurrencyState(stored);
      return;
    }
    // First-visit auto-detect from browser locale.
    const guess = guessCurrencyFromLocale(
      typeof navigator !== "undefined" ? navigator.language : undefined,
    );
    setCurrencyState(guess);
  }, []);

  // Hydrate rates: cache first, then refresh in background.
  useEffect(() => {
    const cached = readCachedRates();
    if (cached) { setRates(cached); setRatesLoaded(true); }
    fetchLiveRates().then((live) => {
      if (live) {
        setRates(live);
        setRatesLoaded(true);
        writeCachedRates(live);
      } else if (!cached) {
        // Endpoint failed and no cache — keep static fallback, mark loaded.
        setRatesLoaded(true);
      }
    });
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(STORAGE_KEY, c); } catch { /* noop */ }
    }
  }, []);

  const convert = useCallback((amountInBase: number, fromCurrency: CurrencyCode = BASE_CURRENCY) => {
    if (!isFinite(amountInBase)) return amountInBase;
    // Normalize source → SAR, then SAR → target.
    const fromRate = rates[fromCurrency] ?? 1;        // <from> per 1 SAR
    const toRate   = rates[currency]     ?? 1;        // <to>   per 1 SAR
    const inSar    = fromCurrency === BASE_CURRENCY ? amountInBase : amountInBase / (fromRate || 1);
    return inSar * toRate;
  }, [rates, currency]);

  const format = useCallback((amountInBase: number, opts?: { fromCurrency?: CurrencyCode; withSymbol?: boolean }) => {
    const info = CURRENCY_MAP[currency];
    const converted = convert(amountInBase, opts?.fromCurrency);
    const localeForNumbers = lang === "ar" ? "ar-EG" : info.locale;
    const num = new Intl.NumberFormat(localeForNumbers, {
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(converted);
    if (opts?.withSymbol === false) return num;
    const sym = lang === "ar" ? info.symbolAr : info.symbol;
    return `${num} ${sym}`;
  }, [convert, currency, lang]);

  const value = useMemo<Ctx>(() => ({
    currency,
    info: CURRENCY_MAP[currency],
    setCurrency,
    currencies: CURRENCIES,
    rates,
    ratesLoaded,
    convert,
    format,
  }), [currency, setCurrency, rates, ratesLoaded, convert, format]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

/** Convenience: just the formatter, e.g. const fmt = usePriceFormatter(); fmt(199.99) */
export function usePriceFormatter() {
  const { format } = useCurrency();
  return format;
}
