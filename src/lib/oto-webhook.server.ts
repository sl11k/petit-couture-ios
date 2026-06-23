// Server-only OTO webhook registration helpers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOtoAccessToken } from "@/lib/oto.server";
import {
  buildOtoRegistrationBody,
  computeOtoSignature,
  buildOtoSignatureBase,
  normalizeOtoPayload,
} from "@/lib/oto-webhook";

const OTO_BASE = process.env.OTO_API_BASE_URL || "https://api.tryoto.com/rest/v2";

export type RegisterableType = "orderStatus" | "shipmentError" | "newOrders";

export interface RegisterInput {
  webhookType: RegisterableType;
  endpointUrl: string;
  orderPrefix?: string;
  timestampFormat?: string;
  useSecret?: boolean;
  useAuth?: boolean;
  userId?: string | null;
}

export interface RegisterOutput {
  ok: boolean;
  httpStatus: number | null;
  otoWebhookId: string | null;
  response: Record<string, any> | null;
  error: string | null;
}

export async function registerOtoWebhookServer(input: RegisterInput): Promise<RegisterOutput> {
  const secretKey = input.useSecret ? process.env.OTO_WEBHOOK_SECRET_KEY : undefined;
  const authorizationKey = input.useAuth
    ? process.env.OTO_WEBHOOK_AUTHORIZATION_KEY
    : undefined;

  const body = buildOtoRegistrationBody({
    webhookType: input.webhookType,
    endpointUrl: input.endpointUrl,
    orderPrefix: input.orderPrefix,
    timestampFormat: input.timestampFormat,
    secretKey,
    authorizationKey,
  });

  const insertReg = (row: Record<string, any>) =>
    supabaseAdmin.from("oto_webhook_registrations").insert(row as never);

  let token: string;
  try {
    token = await getOtoAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to obtain OTO token";
    await insertReg({
      webhook_type: input.webhookType,
      endpoint_url: input.endpointUrl,
      status: "error",
      request_body: body,
      error_message: msg,
      created_by: input.userId ?? null,
    });
    return { ok: false, httpStatus: null, otoWebhookId: null, response: null, error: msg };
  }

  let res: Response;
  try {
    res = await fetch(`${OTO_BASE}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    await insertReg({
      webhook_type: input.webhookType,
      endpoint_url: input.endpointUrl,
      status: "error",
      request_body: body,
      error_message: msg,
      created_by: input.userId ?? null,
    });
    return { ok: false, httpStatus: null, otoWebhookId: null, response: null, error: msg };
  }

  const text = await res.text();
  let response: Record<string, any> | null = null;
  try {
    response = text ? (JSON.parse(text) as Record<string, any>) : null;
  } catch {
    response = { raw: text.slice(0, 2000) };
  }

  const ok = res.ok;
  const r = response ?? {};
  const otoWebhookId =
    (r.id as string | undefined) ||
    (r.webhook_id as string | undefined) ||
    (r.webhookId as string | undefined) ||
    null;

  await insertReg({
    webhook_type: input.webhookType,
    endpoint_url: input.endpointUrl,
    oto_webhook_id: otoWebhookId,
    status: ok ? "registered" : "error",
    request_body: body,
    response,
    error_message: ok ? null : `HTTP ${res.status}`,
    created_by: input.userId ?? null,
    last_registered_at: ok ? new Date().toISOString() : null,
  });

  return {
    ok,
    httpStatus: res.status,
    otoWebhookId,
    response,
    error: ok ? null : `HTTP ${res.status}`,
  };
}

export async function listRegistrationsServer() {
  const { data, error } = await supabaseAdmin
    .from("oto_webhook_registrations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listOtoDeliveriesServer(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from("oto_webhook_deliveries")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export interface SecretsStatus {
  apiToken: boolean;
  secretKey: boolean;
  authorizationKey: boolean;
  secretKeyMask: string;
  authorizationKeyMask: string;
  apiBaseUrl: string;
  allowUnsigned: boolean;
}

function mask(v?: string) {
  if (!v) return "—";
  if (v.length <= 4) return "••••";
  return `••••${v.slice(-4)}`;
}

export function readSecretsStatus(): SecretsStatus {
  const apiToken =
    Boolean(process.env.OTO_API_TOKEN) || Boolean(process.env.OTO_REFRESH_TOKEN);
  const secretKey = process.env.OTO_WEBHOOK_SECRET_KEY;
  const authKey = process.env.OTO_WEBHOOK_AUTHORIZATION_KEY;
  return {
    apiToken,
    secretKey: Boolean(secretKey),
    authorizationKey: Boolean(authKey),
    secretKeyMask: mask(secretKey),
    authorizationKeyMask: mask(authKey),
    apiBaseUrl: OTO_BASE,
    allowUnsigned: process.env.OTO_ALLOW_UNSIGNED === "1",
  };
}

export interface LocalTestOutput {
  ok: boolean;
  httpStatus: number | null;
  responseText: string;
  errorMessage: string | null;
  elapsedMs: number;
  sentBody: Record<string, any>;
}

export async function sendLocalOtoTestServer(input: {
  kind: "orderStatus" | "shipmentError";
  endpointUrl: string;
}): Promise<LocalTestOutput> {
  const ts = new Date().toISOString();
  const orderId = `TEST-${Date.now()}`;
  const base: Record<string, any> =
    input.kind === "orderStatus"
      ? { orderId, status: "inTransit", timestamp: ts, trackingNumber: `OTO-${orderId}` }
      : { orderId, errorCode: "DC_NOT_AVAILABLE", errorMessage: "Test error", timestamp: ts };

  const secretKey = process.env.OTO_WEBHOOK_SECRET_KEY;
  let body: Record<string, any> = { ...base };
  if (secretKey) {
    const normalized = normalizeOtoPayload(body);
    const sigBase = buildOtoSignatureBase(normalized);
    if (sigBase) {
      body = { ...body, signature: computeOtoSignature(sigBase, secretKey) };
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authKey = process.env.OTO_WEBHOOK_AUTHORIZATION_KEY;
  if (authKey) headers["Authorization"] = `Bearer ${authKey}`;

  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let responseText = "";
  let errorMessage: string | null = null;
  try {
    const res = await fetch(input.endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    httpStatus = res.status;
    responseText = (await res.text()).slice(0, 2000);
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Network error";
  }

  return {
    ok: errorMessage == null,
    httpStatus,
    responseText,
    errorMessage,
    elapsedMs: Date.now() - startedAt,
    sentBody: body,
  };
}

export async function assertAdminUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data || []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Error("Forbidden: admin role required");
  }
}
