// Server-only notification engine. Enqueues, renders, dispatches, logs.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./crypto.server";
import { getProvider } from "./providers";
import type { ProviderCredentials } from "./providers/types";
import { renderTemplate } from "./template";

export type Audience = "customer" | "admin" | "both";
export type Channel = "whatsapp" | "sms" | "email";

export interface EnqueueParams {
  event_code: string;
  audience?: Audience;
  channel?: Channel;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  recipient_user_id?: string | null;
  language?: string;
  variables?: Record<string, any>;
  priority?: number;
  related_entity?: string;
  related_entity_id?: string;
  scheduled_at?: string;
  dedupe_key?: string;
}

/**
 * Enqueue a notification (fire-and-forget). Never throws — logs on failure.
 * Emits one queue row per resolved recipient (customer + admin recipients).
 */
export async function enqueueNotification(params: EnqueueParams): Promise<void> {
  try {
    const channel: Channel = params.channel || "whatsapp";
    const language = params.language || "ar";

    // Load event type
    const { data: event } = await supabaseAdmin
      .from("notif_event_types")
      .select("*")
      .eq("code", params.event_code)
      .maybeSingle();
    if (!event) {
      console.warn(`[notif] unknown event_code: ${params.event_code}`);
      return;
    }
    if (event.is_enabled === false) return;

    const audience: Audience = params.audience || (event.audience as Audience) || "customer";
    const priority = params.priority ?? event.priority ?? 5;
    const scheduledAt =
      params.scheduled_at ??
      (event.delay_seconds
        ? new Date(Date.now() + event.delay_seconds * 1000).toISOString()
        : new Date().toISOString());

    const rows: any[] = [];

    // Customer row(s)
    if ((audience === "customer" || audience === "both") && params.recipient_phone) {
      rows.push({
        event_code: params.event_code,
        audience: "customer",
        channel,
        recipient_phone: params.recipient_phone,
        recipient_email: params.recipient_email ?? null,
        recipient_user_id: params.recipient_user_id ?? null,
        language,
        payload: params.variables ?? {},
        priority,
        max_attempts: 3,
        scheduled_at: scheduledAt,
        dedupe_key: params.dedupe_key
          ? `${params.dedupe_key}:customer:${params.recipient_phone}`
          : null,
        related_entity: params.related_entity ?? null,
        related_entity_id: params.related_entity_id ?? null,
      });
    }

    // Admin row(s) — schedule at least 10s AFTER the customer message so the
    // WhatsApp provider's "account protection" rate limit (1 msg / few seconds)
    // does not reject the admin notification.
    if (audience === "admin" || audience === "both") {
      const { data: admins } = await supabaseAdmin
        .from("notif_admin_recipients")
        .select("id, phone, email, events, is_enabled")
        .eq("is_enabled", true);
      const matching = (admins ?? []).filter(
        (a: any) =>
          !a.events || a.events.length === 0 || a.events.includes(params.event_code),
      );
      const baseTime = new Date(scheduledAt).getTime();
      matching.forEach((a: any, idx: number) => {
        if (!a.phone) return;
        // Customer (if any) is at baseTime; first admin at +10s, next +20s, ...
        const offsetSec = (audience === "both" ? 10 : 0) + idx * 10;
        const adminScheduled = new Date(baseTime + offsetSec * 1000).toISOString();
        rows.push({
          event_code: params.event_code,
          audience: "admin",
          channel,
          recipient_phone: a.phone,
          recipient_email: a.email ?? null,
          recipient_user_id: null,
          language,
          payload: params.variables ?? {},
          priority,
          max_attempts: 3,
          scheduled_at: adminScheduled,
          dedupe_key: params.dedupe_key ? `${params.dedupe_key}:admin:${a.id}` : null,
          related_entity: params.related_entity ?? null,
          related_entity_id: params.related_entity_id ?? null,
        });
      });
    }

    if (rows.length === 0) return;

    // Insert with dedupe: try/ignore duplicate keys via manual filter
    // (unique dedupe rows are prevented via app-level check for simplicity)
    const dedupeKeys = rows.map((r) => r.dedupe_key).filter(Boolean) as string[];
    if (dedupeKeys.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("notif_queue")
        .select("dedupe_key")
        .in("dedupe_key", dedupeKeys);
      const seen = new Set((existing ?? []).map((r: any) => r.dedupe_key));
      const filtered = rows.filter((r) => !r.dedupe_key || !seen.has(r.dedupe_key));
      if (filtered.length === 0) return;
      await supabaseAdmin.from("notif_queue").insert(filtered);
    } else {
      await supabaseAdmin.from("notif_queue").insert(rows);
    }
  } catch (err: any) {
    console.error("[notif] enqueue failed:", err?.message || err);
  }
}

/**
 * Load default enabled provider + credentials (decrypted).
 */
async function loadDefaultProvider(channel: Channel = "whatsapp") {
  const { data: provider } = await supabaseAdmin
    .from("notif_providers")
    .select("*")
    .eq("channel", channel)
    .eq("is_enabled", true)
    .order("is_default", { ascending: false })
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!provider) return null;
  const { data: credsRow } = await supabaseAdmin
    .from("notif_provider_credentials")
    .select("*")
    .eq("provider_id", provider.id)
    .maybeSingle();
  if (!credsRow) return null;
  const creds: ProviderCredentials = {
    api_url: credsRow.api_url,
    api_key: await decryptSecret(credsRow.api_key_encrypted),
    instance_id: credsRow.instance_id,
    session_name: credsRow.session_name,
    phone_number_id: credsRow.phone_number_id,
    extra: (credsRow.extra as any) || {},
    timeout_ms: credsRow.timeout_ms ?? 15000,
  };
  return { provider, creds };
}

/**
 * Resolve template for an event/channel/audience/language with fallbacks.
 */
async function resolveTemplate(
  event_code: string,
  channel: string,
  audience: string,
  language: string,
) {
  // Try exact match, then default language ar, then any language
  const { data: exact } = await supabaseAdmin
    .from("notif_templates")
    .select("*")
    .eq("event_code", event_code)
    .eq("channel", channel)
    .eq("audience", audience)
    .eq("language", language)
    .eq("is_enabled", true)
    .maybeSingle();
  if (exact) return exact;
  const { data: fallback } = await supabaseAdmin
    .from("notif_templates")
    .select("*")
    .eq("event_code", event_code)
    .eq("channel", channel)
    .eq("audience", audience)
    .eq("is_enabled", true)
    .limit(1)
    .maybeSingle();
  return fallback;
}

/**
 * Update daily analytics counters (best-effort).
 */
async function bumpAnalytics(
  event_code: string,
  provider_id: string | null,
  sent: boolean,
  duration_ms: number | null,
) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabaseAdmin
      .from("notif_analytics_daily")
      .select("*")
      .eq("day", day)
      .eq("event_code", event_code)
      .eq("provider_id", provider_id as any)
      .maybeSingle();
    if (existing) {
      const newSent = existing.sent_count + (sent ? 1 : 0);
      const newFailed = existing.failed_count + (sent ? 0 : 1);
      const total = newSent + newFailed;
      const newAvg =
        duration_ms != null
          ? Math.round(
              (existing.avg_duration_ms * (total - 1) + duration_ms) / Math.max(1, total),
            )
          : existing.avg_duration_ms;
      await supabaseAdmin
        .from("notif_analytics_daily")
        .update({
          sent_count: newSent,
          failed_count: newFailed,
          avg_duration_ms: newAvg,
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("notif_analytics_daily").insert({
        day,
        event_code,
        provider_id,
        sent_count: sent ? 1 : 0,
        failed_count: sent ? 0 : 1,
        avg_duration_ms: duration_ms ?? 0,
      });
    }
  } catch (e: any) {
    console.warn("[notif] analytics bump failed:", e?.message);
  }
}

/**
 * Process pending queue items. Returns number of processed rows.
 * Safe to call repeatedly (row-level lock via locked_at).
 */
export async function processQueueBatch(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();
  // Fetch candidate rows
  const { data: rows, error } = await supabaseAdmin
    .from("notif_queue")
    .select("*")
    .in("status", ["pending", "retry"])
    .lte("scheduled_at", nowIso)
    .is("locked_at", null)
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[notif] fetch queue:", error.message);
    return { processed: 0, sent: 0, failed: 0 };
  }
  if (!rows || rows.length === 0) return { processed: 0, sent: 0, failed: 0 };

  const providerBundle = await loadDefaultProvider("whatsapp");

  let sent = 0,
    failed = 0;

  for (const row of rows) {
    // Lock
    const { data: locked } = await supabaseAdmin
      .from("notif_queue")
      .update({ locked_at: nowIso, locked_by: "worker", status: "processing" })
      .eq("id", row.id)
      .is("locked_at", null)
      .select("id")
      .maybeSingle();
    if (!locked) continue;

    if (!providerBundle) {
      await supabaseAdmin
        .from("notif_queue")
        .update({
          status: "failed",
          last_error: "No enabled provider configured",
          locked_at: null,
          updated_at: nowIso,
        })
        .eq("id", row.id);
      failed++;
      continue;
    }

    // Render template
    const template = await resolveTemplate(
      row.event_code,
      row.channel,
      row.audience,
      row.language,
    );
    if (!template) {
      await supabaseAdmin
        .from("notif_queue")
        .update({
          status: "failed",
          last_error: `No template for ${row.event_code}/${row.channel}/${row.audience}/${row.language}`,
          locked_at: null,
          updated_at: nowIso,
        })
        .eq("id", row.id);
      failed++;
      continue;
    }
    const rendered = renderTemplate(template.body, (row.payload as any) || {});

    // Send
    const provider = getProvider(providerBundle.provider.code);
    if (!provider) {
      await supabaseAdmin
        .from("notif_queue")
        .update({
          status: "failed",
          last_error: `Unknown provider adapter: ${providerBundle.provider.code}`,
          locked_at: null,
          updated_at: nowIso,
        })
        .eq("id", row.id);
      failed++;
      continue;
    }

    const result = await provider.send(providerBundle.creds, {
      to: row.recipient_phone ?? "",
      body: rendered,
      language: row.language,
    });

    // Log delivery
    await supabaseAdmin.from("notif_delivery_logs").insert({
      queue_id: row.id,
      provider_id: providerBundle.provider.id,
      event_code: row.event_code,
      audience: row.audience,
      channel: row.channel,
      recipient_phone: row.recipient_phone,
      status: result.ok ? "sent" : "failed",
      http_status: result.http_status ?? null,
      duration_ms: result.duration_ms ?? null,
      request_snapshot: result.request_snapshot ?? null,
      response_snapshot: result.response_snapshot ?? null,
      error_message: result.error_message ?? null,
      attempt: (row.attempts ?? 0) + 1,
    });

    await bumpAnalytics(
      row.event_code,
      providerBundle.provider.id,
      result.ok,
      result.duration_ms ?? null,
    );

    if (result.ok) {
      await supabaseAdmin
        .from("notif_queue")
        .update({
          status: "sent",
          rendered_body: rendered,
          sent_at: nowIso,
          attempts: (row.attempts ?? 0) + 1,
          last_error: null,
          locked_at: null,
          updated_at: nowIso,
        })
        .eq("id", row.id);
      sent++;
    } else {
      const nextAttempt = (row.attempts ?? 0) + 1;
      const isTerminal = nextAttempt >= (row.max_attempts ?? 3);
      const backoffMinutes = Math.min(60, Math.pow(2, nextAttempt));
      const nextRun = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
      await supabaseAdmin
        .from("notif_queue")
        .update({
          status: isTerminal ? "failed" : "retry",
          rendered_body: rendered,
          attempts: nextAttempt,
          last_error: result.error_message ?? "Unknown error",
          scheduled_at: isTerminal ? row.scheduled_at : nextRun,
          locked_at: null,
          updated_at: nowIso,
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return { processed: rows.length, sent, failed };
}

/**
 * Send an immediate test message via the default provider, bypassing the queue.
 */
export async function sendTestMessage(
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string; provider?: string; http_status?: number }> {
  const bundle = await loadDefaultProvider("whatsapp");
  if (!bundle) return { ok: false, error: "No enabled provider" };
  const provider = getProvider(bundle.provider.code);
  if (!provider) return { ok: false, error: `Unknown adapter: ${bundle.provider.code}` };
  const res = await provider.send(bundle.creds, { to, body });
  await supabaseAdmin.from("notif_delivery_logs").insert({
    provider_id: bundle.provider.id,
    event_code: "custom.event",
    audience: "admin",
    channel: "whatsapp",
    recipient_phone: to,
    status: res.ok ? "sent" : "failed",
    http_status: res.http_status ?? null,
    duration_ms: res.duration_ms ?? null,
    request_snapshot: res.request_snapshot ?? null,
    response_snapshot: res.response_snapshot ?? null,
    error_message: res.error_message ?? null,
    attempt: 1,
  });
  return {
    ok: res.ok,
    error: res.error_message,
    provider: bundle.provider.code,
    http_status: res.http_status,
  };
}

/**
 * Run a health check on the default provider and store result.
 */
export async function runProviderHealthCheck(): Promise<any> {
  const bundle = await loadDefaultProvider("whatsapp");
  if (!bundle) return { ok: false, error: "No provider" };
  const provider = getProvider(bundle.provider.code);
  if (!provider || !provider.checkHealth) return { ok: false, error: "Adapter has no health check" };
  const res = await provider.checkHealth(bundle.creds);
  await supabaseAdmin
    .from("notif_provider_health")
    .upsert(
      {
        provider_id: bundle.provider.id,
        status: res.ok ? "healthy" : "degraded",
        session_status: res.session_status ?? null,
        instance_status: res.instance_status ?? null,
        last_success_at: res.ok ? new Date().toISOString() : null,
        last_failure_at: res.ok ? null : new Date().toISOString(),
        last_error: res.error_message ?? null,
        avg_response_ms: res.avg_response_ms ?? null,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" },
    );
  return res;
}
