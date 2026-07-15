// ISO2 country code -> international dial code (without leading +)
// Covers the common GCC / MENA / EU / worldwide list. Extend as needed.
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  SA: "966", AE: "971", KW: "965", QA: "974", BH: "973", OM: "968", YE: "967",
  JO: "962", LB: "961", SY: "963", IQ: "964", PS: "970", IL: "972",
  EG: "20", LY: "218", TN: "216", DZ: "213", MA: "212", SD: "249", SO: "252", MR: "222",
  TR: "90", IR: "98", PK: "92", IN: "91", BD: "880", LK: "94", NP: "977", AF: "93",
  ID: "62", MY: "60", SG: "65", TH: "66", PH: "63", VN: "84", CN: "86", JP: "81", KR: "82", HK: "852", TW: "886",
  US: "1", CA: "1", MX: "52", BR: "55", AR: "54", CL: "56", CO: "57", PE: "51",
  GB: "44", IE: "353", FR: "33", DE: "49", IT: "39", ES: "34", PT: "351", NL: "31", BE: "32",
  CH: "41", AT: "43", SE: "46", NO: "47", DK: "45", FI: "358", PL: "48", CZ: "420",
  GR: "30", RU: "7", UA: "380", RO: "40",
  AU: "61", NZ: "64", ZA: "27", NG: "234", KE: "254", ET: "251", GH: "233",
};

export function dialCodeFor(iso2: string | undefined | null): string {
  if (!iso2) return "";
  return COUNTRY_DIAL_CODES[String(iso2).toUpperCase()] || "";
}

/**
 * Normalize a user-entered phone into international E.164-style digits (no +).
 * - strips spaces, dashes, parentheses, leading +
 * - if the user already typed the country dial code, keep it
 * - otherwise, strip a leading 0 and prepend the dial code
 * Returns "" if input is empty.
 */
export function toInternationalPhone(rawPhone: string, iso2: string | undefined | null): string {
  const cleaned = (rawPhone || "").replace(/[^\d]/g, "");
  if (!cleaned) return "";
  const dial = dialCodeFor(iso2);
  if (!dial) return cleaned;
  if (cleaned.startsWith(dial)) return cleaned;
  // strip a single leading zero (local trunk prefix)
  const local = cleaned.replace(/^0+/, "");
  return `${dial}${local}`;
}
