// Client-callable server functions for the notifications center.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  const { data: isSuper } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isAdmin && !isSuper) throw new Error("Forbidden");
}

// Save provider credentials (encrypts api_key + webhook_secret).
export const saveProviderCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    provider_code: string;
    api_url?: string;
    api_key?: string;
    instance_id?: string;
    session_name?: string;
    phone_number_id?: string;
    webhook_secret?: string;
    timeout_ms?: number;
    retry_attempts?: number;
    retry_delay_ms?: number;
    ssl_verify?: boolean;
    extra?: Record<string, any>;
    enable_provider?: boolean;
  }) =>
    z
      .object({
        provider_code: z.string().min(1),
        api_url: z.string().max(500).optional(),
        api_key: z.string().max(2000).optional(),
        instance_id: z.string().max(200).optional(),
        session_name: z.string().max(200).optional(),
        phone_number_id: z.string().max(200).optional(),
        webhook_secret: z.string().max(500).optional(),
        timeout_ms: z.number().int().min(1000).max(120000).optional(),
        retry_attempts: z.number().int().min(0).max(10).optional(),
        retry_delay_ms: z.number().int().min(100).max(600000).optional(),
        ssl_verify: z.boolean().optional(),
        extra: z.record(z.string(), z.any()).optional(),
        enable_provider: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./crypto.server");

    const { data: provider } = await supabaseAdmin
      .from("notif_providers")
      .select("id")
      .eq("code", data.provider_code)
      .maybeSingle();
    if (!provider) throw new Error("Provider not found");

    const patch: any = {
      provider_id: provider.id,
      api_url: data.api_url ?? null,
      instance_id: data.instance_id ?? null,
      session_name: data.session_name ?? null,
      phone_number_id: data.phone_number_id ?? null,
      timeout_ms: data.timeout_ms ?? 15000,
      retry_attempts: data.retry_attempts ?? 3,
      retry_delay_ms: data.retry_delay_ms ?? 5000,
      ssl_verify: data.ssl_verify ?? true,
      extra: data.extra ?? {},
    };
    if (data.api_key && data.api_key.trim().length > 0) {
      patch.api_key_encrypted = await encryptSecret(data.api_key);
    }
    if (data.webhook_secret && data.webhook_secret.trim().length > 0) {
      patch.webhook_secret_encrypted = await encryptSecret(data.webhook_secret);
    }

    await supabaseAdmin
      .from("notif_provider_credentials")
      .upsert(patch, { onConflict: "provider_id" });

    if (data.enable_provider != null) {
      await supabaseAdmin
        .from("notif_providers")
        .update({ is_enabled: data.enable_provider })
        .eq("id", provider.id);
    }

    return { ok: true };
  });

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; body: string }) =>
    z.object({ to: z.string().min(6).max(32), body: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { sendTestMessage } = await import("./engine.server");
    return await sendTestMessage(data.to, data.body);
  });

export const checkProviderHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runProviderHealthCheck } = await import("./engine.server");
    return await runProviderHealthCheck();
  });

export const processQueueNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { processQueueBatch } = await import("./engine.server");
    return await processQueueBatch(50);
  });

export const retryQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notif_queue")
      .update({
        status: "pending",
        attempts: 0,
        last_error: null,
        locked_at: null,
        scheduled_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true };
  });

// Load current provider settings for the admin form (never returns raw api_key).
export const getProviderSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider_code: string }) =>
    z.object({ provider_code: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: provider } = await supabaseAdmin
      .from("notif_providers")
      .select("*")
      .eq("code", data.provider_code)
      .maybeSingle();
    if (!provider) return { provider: null, credentials: null, health: null };
    const { data: creds } = await supabaseAdmin
      .from("notif_provider_credentials")
      .select("*")
      .eq("provider_id", provider.id)
      .maybeSingle();
    const { data: health } = await supabaseAdmin
      .from("notif_provider_health")
      .select("*")
      .eq("provider_id", provider.id)
      .maybeSingle();
    return {
      provider,
      credentials: creds
        ? {
            api_url: creds.api_url,
            has_api_key: !!creds.api_key_encrypted,
            instance_id: creds.instance_id,
            session_name: creds.session_name,
            phone_number_id: creds.phone_number_id,
            has_webhook_secret: !!creds.webhook_secret_encrypted,
            timeout_ms: creds.timeout_ms,
            retry_attempts: creds.retry_attempts,
            retry_delay_ms: creds.retry_delay_ms,
            ssl_verify: creds.ssl_verify,
            extra: creds.extra,
          }
        : null,
      health,
    };
  });
