import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OTO_BASE = process.env.OTO_API_BASE_URL || "https://api.tryoto.com/rest/v2";

let cachedToken: { token: string; expiresAt: number } | null = null;

type JsonRecord = Record<string, any>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value: unknown) => {
  const text = value == null ? "" : String(value).trim();
  return text || undefined;
};
const asNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const roundMoney = (value: unknown) => Number(asNumber(value, 0).toFixed(2));

function normalizeCountry(value: unknown) {
  const raw = clean(value)?.toUpperCase();
  if (!raw) return "SA";
  if (raw === "UAE") return "AE";
  if (raw === "KSA") return "SA";
  if (raw === "KWT") return "KW";
  if (raw === "BHR") return "BH";
  return raw.slice(0, 2);
}

function redactOtoBody(body: any): any {
  if (!body || typeof body !== "object") return body;
  if (Array.isArray(body)) return body.map(redactOtoBody);
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => {
      if (/token|secret|password|authorization/i.test(key)) return [key, "••••"];
      if (/mobile|phone|email/i.test(key) && value) return [key, "••••"];
      return [key, redactOtoBody(value)];
    }),
  );
}

export async function getOtoAccessToken(): Promise<string> {
  const staticToken = clean(process.env.OTO_API_TOKEN);
  if (staticToken) return staticToken;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const refresh = clean(process.env.OTO_REFRESH_TOKEN);
  const clientId = clean(process.env.OTO_CLIENT_ID);
  const clientSecret = clean(process.env.OTO_CLIENT_SECRET);

  let res: Response;
  if (refresh) {
    res = await fetch(`${OTO_BASE}/refreshToken`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } else if (clientId && clientSecret) {
    res = await fetch(`${OTO_BASE}/auth`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    });
  } else {
    throw new Error("OTO credentials are not configured");
  }

  const json: any = await res.json().catch(() => ({}));
  const token = json?.access_token || json?.accessToken || json?.token;
  if (!res.ok || !token) {
    throw new Error(`OTO authentication failed: ${res.status} ${JSON.stringify(redactOtoBody(json)).slice(0, 250)}`);
  }

  cachedToken = {
    token,
    expiresAt: Date.now() + Number(json.expires_in || json.expiresIn || 3000) * 1000,
  };
  return cachedToken.token;
}

export async function otoFetch(path: string, init: RequestInit = {}, opts: { idempotencyKey?: string } = {}): Promise<any> {
  const idempotencyKey = opts.idempotencyKey || init.headers?.["Idempotency-Key" as keyof HeadersInit] || randomUUID();

  const send = async (token: string) =>
    fetch(`${OTO_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": String(idempotencyKey),
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

  let res = await send(await getOtoAccessToken());
  if (res.status === 401) {
    cachedToken = null;
    res = await send(await getOtoAccessToken());
  }

  for (let attempt = 0; attempt < 2 && (res.status === 429 || res.status >= 500); attempt += 1) {
    await sleep(500 * (attempt + 1));
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
    throw new Error(`OTO ${path} failed: ${res.status} ${JSON.stringify(redactOtoBody(json || text)).slice(0, 300)}`);
  }
  return json;
}

async function otoFetchFirst(paths: string[], init: RequestInit, idempotencyKey: string) {
  let lastError: any;
  for (const path of paths) {
    try {
      return await otoFetch(path, init, { idempotencyKey });
    } catch (e: any) {
      lastError = e;
      const message = String(e?.message || "");
      if (!message.includes("404") && !message.includes("405") && !message.includes("Cannot POST")) {
        throw e;
      }
    }
  }
  throw lastError;
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
  district?: string | null;
  postcode?: string | null;
  shortAddressCode?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  weight?: number;
  codAmount?: number;
  itemsCount: number;
  subtotal?: number;
  totalValue: number;
  shippingFee?: number;
  currency: string;
  notes?: string | null;
  items?: Array<{
    productId?: string | number | null;
    name: string;
    sku?: string | null;
    price: number;
    quantity: number;
    image?: string | null;
  }>;
}

export type OtoDeliveryOption = {
  deliveryOptionId: string;
  name: string;
  price: number | null;
  currency?: string | null;
  eta?: string | null;
  needToVerifyCrDocStatus?: boolean;
  pickupDropOff?: string | null;
  raw: JsonRecord;
};

function senderInformationFromEnv() {
  const sender = {
    senderAddressName: clean(process.env.OTO_SENDER_ADDRESS_NAME),
    senderId: clean(process.env.OTO_SENDER_ID),
    senderFullName: clean(process.env.OTO_SENDER_FULL_NAME),
    senderMobile: clean(process.env.OTO_SENDER_MOBILE),
    senderEmail: clean(process.env.OTO_SENDER_EMAIL),
    senderCountry: normalizeCountry(process.env.OTO_SENDER_COUNTRY),
    senderCity: clean(process.env.OTO_SENDER_CITY),
    senderDistrict: clean(process.env.OTO_SENDER_DISTRICT),
    senderPostcode: clean(process.env.OTO_SENDER_POSTCODE),
    senderAddressLine: clean(process.env.OTO_SENDER_ADDRESS_LINE),
    senderShortAddressCode: clean(process.env.OTO_SENDER_SHORT_ADDRESS_CODE),
    lat: clean(process.env.OTO_SENDER_LAT),
    lon: clean(process.env.OTO_SENDER_LON),
  };
  const hasExplicitSender = Boolean(
    sender.senderFullName || sender.senderMobile || sender.senderShortAddressCode,
  );
  if (!hasExplicitSender) return null;
  return Object.fromEntries(Object.entries(sender).filter(([, v]) => v != null));
}

async function resolvePickupLocationCode() {
  if (senderInformationFromEnv()) return undefined;

  const explicit = clean(process.env.OTO_PICKUP_LOCATION_CODE);
  if (explicit) return explicit;

  const wantedName = clean(process.env.OTO_PICKUP_LOCATION_NAME);
  if (!wantedName) return undefined;

  const candidates = [
    { path: "/pickupLocations", method: "GET" },
    { path: "/getPickupLocations", method: "GET" },
    { path: "/pickupLocations", method: "POST" },
  ];
  for (const c of candidates) {
    try {
      const resp = await otoFetch(c.path, { method: c.method }, { idempotencyKey: `oto-pickups-${wantedName}` });
      const list =
        resp?.pickupLocations ||
        resp?.locations ||
        resp?.data ||
        resp?.items ||
        (Array.isArray(resp) ? resp : []);
      const match = (Array.isArray(list) ? list : []).find((loc: any) => {
        const name = String(loc?.name || loc?.pickupLocationName || loc?.addressName || "").toLowerCase();
        return name === wantedName.toLowerCase();
      });
      const code = clean(match?.code || match?.pickupLocationCode || match?.locationCode);
      if (code) return code;
    } catch {
      // OTO tenants differ in pickup-list entitlement/path; try the next known path.
    }
  }
  throw new Error(`OTO pickup location "${wantedName}" was not found`);
}

function buildCustomer(input: OtoCreateOrderInput) {
  const customer: JsonRecord = {
    name: input.customerName,
    email: clean(input.customerEmail),
    mobile: input.customerPhone,
    country: normalizeCountry(input.country),
    refID: input.orderNumber,
  };

  if (clean(input.shortAddressCode)) {
    customer.shortAddressCode = clean(input.shortAddressCode);
    customer.city = clean(input.city);
  } else {
    customer.address = [input.address1, input.address2].filter(Boolean).join(", ") || input.city;
    customer.district = clean(input.district || input.address2);
    customer.city = input.city;
    customer.postcode = clean(input.postcode);
    customer.lat = clean(input.lat);
    customer.lon = clean(input.lon);
  }
  return Object.fromEntries(Object.entries(customer).filter(([, v]) => v != null));
}

export async function buildOtoOrderPayload(input: OtoCreateOrderInput, deliveryOptionId?: string | null) {
  if (!clean(input.customerName) || !clean(input.customerPhone)) {
    throw new Error("OTO requires customer name and mobile");
  }
  if (!input.items?.length) throw new Error("OTO requires at least one item");

  const senderInformation = senderInformationFromEnv();
  const pickupLocationCode = senderInformation ? undefined : await resolvePickupLocationCode();
  const packageWeight = Math.max(asNumber(input.weight, 1), 0.1);

  const payload: JsonRecord = {
    orderId: input.orderNumber,
    ref1: input.orderId,
    createShipment: false,
    payment_method: input.codAmount && input.codAmount > 0 ? "cod" : "paid",
    amount: roundMoney(input.totalValue),
    amount_due: input.codAmount && input.codAmount > 0 ? roundMoney(input.codAmount) : 0,
    shippingAmount: roundMoney(input.shippingFee),
    subtotal: roundMoney(input.subtotal ?? input.totalValue),
    currency: (input.currency || "SAR").toUpperCase(),
    shippingNotes: clean(input.notes),
    packageCount: 1,
    packageWeight,
    boxWidth: asNumber(process.env.OTO_DEFAULT_BOX_WIDTH_CM, 10) || 10,
    boxLength: asNumber(process.env.OTO_DEFAULT_BOX_LENGTH_CM, 10) || 10,
    boxHeight: asNumber(process.env.OTO_DEFAULT_BOX_HEIGHT_CM, 10) || 10,
    orderDate: new Date().toISOString(),
    customer: buildCustomer(input),
    items: (input.items ?? []).map((it) => ({
      productId: clean(it.productId),
      name: it.name,
      sku: clean(it.sku) || it.name.slice(0, 40),
      price: roundMoney(it.price),
      quantity: Number(it.quantity || 1),
      rowTotal: roundMoney(Number(it.price || 0) * Number(it.quantity || 1)),
      image: clean(it.image),
    })),
  };

  if (deliveryOptionId) payload.deliveryOptionId = deliveryOptionId;
  if (senderInformation) {
    payload.senderName =
      clean(process.env.OTO_SENDER_NAME) ||
      senderInformation.senderFullName ||
      clean(process.env.VITE_STORE_NAME) ||
      "Petit Couture";
    payload.senderInformation = senderInformation;
  } else if (pickupLocationCode) {
    payload.pickupLocationCode = pickupLocationCode;
  }

  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v != null));
}

export async function otoCreateOrder(input: OtoCreateOrderInput, deliveryOptionId?: string | null) {
  const payload = await buildOtoOrderPayload(input, deliveryOptionId);
  return otoFetchFirst(
    ["/orders", "/createOrder"],
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    `oto-create-order-${input.orderNumber}`,
  );
}

function normalizeDeliveryOptions(resp: any): OtoDeliveryOption[] {
  const rawList =
    resp?.deliveryOptions ||
    resp?.deliveryOption ||
    resp?.options ||
    resp?.data ||
    resp?.result ||
    resp?.deliveryCompanyOptions ||
    (Array.isArray(resp) ? resp : []);
  const list = Array.isArray(rawList) ? rawList : [];
  return list
    .map((item: any) => {
      const id = clean(
        item?.deliveryOptionId ||
          item?.deliveryCompanySettingsId ||
          item?.deliveryCompanyId ||
          item?.id,
      );
      if (!id) return null;
      const name =
        clean(item?.deliveryCompanyName) ||
        clean(item?.companyName) ||
        clean(item?.name) ||
        clean(item?.deliveryOptionName) ||
        id;
      const price =
        item?.price ?? item?.deliveryFee ?? item?.totalPrice ?? item?.amount ?? item?.cost ?? null;
      return {
        deliveryOptionId: id,
        name,
        price: price == null ? null : roundMoney(price),
        currency: clean(item?.currency),
        eta: clean(item?.eta || item?.deliveryTime || item?.estimatedDelivery),
        needToVerifyCrDocStatus: Boolean(item?.needToVerifyCrDocStatus),
        pickupDropOff: clean(item?.pickupDropOff || item?.pickingType),
        raw: item,
      } satisfies OtoDeliveryOption;
    })
    .filter(Boolean) as OtoDeliveryOption[];
}

export async function otoGetDeliveryFeeOptions(orderNumber: string) {
  const resp = await otoFetchFirst(
    [`/orders/${encodeURIComponent(orderNumber)}/delivery-fee`, "/getDeliveryFee"],
    {
      method: "POST",
      body: JSON.stringify({ orderId: orderNumber }),
    },
    `oto-delivery-fee-${orderNumber}`,
  );
  return { raw: resp, options: normalizeDeliveryOptions(resp) };
}

export async function otoCheckDeliveryFee(input: {
  originCity?: string | null;
  destinationCity: string;
  weight?: number;
  codAmount?: number;
  currency?: string;
  dimensions?: { width?: number; length?: number; height?: number };
}) {
  const payload = {
    originCity: clean(input.originCity) || clean(process.env.OTO_ORIGIN_CITY) || "Riyadh",
    destinationCity: input.destinationCity,
    weight: Math.max(asNumber(input.weight, 1), 0.1),
    totalDue: roundMoney(input.codAmount || 0),
    currency: (input.currency || "SAR").toUpperCase(),
    width: asNumber(input.dimensions?.width, 10) || 10,
    length: asNumber(input.dimensions?.length, 10) || 10,
    height: asNumber(input.dimensions?.height, 10) || 10,
  };
  const resp = await otoFetch("/checkOTODeliveryFee", {
    method: "POST",
    body: JSON.stringify(payload),
  }, { idempotencyKey: `oto-check-fee-${payload.destinationCity}-${payload.weight}` });
  return { raw: resp, options: normalizeDeliveryOptions(resp) };
}

function chooseDeliveryOption(options: OtoDeliveryOption[]) {
  const configured = clean(process.env.OTO_DEFAULT_DELIVERY_OPTION_ID);
  if (configured) return options.find((o) => o.deliveryOptionId === configured) || { deliveryOptionId: configured, name: "Configured OTO option", price: null, raw: {} };
  return [...options].sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER))[0];
}

export async function otoCreateShipment(orderNumber: string, deliveryOptionId: string) {
  return otoFetchFirst(
    [`/orders/${encodeURIComponent(orderNumber)}/create-shipment`, "/createShipment"],
    {
      method: "POST",
      body: JSON.stringify({ orderId: orderNumber, deliveryOptionId }),
    },
    `oto-create-shipment-${orderNumber}-${deliveryOptionId}`,
  );
}

export async function otoGetOrderStatus(orderNumberOrOtoId: string) {
  return otoFetchFirst(
    [
      `/orders/${encodeURIComponent(orderNumberOrOtoId)}/status`,
      `/orderStatus?orderId=${encodeURIComponent(orderNumberOrOtoId)}`,
    ],
    {
      method: "GET",
    },
    `oto-order-status-${orderNumberOrOtoId}`,
  );
}

async function loadOtoOrderInput(orderId: string): Promise<{ order: any; input?: OtoCreateOrderInput; error?: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !order) return { order: null, error: "Order not found" };

  const addr: any = order.shipping_address || {};
  const itemsRes = await supabaseAdmin
    .from("order_items")
    .select("product_id,product_name,product_slug,sku,qty,unit_price,image_url")
    .eq("order_id", order.id);
  if (itemsRes.error || !itemsRes.data?.length) {
    return { order, error: itemsRes.error?.message || "Order has no shippable items" };
  }

  const itemRows = itemsRes.data || [];
  const itemsCount = itemRows.reduce((s, r: any) => s + Number(r.qty || 0), 0) || 1;
  const lineItems = itemRows.map((r: any) => ({
    productId: r.product_id || r.product_slug || null,
    name: r.product_name,
    sku: r.sku || r.product_slug || null,
    price: Number(r.unit_price || 0),
    quantity: Number(r.qty || 1),
    image: r.image_url || null,
  }));

  return {
    order,
    input: {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
      city: clean(addr.city || (order as any).shipping_city) || "Riyadh",
      country: normalizeCountry(addr.country_code || addr.country),
      address1: clean(addr.line1 || addr.street || addr.address) || clean(addr.shortAddressCode) || "",
      address2: clean(addr.line2 || addr.district),
      district: clean(addr.district),
      postcode: clean(addr.postcode || addr.postalCode || addr.zip),
      shortAddressCode: clean(addr.shortAddressCode),
      lat: addr.lat || order.shipping_lat || null,
      lon: addr.lon || addr.lng || order.shipping_lng || null,
      weight: Number((order as any).total_weight_kg || 1),
      codAmount: order.payment_method === "cod" ? Number(order.total) : 0,
      itemsCount,
      subtotal: Number(order.subtotal || order.total),
      totalValue: Number(order.total),
      shippingFee: Number(order.shipping_fee || 0),
      currency: order.currency || "SAR",
      notes: order.notes,
      items: lineItems,
    },
  };
}

export async function getOtoDeliveryOptionsForOrder(orderId: string) {
  const loaded = await loadOtoOrderInput(orderId);
  if (loaded.error || !loaded.input) return { ok: false, error: loaded.error || "Order not found" };

  try {
    await otoCreateOrder(loaded.input);
    const byOrder = await otoGetDeliveryFeeOptions(loaded.input.orderNumber);
    if (byOrder.options.length) return { ok: true, options: byOrder.options, raw: byOrder.raw };

    const byAddress = await otoCheckDeliveryFee({
      destinationCity: loaded.input.city,
      weight: loaded.input.weight,
      codAmount: loaded.input.codAmount,
      currency: loaded.input.currency,
    });
    return { ok: true, options: byAddress.options, raw: byAddress.raw };
  } catch (e: any) {
    return { ok: false, error: e?.message || "OTO delivery options failed" };
  }
}

export async function createOtoShipmentForOrder(
  orderId: string,
  createdBy?: string | null,
  deliveryOptionId?: string | null,
): Promise<{ ok: boolean; shipment?: any; otoResp?: any; options?: OtoDeliveryOption[]; error?: string }> {
  const loaded = await loadOtoOrderInput(orderId);
  if (loaded.error || !loaded.order || !loaded.input) return { ok: false, error: loaded.error || "Order not found" };
  const { order, input } = loaded;

  const isCod = order.payment_method === "cod";
  if (!isCod && order.payment_status !== "paid") {
    return { ok: false, error: "Shipment blocked until payment is confirmed" };
  }

  const existing = await supabaseAdmin
    .from("shipments")
    .select("*")
    .eq("order_id", orderId)
    .eq("carrier_code", "oto")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.data && existing.data.status !== "failed") {
    await (supabaseAdmin.from("orders") as any)
      .update({
        shipping_carrier: "oto",
        tracking_number: existing.data.tracking_number || null,
        tracking_url: existing.data.tracking_url || null,
        shipping_status: existing.data.status,
        oto_creation_error: null,
      })
      .eq("id", order.id);
    return { ok: true, shipment: existing.data };
  }

  const { data: claimed, error: claimError } = await (supabaseAdmin as any).rpc(
    "claim_oto_shipment_creation",
    { _order_id: order.id },
  );
  if (claimError) return { ok: false, error: `OTO claim failed: ${claimError.message}` };
  if (!claimed) return { ok: true, shipment: existing.data ?? undefined };

  let createOrderResp: any;
  let feeResp: any = null;
  let option: OtoDeliveryOption | undefined;
  let shipmentResp: any;

  try {
    createOrderResp = await otoCreateOrder(input, deliveryOptionId);
    const orderFees = await otoGetDeliveryFeeOptions(input.orderNumber);
    feeResp = orderFees.raw;
    option = deliveryOptionId
      ? orderFees.options.find((o) => o.deliveryOptionId === deliveryOptionId) ||
        ({ deliveryOptionId, name: "Selected OTO option", price: null, raw: {} } as OtoDeliveryOption)
      : chooseDeliveryOption(orderFees.options);

    if (!option) {
      const addressFees = await otoCheckDeliveryFee({
        destinationCity: input.city,
        weight: input.weight,
        codAmount: input.codAmount,
        currency: input.currency,
      });
      feeResp = addressFees.raw;
      option = deliveryOptionId
        ? addressFees.options.find((o) => o.deliveryOptionId === deliveryOptionId) ||
          ({ deliveryOptionId, name: "Selected OTO option", price: null, raw: {} } as OtoDeliveryOption)
        : chooseDeliveryOption(addressFees.options);
    }

    if (!option?.deliveryOptionId) {
      throw new Error("OTO did not return any usable delivery option");
    }

    shipmentResp = await otoCreateShipment(input.orderNumber, option.deliveryOptionId);
  } catch (e: any) {
    const message = e?.message || "OTO request failed";
    await (supabaseAdmin.from("orders") as any)
      .update({ oto_creation_error: message.slice(0, 500) })
      .eq("id", order.id);
    return { ok: false, options: option ? [option] : undefined, error: message };
  }

  const statusResp = await otoGetOrderStatus(String(shipmentResp?.otoId || input.orderNumber)).catch(() => null);
  const mergedResp = { createOrder: createOrderResp, deliveryFee: feeResp, createShipment: shipmentResp, status: statusResp };
  const trackingNumber: string | undefined =
    statusResp?.trackingNumber ||
    statusResp?.dcTrackingNumber ||
    shipmentResp?.tracking_number ||
    shipmentResp?.awb ||
    shipmentResp?.otoId ||
    createOrderResp?.otoId;
  const trackingUrl: string | undefined =
    statusResp?.trackingUrl ||
    shipmentResp?.tracking_url ||
    shipmentResp?.trackingLink ||
    shipmentResp?.label_url;
  const awbUrl: string | undefined =
    statusResp?.printAWBURL || shipmentResp?.label_url || shipmentResp?.awb_url;

  const addr: any = order.shipping_address || {};
  const shipmentValues = {
    order_id: order.id,
    order_number: order.order_number,
    carrier_code: "oto",
    status: trackingNumber || awbUrl ? "label_created" : "processing",
    tracking_number: trackingNumber ? String(trackingNumber) : null,
    tracking_url: trackingUrl || null,
    awb_url: awbUrl || null,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_email: order.customer_email,
    shipping_address: addr,
    city: input.city || null,
    country_code: input.country || "SA",
    weight_kg: Number(input.weight || 1),
    dimensions: {
      width: asNumber(process.env.OTO_DEFAULT_BOX_WIDTH_CM, 10) || 10,
      length: asNumber(process.env.OTO_DEFAULT_BOX_LENGTH_CM, 10) || 10,
      height: asNumber(process.env.OTO_DEFAULT_BOX_HEIGHT_CM, 10) || 10,
      unit: "cm",
    },
    declared_value: Number(order.total),
    cod_amount: isCod ? Number(order.total) : 0,
    shipping_fee: Number(option?.price ?? order.shipping_fee ?? 0),
    raw_response: mergedResp,
    metadata: {
      deliveryOptionId: option?.deliveryOptionId,
      deliveryCompanyName: option?.name,
      deliveryOption: option?.raw,
      needToVerifyCrDocStatus: option?.needToVerifyCrDocStatus,
      pickupDropOff: option?.pickupDropOff,
    },
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
    return { ok: false, otoResp: mergedResp, error: message };
  }

  const { error: orderUpdateError } = await (supabaseAdmin.from("orders") as any)
    .update({
      shipping_carrier: "oto",
      tracking_number: trackingNumber ? String(trackingNumber) : null,
      tracking_url: trackingUrl || null,
      shipping_status: shipmentValues.status,
      oto_creation_error: null,
    })
    .eq("id", order.id);
  if (orderUpdateError) return { ok: false, shipment, otoResp: mergedResp, error: orderUpdateError.message };

  return { ok: true, shipment, otoResp: mergedResp, options: option ? [option] : undefined };
}
