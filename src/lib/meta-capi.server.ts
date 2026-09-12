// Meta Conversions API (server-side) sender.
// Browser pixel events are frequently dropped by ad-blockers, iOS ITP and
// redirect-based payment flows, so every storefront event is mirrored here
// with the same event_id — Meta deduplicates the pair automatically.

export interface MetaCapiUser {
  email?: string | null;
  phone?: string | null;
  external_id?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  client_ip_address?: string | null;
  client_user_agent?: string | null;
  country?: string | null;
  city?: string | null;
}

export interface MetaCapiEvent {
  event_name: string;
  event_id: string;
  event_time?: number;
  event_source_url?: string | null;
  action_source?: string;
  value?: number | null;
  currency?: string | null;
  contents?: { id: string; quantity: number; price?: number }[];
  content_name?: string | null;
  content_type?: string | null;
  order_id?: string | null;
  search_string?: string | null;
  num_items?: number | null;
}

const encoder = new TextEncoder();

export async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function normalizeMetaEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeMetaPhone(raw: string, country = "SA"): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) {
    const callingCode: Record<string, string> = { SA: "966", AE: "971", BH: "973", KW: "965", QA: "974" };
    digits = `${callingCode[country.toUpperCase()] || ""}${digits.slice(1)}`;
  }
  return /^\d{8,15}$/.test(digits) ? digits : "";
}

async function hashUnlessHashed(value: string): Promise<string> {
  return SHA256_HEX.test(value) ? value.toLowerCase() : sha256(value);
}

export async function hashedUserData(user: MetaCapiUser): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const email = user.email ? normalizeMetaEmail(user.email) : "";
  if (SHA256_HEX.test(email) || email.includes("@")) out.em = [await hashUnlessHashed(email)];
  const phone = user.phone && SHA256_HEX.test(user.phone) ? user.phone : normalizeMetaPhone(user.phone || "", user.country || "SA");
  if (phone) out.ph = [await hashUnlessHashed(phone)];
  if (user.external_id) out.external_id = [await hashUnlessHashed(user.external_id.trim().toLowerCase())];
  if (user.country) out.country = [await sha256(user.country.trim().toLowerCase())];
  if (user.city) out.ct = [await sha256(user.city.trim().toLowerCase().replace(/\s+/g, ""))];
  if (user.fbp) out.fbp = user.fbp;
  if (user.fbc) out.fbc = user.fbc;
  if (user.client_ip_address) out.client_ip_address = user.client_ip_address;
  if (user.client_user_agent) out.client_user_agent = user.client_user_agent;
  return out;
}

export interface MetaCapiResult {
  ok: boolean;
  skipped?: string;
  events_received?: number;
  error?: string;
  error_code?: string;
  http_status?: number;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function retryPause(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** attempt, 1_000)));
}

/** Posts one or more events to the Meta Conversions API. Never throws. */
export async function sendMetaCapiEvents(
  pixelId: string,
  accessToken: string,
  events: MetaCapiEvent[],
  user: MetaCapiUser,
  testEventCode?: string | null,
): Promise<MetaCapiResult> {
  try {
    const userData = await hashedUserData(user);
    const payload = {
      data: events.map((e) => {
        const customData: Record<string, unknown> = {};
        if (e.value != null) customData.value = Number(e.value);
        if (e.currency) customData.currency = e.currency;
        if (e.content_name) customData.content_name = e.content_name;
        customData.content_type = e.content_type || "product";
        if (e.contents?.length) {
          customData.contents = e.contents.map((c) => ({
            id: c.id,
            quantity: c.quantity,
            item_price: c.price,
          }));
          customData.content_ids = e.contents.map((c) => c.id);
          customData.num_items = e.contents.reduce((s, c) => s + (c.quantity || 1), 0);
        } else if (e.num_items) {
          customData.num_items = e.num_items;
        }
        if (e.order_id) customData.order_id = e.order_id;
        if (e.search_string) customData.search_string = e.search_string;
        return {
          event_name: e.event_name,
          event_time: e.event_time ?? Math.floor(Date.now() / 1000),
          event_id: e.event_id,
          event_source_url: e.event_source_url ?? undefined,
          action_source: e.action_source ?? "website",
          user_data: userData,
          custom_data: customData,
        };
      }),
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8_000),
          },
        );
        const json = (await res.json().catch(() => ({}))) as any;
        if (res.ok) return { ok: true, events_received: json?.events_received ?? events.length };
        if (isTransientStatus(res.status) && attempt < 2) {
          await retryPause(attempt);
          continue;
        }
        return {
          ok: false,
          error: String(json?.error?.message || `HTTP ${res.status}`).slice(0, 300),
          error_code: String(json?.error?.code || "META_HTTP_ERROR").slice(0, 80),
          http_status: res.status,
        };
      } catch (err) {
        const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        if (attempt < 2) {
          await retryPause(attempt);
          continue;
        }
        return { ok: false, error: timeout ? "Meta request timed out" : "Meta request failed", error_code: timeout ? "TIMEOUT" : "NETWORK_ERROR" };
      }
    }
    return { ok: false, error: "Meta request failed", error_code: "NETWORK_ERROR" };
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, error: timeout ? "Meta request timed out" : "Meta request failed", error_code: timeout ? "TIMEOUT" : "NETWORK_ERROR" };
  }
}
