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

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.replace(/^0+/, "");
}

async function hashedUserData(user: MetaCapiUser): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const email = user.email?.trim().toLowerCase();
  if (email && email.includes("@")) out.em = [await sha256(email)];
  const phone = user.phone ? normalizePhone(user.phone) : "";
  if (phone.length >= 8) out.ph = [await sha256(phone)];
  if (user.external_id) out.external_id = [await sha256(user.external_id.trim().toLowerCase())];
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

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, events_received: json?.events_received ?? events.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
