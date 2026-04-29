/**
 * Webhooks server library
 * - HMAC-SHA256 signing
 * - Exponential backoff retries (1m, 5m, 30m, 2h, 12h — max 5 attempts)
 * - Per-delivery logging
 * - Idempotency via delivery id
 *
 * Server-only — uses service-role client to bypass RLS for system writes.
 */
import { createHmac, timingSafeEqual, randomBytes, createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const WEBHOOK_EVENTS = [
  "order.created",
  "order.paid",
  "order.cancelled",
  "order.shipped",
  "order.delivered",
  "payment.succeeded",
  "payment.failed",
  "shipment.created",
  "shipment.updated",
  "inventory.low",
  "customer.created",
  "cart.abandoned",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const RETRY_DELAYS_SEC = [60, 300, 1800, 7200, 43200]; // 1m, 5m, 30m, 2h, 12h
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

/** Compute HMAC-SHA256 signature for a payload. */
export function signPayload(secret: string, body: string, timestamp: number): string {
  const data = `${timestamp}.${body}`;
  return createHmac("sha256", secret).update(data).digest("hex");
}

/** Constant-time signature verification (for inbound webhooks). */
export function verifySignature(
  secret: string,
  body: string,
  header: string | null,
  toleranceSec = 300,
): boolean {
  if (!header) return false;
  // Format: "t=<ts>,v1=<sig>"
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v?.trim() ?? ""];
    }),
  );
  const ts = Number(parts.t);
  const sig = parts.v1;
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = signPayload(secret, body, ts);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Generate a new API key (returned once at creation). */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("base64url");
  const key = `mn_live_${raw}`;
  const hash = createHash("sha256").update(key).digest("hex");
  return { key, hash, prefix: key.slice(0, 12) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Fetch endpoints subscribed to an event and create delivery records.
 * Then attempt immediate delivery (fire-and-forget).
 */
export async function emitEvent(eventType: WebhookEvent, payload: Record<string, any>) {
  const { data: endpoints } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, url, secret, events, enabled")
    .eq("enabled", true)
    .contains("events", [eventType]);

  if (!endpoints?.length) return { dispatched: 0 };

  const eventId = crypto.randomUUID();
  const inserts = endpoints.map((ep) => ({
    endpoint_id: ep.id,
    event_type: eventType,
    event_id: eventId,
    payload: { event: eventType, id: eventId, created_at: new Date().toISOString(), data: payload } as any,
    attempt: 1,
    max_attempts: MAX_ATTEMPTS,
    status: "pending",
  }));

  const { data: deliveries } = await supabaseAdmin
    .from("webhook_deliveries")
    .insert(inserts)
    .select("id");

  // Fire deliveries (don't await so caller returns fast)
  if (deliveries) {
    Promise.all(deliveries.map((d) => attemptDelivery(d.id))).catch(() => {});
  }
  return { dispatched: deliveries?.length ?? 0 };
}

/** Attempt a single delivery; updates record with result; schedules retry on failure. */
export async function attemptDelivery(deliveryId: string): Promise<void> {
  const { data: del } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, endpoint_id, event_type, payload, attempt, max_attempts")
    .eq("id", deliveryId)
    .single();
  if (!del) return;

  const { data: ep } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("url, secret, enabled")
    .eq("id", del.endpoint_id!)
    .single();
  if (!ep || !ep.enabled) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({ status: "failed", error_message: "Endpoint disabled or missing" })
      .eq("id", del.id);
    return;
  }

  const body = JSON.stringify(del.payload);
  const ts = Math.floor(Date.now() / 1000);
  const signature = signPayload(ep.secret ?? "", body, ts);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": del.event_type,
        "X-Webhook-Delivery": del.id,
        "X-Webhook-Signature": `t=${ts},v1=${signature}`,
        "User-Agent": "Maisonnet-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseText = (await res.text().catch(() => "")).slice(0, 2000);
    const ok = res.status >= 200 && res.status < 300;

    if (ok) {
      await supabaseAdmin
        .from("webhook_deliveries")
        .update({
          status: "success",
          http_status: res.status,
          response_body: responseText,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", del.id);
      await supabaseAdmin
        .from("webhook_endpoints")
        .update({
          last_delivery_at: new Date().toISOString(),
          last_delivery_status: res.status,
          failure_count: 0,
        })
        .eq("id", del.endpoint_id!);
    } else {
      await scheduleRetry(del.id, del.attempt, del.max_attempts, `HTTP ${res.status}: ${responseText}`);
      await supabaseAdmin
        .from("webhook_endpoints")
        .update({
          last_delivery_at: new Date().toISOString(),
          last_delivery_status: res.status,
          failure_count: (del.attempt ?? 0) + 1,
        })
        .eq("id", del.endpoint_id!);
    }
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    await scheduleRetry(del.id, del.attempt, del.max_attempts, msg);
  }
}

async function scheduleRetry(
  deliveryId: string,
  attempt: number,
  maxAttempts: number,
  errorMessage: string,
) {
  if (attempt >= maxAttempts) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({ status: "dead", error_message: errorMessage })
      .eq("id", deliveryId);
    return;
  }
  const delaySec = RETRY_DELAYS_SEC[attempt - 1] ?? RETRY_DELAYS_SEC.at(-1)!;
  const next = new Date(Date.now() + delaySec * 1000).toISOString();
  await supabaseAdmin
    .from("webhook_deliveries")
    .update({
      status: "retrying",
      next_retry_at: next,
      error_message: errorMessage,
      attempt: attempt + 1,
    })
    .eq("id", deliveryId);
}

/** Cron-callable: process retries that are due. */
export async function processRetries(limit = 50): Promise<{ processed: number }> {
  const { data: due } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id")
    .eq("status", "retrying")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (!due?.length) return { processed: 0 };
  await Promise.all(due.map((d) => attemptDelivery(d.id)));
  return { processed: due.length };
}

/** Authenticate inbound API request via Bearer key, returns key record + scopes. */
export async function authenticateApiKey(authHeader: string | null): Promise<{
  ok: boolean;
  keyId?: string;
  scopes?: string[];
  error?: string;
}> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Missing bearer token" };
  }
  const key = authHeader.slice(7).trim();
  if (!key) return { ok: false, error: "Empty key" };

  const hash = hashApiKey(key);
  const { data: rec } = await supabaseAdmin
    .from("api_keys")
    .select("id, scopes, is_active, expires_at, rate_limit_per_minute")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!rec || !rec.is_active) return { ok: false, error: "Invalid key" };
  if (rec.expires_at && new Date(rec.expires_at) < new Date())
    return { ok: false, error: "Key expired" };

  // Update last_used (fire-and-forget)
  supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", rec.id).then(() => {});

  return { ok: true, keyId: rec.id, scopes: rec.scopes ?? [] };
}

export async function logApiRequest(input: {
  apiKeyId?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip?: string;
  userAgent?: string;
  error?: string;
}) {
  await supabaseAdmin.from("api_request_logs").insert({
    api_key_id: input.apiKeyId,
    method: input.method,
    path: input.path,
    status_code: input.statusCode,
    duration_ms: input.durationMs,
    ip_address: input.ip,
    user_agent: input.userAgent,
    error: input.error,
  });
}

export function hasScope(scopes: string[] | undefined, required: string): boolean {
  if (!scopes) return false;
  return scopes.includes("*") || scopes.includes(required);
}
