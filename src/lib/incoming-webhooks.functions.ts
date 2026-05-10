import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KIND = z.enum(["shipping", "payment"]);

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
} as const;

const BASE_URL = "https://lppme.trendify.sa";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data || []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Error("Forbidden: admin role required");
  }
}

export const sendTestIncomingWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: KIND,
        payload: z.record(z.any()).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertAdmin(userId);

    const cfg = ENDPOINT_MAP[data.kind];
    const secret = process.env[cfg.secretEnv];
    if (!secret) throw new Error(`Missing ${cfg.secretEnv}`);

    const payload =
      data.payload || {
        carrier_code: "test",
        provider: "test",
        event_type: "test",
        status: "in_transit",
        tracking_number: "TEST-" + Date.now(),
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
      if (!res.ok) errorMessage = `HTTP ${res.status}`;
    } catch (e: any) {
      errorMessage = e?.message || "Network error";
    }

    const elapsed = Date.now() - startedAt;

    // Log into webhook_deliveries for visibility on the deliveries page
    const { data: row } = await supabaseAdmin
      .from("webhook_deliveries")
      .insert({
        endpoint_id: null,
        event_type: cfg.eventType,
        event_id: crypto.randomUUID(),
        payload: { url, request: payload, elapsed_ms: elapsed, triggered_by: userId },
        attempt: 1,
        max_attempts: 1,
        status,
        http_status: httpStatus,
        response_body: responseBody,
        error_message: errorMessage,
        delivered_at: status === "success" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    return {
      ok: status === "success",
      httpStatus,
      responseBody,
      errorMessage,
      deliveryId: row?.id ?? null,
      url,
      elapsedMs: elapsed,
    };
  });

export const revealIncomingWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: KIND,
        password: z.string().min(1, "Password required"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    await assertAdmin(userId);

    // Prefer email from JWT claims; fall back to admin.getUserById
    let email: string | undefined = claims?.email;
    if (!email) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      email = u?.user?.email ?? undefined;
    }
    if (!email) throw new Error("تعذّر تحديد بريد المسؤول");

    // Verify password by attempting a fresh sign-in with publishable key
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("إعدادات السيرفر ناقصة (SUPABASE_URL/PUBLISHABLE_KEY)");
    }
    const verifier = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signErr } = await verifier.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (signErr) {
      console.error("[reveal] password verify failed:", signErr.message);
      throw new Error("كلمة المرور غير صحيحة");
    }

    const cfg = ENDPOINT_MAP[data.kind];
    const secret = process.env[cfg.secretEnv];
    if (!secret) throw new Error(`Missing ${cfg.secretEnv}`);

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      actor_email: email,
      action: "secret.reveal",
      entity: "incoming_webhook_secret",
      entity_id: cfg.secretEnv,
      metadata: { kind: data.kind },
    });

    return { secret };
  });
