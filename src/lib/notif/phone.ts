export type PhoneNormalizationResult =
  | { ok: true; e164: string; digits: string }
  | { ok: false; error: string };

/** Normalize Gulf/local Saudi input to strict E.164 without guessing other countries. */
export function normalizeWhatsAppPhone(input: string, defaultCountryCode = "966"): PhoneNormalizationResult {
  const raw = String(input || "").trim();
  if (!raw) return { ok: false, error: "recipient_missing" };

  let digits = raw.replace(/[^0-9]/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `${defaultCountryCode}${digits.slice(1)}`;

  if (!/^[1-9][0-9]{7,14}$/.test(digits)) {
    return { ok: false, error: "recipient_invalid_e164" };
  }
  return { ok: true, e164: `+${digits}`, digits };
}
