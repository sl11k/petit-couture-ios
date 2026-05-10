import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

export type IncomingWebhookKind = "shipping" | "payment";

const ENDPOINT_MAP = {
  shipping: {
    path: "/api/public/shipping-webhook",
    secretEnv: "SHIPPING_WEBHOOK_SECRET",
    eventType: "incoming.test.shipping",
  },
  payment: {
    path: "/api/public/payment-webhook",
    secretEnv: "PAYMENT_WEBHOOK_SECRET",
    eventType: "incoming.test.payment",
  },
} as const satisfies Record<IncomingWebhookKind, {
  path: string;
  secretEnv: string;
  eventType: string;
}>;

const BASE_URL = "https://lppme.trendify.sa";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const roles = (data || []).map((row) => row.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Error("Forbidden: admin role required");
  }
}

async function resolveAdminEmail(userId: string, claimedEmail?: string) {
  if (claimedEmail) return claimedEmail;

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw new Error("تعذّر قراءة بيانات المسؤول");

  const email = data.user?.email;
  if (!email) throw new Error("تعذّر تحديد بريد المسؤول");

  return email;
}

function getWebhookSecret(kind: IncomingWebhookKind) {
  const cfg = ENDPOINT_MAP[kind];
  const secret = process.env[cfg.secretEnv];

  if (!secret) {
    console.error("[incoming-webhooks] missing secret env", {
      kind,
      secretEnv: cfg.secretEnv,
    });
    throw new Error(`Missing ${cfg.secretEnv}`);
  }

  return { cfg, secret };
}

export async function sendTestIncomingWebhookServer(input: {
  kind: IncomingWebhookKind;
  payload?: Record<string, unknown>;
  userId: string;
}) {
  await assertAdmin(input.userId);

  const { cfg, secret } = getWebhookSecret(input.kind);

  const payload =
    input.payload || {
      carrier_code: "test",
      provider: "test",
      event_type: "test",
      status: "in_transit",
      tracking_number: `TEST-${Date.now()}`,
      order_number: "TEST-ORDER",
      amount: 1,
      currency: "SAR",
      reference: "test-ref",
      occurred_at: new Date().toISOString(),
      _test: true,
    };

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const url = BASE_URL + cfg.path;
  const startedAt = Date.now();

  let httpStatus: number | null = null;
  let responseBody = "";
  let errorMessage: string | null = null;
  let status: "success" | "failed" = "failed";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "User-Agent": "lppme-test-webhook/1.0",
      },
      body,
    });

    httpStatus = res.status;
    responseBody = (await res.text()).slice(0, 2000);
    status = res.ok ? "success" : "failed";

    if (!res.ok) {
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Network error";
  }

  const elapsed = Date.now() - startedAt;

  const deliveryPayload: Json = {
    url,
    request: JSON.parse(body) as Json,
    elapsed_ms: elapsed,
    triggered_by: input.userId,
  };

  const deliveryRow: Database["public"]["Tables"]["webhook_deliveries"]["Insert"] = {
    endpoint_id: null,
    event_type: cfg.eventType,
    event_id: randomUUID(),
    payload: deliveryPayload,
    attempt: 1,
    max_attempts: 1,
    status,
    http_status: httpStatus,
    response_body: responseBody,
    error_message: errorMessage,
    delivered_at: status === "success" ? new Date().toISOString() : null,
  };

  const { data: row, error: insertError } = await supabaseAdmin
    .from("webhook_deliveries")
    .insert(deliveryRow)
    .select()
    .single();

  if (insertError) {
    console.error("[incoming-webhooks] failed to insert delivery log", insertError);
  }

  return {
    ok: status === "success",
    httpStatus,
    responseBody,
    errorMessage,
    deliveryId: row?.id ?? null,
    url,
    elapsedMs: elapsed,
  };
}

export async function revealIncomingWebhookSecretServer(input: {
  kind: IncomingWebhookKind;
  password: string;
  userId: string;
  claimedEmail?: string;
}) {
  await assertAdmin(input.userId);

  const email = await resolveAdminEmail(input.userId, input.claimedEmail);
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("إعدادات التحقق غير مكتملة على الخادم");
  }

  const verifier = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signInError } = await verifier.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signInError) {
    console.error("[incoming-webhooks] password verification failed", {
      kind: input.kind,
      userId: input.userId,
      message: signInError.message,
    });
    throw new Error("كلمة المرور غير صحيحة");
  }

  const { cfg, secret } = getWebhookSecret(input.kind);

  const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: input.userId,
    actor_email: email,
    action: "secret.reveal",
    entity: "incoming_webhook_secret",
    entity_id: cfg.secretEnv,
    metadata: { kind: input.kind },
  });

  if (auditError) {
    console.error("[incoming-webhooks] audit log insert failed", auditError);
  }

  console.info("[incoming-webhooks] secret revealed", {
    kind: input.kind,
    userId: input.userId,
    hasSecret: Boolean(secret),
  });

  return { secret };
}