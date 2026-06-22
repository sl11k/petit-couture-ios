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
    throw new Error(
      `OTO token refresh failed: ${res.status} ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  cachedToken = {
    token: json.access_token,
    // OTO tokens are typically valid for ~1h. Default 50m if not provided.
    expiresAt: Date.now() + Number(json.expires_in || 3000) * 1000,
  };
  return cachedToken.token;
}

export async function otoFetch(path: string, init: RequestInit = {}): Promise<any> {
  const send = async (token: string) =>
    fetch(`${OTO_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

  let res = await send(await getOtoAccessToken());
  // A cached access token may be revoked before its advertised expiry. Refresh
  // it once on an authentication failure and never retry other failures.
  if (res.status === 401) {
    cachedToken = null;
    res = await send(await getOtoAccessToken());
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
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
  items?: Array<{ name: string; sku?: string | null; price: number; quantity: number }>;
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
    // Line items (incl. per-size SKU) so the carrier's picking list / label
    // shows the exact code that was bought.
    items: (input.items ?? []).map((it) => ({
      name: it.name,
      sku: it.sku || undefined,
      price: it.price,
      quantity: it.quantity,
      rowTotal: Number((it.price * it.quantity).toFixed(2)),
    })),
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

// Shared helper used by both the manual server-fn and the auto-creation
// inside placeOrder. Returns { ok, shipment?, error? } and never throws.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function createOtoShipmentForOrder(
  orderId: string,
  createdBy?: string | null,
): Promise<{ ok: boolean; shipment?: any; otoResp?: any; error?: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !order) return { ok: false, error: "Order not found" };

  const isCod = order.payment_method === "cod";
  if (!isCod && order.payment_status !== "paid") {
    return { ok: false, error: "Shipment blocked until payment is confirmed" };
  }

  // Skip a completed/in-progress shipment, but allow an explicit retry after a
  // failed carrier request.
  const existing = await supabaseAdmin
    .from("shipments")
    .select("*")
    .eq("order_id", orderId)
    .eq("carrier_code", "oto")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.data && existing.data.status !== "failed") {
    const { error: syncError } = await (supabaseAdmin.from("orders") as any)
      .update({
        shipping_carrier: "oto",
        tracking_number: existing.data.tracking_number || null,
        tracking_url: existing.data.tracking_url || null,
        shipping_status: existing.data.status,
        oto_creation_error: null,
      })
      .eq("id", order.id);
    if (syncError) {
      return { ok: false, shipment: existing.data, error: syncError.message };
    }
    return { ok: true, shipment: existing.data };
  }

  const { data: claimed, error: claimError } = await (supabaseAdmin as any).rpc(
    "claim_oto_shipment_creation",
    { _order_id: order.id },
  );
  if (claimError) return { ok: false, error: `OTO claim failed: ${claimError.message}` };
  if (!claimed) return { ok: true, shipment: existing.data ?? undefined };

  const addr: any = order.shipping_address || {};
  const itemsRes = await supabaseAdmin
    .from("order_items")
    .select("product_name, sku, qty, unit_price")
    .eq("order_id", order.id);
  if (itemsRes.error || !itemsRes.data?.length) {
    const message = itemsRes.error?.message || "Order has no shippable items";
    await (supabaseAdmin.from("orders") as any)
      .update({ oto_creation_error: message.slice(0, 500) })
      .eq("id", order.id);
    return { ok: false, error: message };
  }
  const itemRows = itemsRes.data || [];
  const itemsCount = itemRows.reduce((s, r: any) => s + Number(r.qty || 0), 0) || 1;
  const lineItems = itemRows.map((r: any) => ({
    name: r.product_name,
    sku: r.sku || null,
    price: Number(r.unit_price || 0),
    quantity: Number(r.qty || 0),
  }));

  let otoResp: any;
  try {
    otoResp = await otoCreateOrder({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
      city: addr.city || (order as any).shipping_city || "Riyadh",
      country: addr.country_code || "SA",
      address1: addr.line1 || addr.street || addr.address || "",
      address2: addr.line2 || addr.district || null,
      postcode: addr.postcode || addr.postalCode || addr.zip || null,
      weight: Number((order as any).total_weight_kg || 1),
      codAmount: isCod ? Number(order.total) : 0,
      itemsCount,
      totalValue: Number(order.total),
      currency: order.currency || "SAR",
      items: lineItems,
    });
  } catch (e: any) {
    const message = e?.message || "OTO request failed";
    await (supabaseAdmin.from("orders") as any)
      .update({ oto_creation_error: message.slice(0, 500) })
      .eq("id", order.id);
    return { ok: false, error: message };
  }

  const trackingNumber: string | undefined =
    otoResp?.tracking_number || otoResp?.awb || otoResp?.otoId || otoResp?.reference;
  const trackingUrl: string | undefined =
    otoResp?.tracking_url || otoResp?.trackingLink || otoResp?.label_url;
  const awbUrl: string | undefined = otoResp?.label_url || otoResp?.awb_url;

  const shipmentValues = {
    order_id: order.id,
    order_number: order.order_number,
    carrier_code: "oto",
    status: "label_created",
    tracking_number: trackingNumber || null,
    tracking_url: trackingUrl || null,
    awb_url: awbUrl || null,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_email: order.customer_email,
    shipping_address: addr,
    city: addr.city || null,
    country_code: addr.country_code || "SA",
    weight_kg: Number((order as any).total_weight_kg || 1),
    declared_value: Number(order.total),
    cod_amount: isCod ? Number(order.total) : 0,
    shipping_fee: Number(order.shipping_fee || 0),
    raw_response: otoResp,
    created_by: createdBy || null,
  };

  const shipmentWrite = existing.data
    ? supabaseAdmin.from("shipments").update(shipmentValues).eq("id", existing.data.id)
    : supabaseAdmin.from("shipments").insert(shipmentValues);
  const { data: shipment, error: shipmentError } = await shipmentWrite.select().single();
  if (shipmentError || !shipment) {
    const message = `Failed to persist OTO shipment: ${shipmentError?.message || "unknown"}`;
    await (supabaseAdmin.from("orders") as any)
      .update({ oto_creation_error: message.slice(0, 500) })
      .eq("id", order.id);
    return { ok: false, otoResp, error: message };
  }

  const { error: orderUpdateError } = await (supabaseAdmin.from("orders") as any)
    .update({
      shipping_carrier: "oto",
      tracking_number: trackingNumber || null,
      tracking_url: trackingUrl || null,
      shipping_status: "label_created",
      oto_creation_error: null,
    })
    .eq("id", order.id);
  if (orderUpdateError) {
    return { ok: false, shipment, otoResp, error: orderUpdateError.message };
  }

  return { ok: true, shipment, otoResp };
}
