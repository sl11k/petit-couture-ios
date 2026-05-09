// Server-only OTO (tryoto.com) integration helpers.
// Uses the OTO_REFRESH_TOKEN secret to obtain a short-lived access token.

const OTO_BASE = "https://api.tryoto.com/rest/v2";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getOtoAccessToken(): Promise<string> {
  const refresh = process.env.OTO_REFRESH_TOKEN;
  if (!refresh) throw new Error("OTO_REFRESH_TOKEN is not configured");

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${OTO_BASE}/refreshToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.access_token) {
    throw new Error(`OTO token refresh failed: ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  }
  cachedToken = {
    token: json.access_token,
    // OTO tokens are typically valid for ~1h. Default 50m if not provided.
    expiresAt: Date.now() + (Number(json.expires_in || 3000) * 1000),
  };
  return cachedToken.token;
}

export async function otoFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getOtoAccessToken();
  const res = await fetch(`${OTO_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`OTO ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return json;
}

export interface OtoCreateOrderInput {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  city: string;
  country?: string;
  address1: string;
  address2?: string | null;
  postcode?: string | null;
  weight?: number;
  codAmount?: number;
  itemsCount: number;
  totalValue: number;
  currency: string;
}

export async function otoCreateOrder(input: OtoCreateOrderInput) {
  // OTO createOrder payload (per their v2 docs).
  const payload = {
    orderId: input.orderNumber,
    payment_method: input.codAmount && input.codAmount > 0 ? "COD" : "Paid",
    amount_due: input.codAmount ?? 0,
    order_value: input.totalValue,
    currency: input.currency || "SAR",
    boxes: 1,
    weight: input.weight ?? 1,
    items_count: input.itemsCount,
    customer: {
      name: input.customerName,
      mobile: input.customerPhone,
      email: input.customerEmail || undefined,
      address: input.address1 + (input.address2 ? `, ${input.address2}` : ""),
      city: input.city,
      country: input.country || "SA",
      postcode: input.postcode || "",
    },
  };
  return otoFetch("/createOrder", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
