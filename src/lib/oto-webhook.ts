// OTO webhook utilities (pure, server-safe).
//
// IMPORTANT: OTO does not use the generic `X-Webhook-Signature` HMAC-of-body scheme.
// OTO embeds a `signature` field INSIDE the JSON payload. The signature is
// HmacSHA256 of a small base string, Base64-encoded.
//
// Per OTO's documented behavior:
//   orderStatus    base = `${orderId}:${status}:${timestamp}`
//   shipmentError  base = `${orderId}:${errorCode}:${timestamp}`
//
// TODO(vendor-confirm): final wording of the base string varies between OTO
// integrations; founder must confirm with OTO support before relying on
// signature verification in production. Until confirmed, set OTO_ALLOW_UNSIGNED=1
// to log-and-accept inbound deliveries.

import { createHmac, timingSafeEqual } from "crypto";

export type OtoWebhookKind = "orderStatus" | "shipmentError" | "newOrders" | "unknown";

export interface OtoOrderStatusPayload {
  kind: "orderStatus";
  orderId: string;
  status: string;
  dcStatus?: string;
  note?: string;
  trackingNumber?: string;
  dcTrackingNumber?: string;
  trackingUrl?: string;
  printAWBURL?: string;
  deliveryCompany?: string;
  driverName?: string;
  driverPhone?: string;
  driverEmail?: string;
  driverId?: string;
  pickupLocationCode?: string;
  timestamp: string;
  signature?: string;
  raw: Record<string, unknown>;
}

export interface OtoShipmentErrorPayload {
  kind: "shipmentError";
  orderId: string;
  errorCode: string;
  errorMessage?: string;
  deliveryCompany?: string;
  deliveryCompanyResponse?: string;
  timestamp: string;
  signature?: string;
  raw: Record<string, unknown>;
}

export interface OtoNewOrdersPayload {
  kind: "newOrders";
  orderId?: string;
  timestamp: string;
  signature?: string;
  raw: Record<string, unknown>;
}

export type NormalizedOtoPayload =
  | OtoOrderStatusPayload
  | OtoShipmentErrorPayload
  | OtoNewOrdersPayload
  | { kind: "unknown"; raw: Record<string, unknown> };

const str = (v: unknown): string | undefined => (v == null ? undefined : String(v));

export function detectOtoKind(payload: Record<string, unknown>): OtoWebhookKind {
  if (payload.errorCode != null || payload.errorMessage != null) return "shipmentError";
  if (payload.status != null && payload.orderId != null) return "orderStatus";
  if (payload.event === "newOrders" || payload.webhookType === "newOrders") return "newOrders";
  return "unknown";
}

export function normalizeOtoPayload(payload: Record<string, unknown>): NormalizedOtoPayload {
  const kind = detectOtoKind(payload);
  const timestamp = str(payload.timestamp) ?? new Date().toISOString();

  if (kind === "orderStatus") {
    return {
      kind,
      orderId: String(payload.orderId ?? ""),
      status: String(payload.status ?? ""),
      dcStatus: str(payload.dcStatus),
      note: str(payload.note),
      trackingNumber: str(payload.trackingNumber),
      dcTrackingNumber: str(payload.dcTrackingNumber),
      trackingUrl: str(payload.trackingUrl),
      printAWBURL: str(payload.printAWBURL),
      deliveryCompany: str(payload.deliveryCompany),
      driverName: str(payload.driverName),
      driverPhone: str(payload.driverPhone),
      driverEmail: str(payload.driverEmail),
      driverId: str(payload.driverId),
      pickupLocationCode: str(payload.pickupLocationCode),
      timestamp,
      signature: str(payload.signature),
      raw: payload,
    };
  }
  if (kind === "shipmentError") {
    return {
      kind,
      orderId: String(payload.orderId ?? ""),
      errorCode: String(payload.errorCode ?? ""),
      errorMessage: str(payload.errorMessage),
      deliveryCompany: str(payload.deliveryCompany),
      deliveryCompanyResponse: str(payload.deliveryCompanyResponse),
      timestamp,
      signature: str(payload.signature),
      raw: payload,
    };
  }
  if (kind === "newOrders") {
    return {
      kind,
      orderId: str(payload.orderId),
      timestamp,
      signature: str(payload.signature),
      raw: payload,
    };
  }
  return { kind: "unknown", raw: payload };
}

export function buildOtoSignatureBase(p: NormalizedOtoPayload): string | null {
  if (p.kind === "orderStatus") return `${p.orderId}:${p.status}:${p.timestamp}`;
  if (p.kind === "shipmentError") return `${p.orderId}:${p.errorCode}:${p.timestamp}`;
  return null;
}

export function computeOtoSignature(base: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(base).digest("base64");
}

/**
 * Verify the in-body OTO signature.
 * Returns false (not throws) on any structural problem so the caller can log it.
 */
export function verifyOtoWebhookSignature(
  payload: NormalizedOtoPayload,
  secretKey: string,
): boolean {
  const base = buildOtoSignatureBase(payload);
  if (!base) return false;
  const sig = (payload as { signature?: string }).signature;
  if (!sig) return false;
  try {
    const expected = computeOtoSignature(base, secretKey);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Map OTO status -> internal shipment status.
// Preserve the original value via the second tuple item (callers store it in metadata).
export type InternalShipmentStatus =
  | "processing"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "failed"
  | "cancelled"
  | "unknown";

export function mapOtoStatus(otoStatus: string | undefined | null): InternalShipmentStatus {
  const s = (otoStatus || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (!s) return "unknown";
  if (s.includes("delivered")) return "delivered";
  if (s.includes("outfordelivery")) return "out_for_delivery";
  if (s.includes("intransit") || s.includes("transit")) return "in_transit";
  if (s.includes("pickedup") || s === "pickup") return "picked_up";
  if (s.includes("processing") || s.includes("shipmentprocessing") || s.includes("created"))
    return "processing";
  if (s.includes("returned") || s.includes("return")) return "returned";
  if (
    s.includes("cancel") ||
    s.includes("cancelled") ||
    s.includes("canceled")
  )
    return "cancelled";
  if (
    s.includes("shipmenterror") ||
    s.includes("failed") ||
    s.includes("error") ||
    s.includes("exception")
  )
    return "failed";
  return "unknown";
}

// Pure builder for the body sent to OTO when registering a webhook.
export interface BuildRegistrationBodyInput {
  webhookType: "orderStatus" | "shipmentError" | "newOrders";
  endpointUrl: string;
  orderPrefix?: string;
  timestampFormat?: string;
  secretKey?: string;
  authorizationKey?: string;
  method?: "post" | "get";
}

export function buildOtoRegistrationBody(input: BuildRegistrationBodyInput) {
  const body: Record<string, unknown> = {
    method: input.method ?? "post",
    url: input.endpointUrl,
    webhookType: input.webhookType,
  };
  if (input.orderPrefix) body.orderPrefix = input.orderPrefix;
  if (input.timestampFormat) body.timestampFormat = input.timestampFormat;
  if (input.secretKey) body.secretKey = input.secretKey;
  if (input.authorizationKey) body.authorizationKey = input.authorizationKey;
  return body;
}

export function maskSecret(value: string | undefined | null): string {
  if (!value) return "—";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
