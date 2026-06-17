// src/lib/ageSort.ts
//
// Natural chronological sort for age/size labels like
// "6 Months", "12 Months", "18 Months", "2 Years", "10 Years",
// "6 شهور", "سنتان", "3 سنوات", "12 سنة", etc.
// Falls back to the label's first numeric value (or alphabetical) for
// non-age labels (S/M/L, EU 38, ...), so it stays safe to use anywhere.

const AR_DIGIT = /[٠-٩]/g;
const AR_TO_EN: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

function normalize(s: string): string {
  return s.replace(AR_DIGIT, (d) => AR_TO_EN[d] ?? d).toLowerCase().trim();
}

/**
 * Convert a label to "months" for sorting purposes. Returns null when the
 * label has no number (so the caller can fall back to alphabetical order).
 *
 * Examples:
 *   "6 Months"   -> 6
 *   "18 شهر"     -> 18
 *   "2 Years"    -> 24
 *   "سنتان"      -> 24
 *   "3 سنوات"    -> 36
 *   "S" / "M"    -> null
 */
export function ageLabelToMonths(label: string | null | undefined): number | null {
  if (!label) return null;
  const s = normalize(String(label));

  // Special-case Arabic dual forms with no digits.
  if (/^سنتان$|^سنتين$/.test(s)) return 24;
  if (/^شهران$|^شهرين$/.test(s)) return 2;
  if (/^سنة$/.test(s)) return 12;
  if (/^شهر$/.test(s)) return 1;

  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;

  const isMonth = /month|mo\b|شهر|شهور|أشهر/.test(s);
  const isYear = /year|yr\b|سنة|سنوات|عام|أعوام/.test(s);

  if (isMonth) return n;
  if (isYear) return n * 12;
  // Plain number without a unit → assume the largest reasonable: years.
  return n * 12;
}

/** Comparator for arrays of age/size string labels. */
export function compareAgeLabels(a: string, b: string): number {
  const ma = ageLabelToMonths(a);
  const mb = ageLabelToMonths(b);
  if (ma != null && mb != null) return ma - mb;
  if (ma != null) return -1;        // numeric ages come first
  if (mb != null) return 1;
  return a.localeCompare(b);
}

/** Sort by an arbitrary key extractor. Stable for ties via index. */
export function sortByAge<T>(items: T[], getLabel: (t: T) => string): T[] {
  return items
    .map((item, i) => ({ item, i, m: ageLabelToMonths(getLabel(item)) }))
    .sort((a, b) => {
      if (a.m != null && b.m != null) return a.m - b.m || a.i - b.i;
      if (a.m != null) return -1;
      if (b.m != null) return 1;
      return getLabel(a.item).localeCompare(getLabel(b.item)) || a.i - b.i;
    })
    .map((x) => x.item);
}
