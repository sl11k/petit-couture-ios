// Privacy & consent helpers
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export type Consents = {
  marketing_email: boolean;
  marketing_sms: boolean;
  marketing_whatsapp: boolean;
  marketing_push: boolean;
  transactional_email: boolean;
  transactional_sms: boolean;
  data_processing: boolean;
  third_party_sharing: boolean;
};

export const DEFAULT_CONSENTS: Consents = {
  marketing_email: false, marketing_sms: false, marketing_whatsapp: false, marketing_push: false,
  transactional_email: true, transactional_sms: true,
  data_processing: true, third_party_sharing: false,
};

export async function getConsents(userId: string): Promise<Consents> {
  const { data } = await db.from("customer_consents").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return DEFAULT_CONSENTS;
  return { ...DEFAULT_CONSENTS, ...data };
}

export async function setConsents(userId: string, c: Partial<Consents>, source = "account_settings") {
  const existing = await getConsents(userId);
  await db.from("customer_consents").upsert({
    user_id: userId, ...existing, ...c, source, updated_at: new Date().toISOString(),
  });
}

// Filter recipients before sending a marketing campaign — only those who opted in.
export async function filterOptedInRecipients(
  userIds: string[],
  channel: "email" | "sms" | "whatsapp" | "push",
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const col = `marketing_${channel}`;
  const { data } = await db.from("customer_consents")
    .select(`user_id, ${col}`)
    .in("user_id", userIds)
    .eq(col, true);
  return (data ?? []).map((r: any) => r.user_id);
}

// Generate a secure unsubscribe token
export async function createUnsubscribeToken(userId: string, email: string, channel = "email"): Promise<string> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.from("unsubscribe_tokens").insert({ token, user_id: userId, email, channel });
  return token;
}

// === Customer-initiated GDPR actions ===
export async function requestDataExport(userId: string) {
  return db.from("data_export_requests").insert({ user_id: userId, status: "pending" });
}

export async function requestAccountDeletion(userId: string, reason?: string) {
  return db.from("account_deletion_requests").upsert(
    { user_id: userId, reason: reason ?? null, status: "pending", requested_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export async function cancelAccountDeletion(userId: string) {
  return db.from("account_deletion_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("user_id", userId).eq("status", "pending");
}

// Build a JSON export of the user's own data — uses RLS so only their rows return.
export async function buildSelfDataExport(userId: string) {
  const tables = ["profiles", "orders", "order_items", "customer_consents", "active_sessions", "addresses", "wishlist_items", "support_tickets", "reviews"];
  const out: Record<string, any> = { exported_at: new Date().toISOString(), user_id: userId };
  await Promise.all(tables.map(async (t) => {
    try {
      const { data } = await (supabase as any).from(t).select("*").eq("user_id", userId);
      out[t] = data ?? [];
    } catch { out[t] = []; }
  }));
  return out;
}

// === Cookie consent ===
export type CookieConsent = { necessary: boolean; analytics: boolean; marketing: boolean; preferences: boolean };
const COOKIE_KEY = "cookie_consent_v1";

export function getStoredCookieConsent(): CookieConsent | null {
  if (typeof localStorage === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(COOKIE_KEY) ?? "null"); } catch { return null; }
}

export async function saveCookieConsent(c: CookieConsent, userId?: string | null) {
  if (typeof localStorage !== "undefined") localStorage.setItem(COOKIE_KEY, JSON.stringify(c));
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    let visitor = localStorage.getItem("visitor_id");
    if (!visitor) { visitor = crypto.randomUUID(); localStorage.setItem("visitor_id", visitor); }
    await db.from("cookie_consents").insert({
      visitor_id: visitor, user_id: userId ?? null, ...c, user_agent: ua,
    });
  } catch { /* ignore */ }
}
