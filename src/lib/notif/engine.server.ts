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
    const hasCustomerRecipient = channel === "email" ? !!params.recipient_email : !!params.recipient_phone;
    if ((audience === "customer" || audience === "both") && hasCustomerRecipient) {
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
        const hasAdminRecipient = channel === "email" ? !!a.email : !!a.phone;
        if (!hasAdminRecipient) return;
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
const SITE_NAME = "le petit paradis";
const EMAIL_LOGO_URL = "https://lppme.com/__l5e/assets-v1/cb66358e-ed5c-4c3b-80df-2fe632dae397/lpp-logo.jpeg";
const EMAIL_SENDER_DOMAIN = "notify.lppme.com";
const EMAIL_FROM_DOMAIN = "lppme.com";




function textToHtml(text: string, language: string): string {
  const isRtl = language === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  const align = isRtl ? "right" : "left";
  const escaped = String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const paragraphs = escaped.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 14px 0;line-height:1.7;color:#1f2937;">${p.replace(/\n/g, "<br/>")}</p>`
  ).join("");
  return `<!doctype html><html lang="${language}" dir="${dir}"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Cairo',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #f3e8ff;border-radius:14px;overflow:hidden;">
<tr><td style="background:#ffffff;padding:28px;text-align:center;border-bottom:1px solid #f3f4f6;">
<img src="${EMAIL_LOGO_URL}" alt="${SITE_NAME}" width="110" height="110" style="display:block;margin:0 auto;width:110px;height:110px;border-radius:50%;background:#ffffff;object-fit:cover;border:0;" /></td></tr>
<tr><td dir="${dir}" align="${align}" style="padding:26px 28px;">${paragraphs}</td></tr>
<tr><td style="padding:16px 28px;background:#fafafa;color:#6b7280;font-size:12px;text-align:center;border-top:1px solid #f3f4f6;">© ${new Date().getFullYear()} LPPME</td></tr>
</table></td></tr></table></body></html>`;
}

async function getOrCreateUnsubscribeToken(email: string): Promise<string> {
  const normalized = email.toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (existing && !existing.used_at) return (existing as any).token;
  const token = generateEmailToken();
  await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  const { data: stored } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return (stored as any)?.token ?? token;
}

/**
 * Dispatch an email row via Lovable's email queue (enqueue_email RPC).
 */
async function dispatchEmailRow(row: any, rendered: string, subject: string): Promise<{
  ok: boolean; error_message?: string; duration_ms: number;
}> {
  const started = Date.now();
  try {
    const to = (row.recipient_email as string | null)?.trim();
    if (!to) return { ok: false, error_message: "recipient_email missing", duration_ms: 0 };

    // Suppression check
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails").select("id").eq("email", to.toLowerCase()).maybeSingle();
    if (suppressed) return { ok: false, error_message: "email_suppressed", duration_ms: Date.now() - started };

    const unsubscribeToken = await getOrCreateUnsubscribeToken(to);
    const messageId = `notif-${row.id}`;
    const html = textToHtml(rendered, row.language || "ar");
    const label = `${row.event_code}:${row.audience}`;

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId, template_name: label,
      recipient_email: to, status: "pending",
    });

    const { error } = await supabaseAdmin.rpc("enqueue_email" as any, {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to,
        from: `${SITE_NAME} <noreply@${EMAIL_FROM_DOMAIN}>`,
        sender_domain: EMAIL_SENDER_DOMAIN,
        subject: subject || label,
        html,
        text: rendered,
        purpose: "transactional",
        label,
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId, template_name: label,
        recipient_email: to, status: "failed", error_message: error.message,
      });
      return { ok: false, error_message: error.message, duration_ms: Date.now() - started };
    }
    return { ok: true, duration_ms: Date.now() - started };
  } catch (e: any) {
    return { ok: false, error_message: e?.message || String(e), duration_ms: Date.now() - started };
  }
}

/**
 * Process pending queue items. Returns number of processed rows.
 */
export async function processQueueBatch(limit = 20): Promise<{
  processed: number; sent: number; failed: number;
}> {
  const nowIso = new Date().toISOString();

  // WhatsApp: strict rate limit → 1 per run. Email + others: process up to `limit`.
  const { data: waRows } = await supabaseAdmin
    .from("notif_queue").select("*")
    .in("status", ["pending", "retry"]).lte("scheduled_at", nowIso).is("locked_at", null)
    .eq("channel", "whatsapp")
    .order("priority", { ascending: true }).order("scheduled_at", { ascending: true })
    .limit(1);
  const { data: otherRows } = await supabaseAdmin
    .from("notif_queue").select("*")
    .in("status", ["pending", "retry"]).lte("scheduled_at", nowIso).is("locked_at", null)
    .neq("channel", "whatsapp")
    .order("priority", { ascending: true }).order("scheduled_at", { ascending: true })
    .limit(Math.max(1, limit));
  const rows = [...(waRows || []), ...(otherRows || [])];
  if (rows.length === 0) return { processed: 0, sent: 0, failed: 0 };

  const whatsappBundle = rows.some((r) => r.channel === "whatsapp")
    ? await loadDefaultProvider("whatsapp") : null;

  const THROTTLE_MS = 10_000;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let sent = 0, failed = 0, waSentInBatch = 0;

  for (const row of rows) {
    if (row.channel === "whatsapp" && waSentInBatch > 0) await sleep(THROTTLE_MS);

    const { data: locked } = await supabaseAdmin
      .from("notif_queue")
      .update({ locked_at: nowIso, locked_by: "worker", status: "processing" })
      .eq("id", row.id).is("locked_at", null).select("id").maybeSingle();
    if (!locked) continue;

    const template = await resolveTemplate(row.event_code, row.channel, row.audience, row.language);
    if (!template) {
      await supabaseAdmin.from("notif_queue").update({
        status: "failed",
        last_error: `No template for ${row.event_code}/${row.channel}/${row.audience}/${row.language}`,
        locked_at: null, updated_at: nowIso,
      }).eq("id", row.id);
      failed++; continue;
    }
    const rendered = renderTemplate(template.body, (row.payload as any) || {});
    const subject = template.subject
      ? renderTemplate(template.subject, (row.payload as any) || {})
      : "";

    let result: { ok: boolean; error_message?: string; http_status?: number; duration_ms?: number;
      request_snapshot?: any; response_snapshot?: any };
    let providerIdForLog: string | null = null;

    if (row.channel === "email") {
      const r = await dispatchEmailRow(row, rendered, subject);
      result = { ok: r.ok, error_message: r.error_message, duration_ms: r.duration_ms };
    } else {
      // WhatsApp / SMS via provider adapters
      if (!whatsappBundle) {
        await supabaseAdmin.from("notif_queue").update({
          status: "failed", last_error: "No enabled provider configured",
          locked_at: null, updated_at: nowIso,
        }).eq("id", row.id);
        failed++; continue;
      }
      const provider = getProvider(whatsappBundle.provider.code);
      if (!provider) {
        await supabaseAdmin.from("notif_queue").update({
          status: "failed", last_error: `Unknown provider adapter: ${whatsappBundle.provider.code}`,
          locked_at: null, updated_at: nowIso,
        }).eq("id", row.id);
        failed++; continue;
      }
      result = await provider.send(whatsappBundle.creds, {
        to: row.recipient_phone ?? "", body: rendered, language: row.language,
      });
      providerIdForLog = whatsappBundle.provider.id;
      waSentInBatch++;
    }

    await supabaseAdmin.from("notif_delivery_logs").insert({
      queue_id: row.id, provider_id: providerIdForLog,
      event_code: row.event_code, audience: row.audience, channel: row.channel,
      recipient_phone: row.recipient_phone,
      status: result.ok ? "sent" : "failed",
      http_status: result.http_status ?? null,
      duration_ms: result.duration_ms ?? null,
      request_snapshot: result.request_snapshot ?? null,
      response_snapshot: result.response_snapshot ?? null,
      error_message: result.error_message ?? null,
      attempt: (row.attempts ?? 0) + 1,
    });

    await bumpAnalytics(row.event_code, providerIdForLog, result.ok, result.duration_ms ?? null);

    if (result.ok) {
      await supabaseAdmin.from("notif_queue").update({
        status: "sent", rendered_body: rendered, sent_at: nowIso,
        attempts: (row.attempts ?? 0) + 1, last_error: null,
        locked_at: null, updated_at: nowIso,
      }).eq("id", row.id);
      sent++;
    } else {
      const nextAttempt = (row.attempts ?? 0) + 1;
      const isTerminal = nextAttempt >= (row.max_attempts ?? 3);
      const isRate = /account protection|rate limit|too many|429|5 seconds/i.test(result.error_message ?? "");
      const backoffMinutes = isRate ? Math.min(30, 5 * nextAttempt) : Math.min(60, Math.pow(2, nextAttempt));
      const nextRun = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
      await supabaseAdmin.from("notif_queue").update({
        status: isTerminal ? "failed" : "retry",
        rendered_body: rendered, attempts: nextAttempt,
        last_error: result.error_message ?? "Unknown error",
        scheduled_at: isTerminal ? row.scheduled_at : nextRun,
        locked_at: null, updated_at: nowIso,
      }).eq("id", row.id);
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
