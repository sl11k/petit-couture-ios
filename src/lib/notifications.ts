import { supabase } from "@/integrations/supabase/client";

export type NotificationChannel = "email" | "sms" | "whatsapp" | "in_app" | "push";
export type NotificationAudience = "customer" | "admin";

export interface NotifyParams {
  event_code: string;
  audience?: NotificationAudience;
  recipient_user_id?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  variables?: Record<string, any>;
  language?: string;
  channels_override?: NotificationChannel[];
  related_entity?: string;
  related_entity_id?: string;
  triggered_by?: string;
  triggered_by_email?: string;
}

/**
 * Render a template body by substituting {{variable}} placeholders.
 * Supports basic conditional sections {{#var}}...{{/var}} that render only if var is truthy.
 */
export function renderTemplate(body: string, vars: Record<string, any>): string {
  let out = body;
  // Conditional sections
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, inner) =>
    vars[key] ? inner : ""
  );
  // Variables
  out = out.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) =>
    vars[key] != null ? String(vars[key]) : ""
  );
  return out;
}

/**
 * Trigger notifications for an event. Reads the rule, picks channels, renders templates,
 * checks customer preferences, logs every attempt.
 */
export async function notify(params: NotifyParams) {
  const audience = params.audience || "customer";
  const language = params.language || "ar";

  // 1. Load rule
  const { data: rule } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("event_code", params.event_code)
    .eq("audience", audience)
    .eq("is_enabled", true)
    .maybeSingle();

  let channels: NotificationChannel[] = params.channels_override
    || (rule ? (rule.channels as NotificationChannel[]) : ["in_app"]);

  if (rule && rule.trigger_mode === "manual" && !params.channels_override) {
    return { ok: false, reason: "manual_only" };
  }

  // 2. Customer preferences (skip channels they opted out of)
  if (audience === "customer" && params.recipient_user_id) {
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", params.recipient_user_id)
      .maybeSingle();
    if (prefs) {
      const blocked: NotificationChannel[] = [];
      if (!prefs.email_enabled) blocked.push("email");
      if (!prefs.sms_enabled) blocked.push("sms");
      if (!prefs.whatsapp_enabled) blocked.push("whatsapp");
      if (!prefs.push_enabled) blocked.push("push");
      // Marketing events require explicit opt-in
      if (params.event_code === "promotion") {
        if (!prefs.marketing_email) blocked.push("email");
        if (!prefs.marketing_sms) blocked.push("sms");
        if (!prefs.marketing_whatsapp) blocked.push("whatsapp");
      }
      channels = channels.filter((c) => !blocked.includes(c));
    }
  }

  if (channels.length === 0) return { ok: false, reason: "all_channels_blocked" };

  const results: any[] = [];

  for (const channel of channels) {
    // 3. Resolve template
    const { data: template } = await supabase
      .from("notification_templates")
      .select("*")
      .eq("event_code", params.event_code)
      .eq("audience", audience)
      .eq("channel", channel)
      .eq("language", language)
      .eq("is_enabled", true)
      .maybeSingle();

    let subject: string | null = null;
    let body = "";
    if (template) {
      subject = template.subject ? renderTemplate(template.subject, params.variables || {}) : null;
      body = renderTemplate(template.body, params.variables || {});
    } else {
      // Fallback minimal body
      body = `Event: ${params.event_code}`;
    }

    // 4. Insert log entry as pending
    const { data: logRow } = await supabase
      .from("notification_log")
      .insert({
        event_code: params.event_code,
        template_key: template?.template_key,
        channel,
        audience,
        recipient_user_id: params.recipient_user_id,
        recipient_email: params.recipient_email,
        recipient_phone: params.recipient_phone,
        subject,
        body_preview: body.slice(0, 280),
        status: "pending",
        related_entity: params.related_entity,
        related_entity_id: params.related_entity_id,
        triggered_by: params.triggered_by,
        triggered_by_email: params.triggered_by_email,
        metadata: { variables: params.variables || {} },
      })
      .select()
      .single();

    // 5. Dispatch per channel
    try {
      if (channel === "in_app") {
        if (audience === "admin") {
          await supabase.from("admin_notifications").insert({
            event_code: params.event_code,
            severity: severityFor(params.event_code),
            title: subject || params.event_code,
            body,
            related_entity: params.related_entity,
            related_entity_id: params.related_entity_id,
            link: linkFor(params.related_entity, params.related_entity_id),
            metadata: params.variables || {},
          });
        }
        // For customer in_app, the notification_log entry IS the in-app notification
        await markSent(logRow!.id);
      } else if (channel === "whatsapp") {
        const wa = await sendWhatsApp(params.recipient_phone || "", body);
        if (wa.ok) await markSent(logRow!.id);
        else await markFailed(logRow!.id, wa.error || "WA failed");
      } else if (channel === "sms") {
        // SMS provider not connected — mark pending_dispatch for now
        await supabase.from("notification_log").update({
          status: "pending_dispatch",
          error_message: "SMS provider not configured",
        }).eq("id", logRow!.id);
      } else if (channel === "email") {
        // Email goes through Lovable Email infrastructure if set up; else log queued
        await supabase.from("notification_log").update({
          status: "queued",
          error_message: null,
        }).eq("id", logRow!.id);
      } else if (channel === "push") {
        await supabase.from("notification_log").update({
          status: "queued",
        }).eq("id", logRow!.id);
      }
      results.push({ channel, ok: true });
    } catch (err: any) {
      await markFailed(logRow!.id, err?.message || "Unknown error");
      results.push({ channel, ok: false, error: err?.message });
    }
  }

  return { ok: true, results };
}

async function markSent(id: string) {
  await supabase.from("notification_log").update({
    status: "sent", sent_at: new Date().toISOString(),
  }).eq("id", id);
}

async function markFailed(id: string, reason: string) {
  await supabase.from("notification_log").update({
    status: "failed", failed_at: new Date().toISOString(), error_message: reason,
  }).eq("id", id);
}

function severityFor(event_code: string): string {
  if (event_code.includes("failed") || event_code.includes("error") || event_code.includes("delayed")) return "warning";
  if (event_code.includes("out_of_stock")) return "danger";
  if (event_code.startsWith("admin_new") || event_code.includes("payment_received")) return "success";
  return "info";
}

function linkFor(entity?: string, entityId?: string): string | null {
  if (!entity || !entityId) return null;
  const map: Record<string, string> = {
    order: `/admin/orders/${entityId}`,
    product: `/admin/products/${entityId}`,
    customer: `/admin/customers/${entityId}`,
    shipment: `/admin/shipping?id=${entityId}`,
    payment: `/admin/payments?id=${entityId}`,
    abandoned_cart: `/admin/abandoned`,
  };
  return map[entity] || null;
}

/**
 * Open a WhatsApp deep-link in a new tab. Returns ok=true if window opens.
 * For automated server sending, integrate WhatsApp Business API later.
 */
export async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!phone) return { ok: false, error: "Missing phone" };
  const cleanPhone = phone.replace(/[^\d]/g, "");
  if (cleanPhone.length < 9) return { ok: false, error: "Invalid phone" };
  if (typeof window === "undefined") {
    // Server-side: just mark as pending dispatch (provider not connected)
    return { ok: false, error: "WhatsApp Business API not connected" };
  }
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
  return { ok: true };
}

/**
 * Manually retry a failed notification.
 */
export async function retryNotification(logId: string) {
  const { data: log } = await supabase.from("notification_log").select("*").eq("id", logId).single();
  if (!log) return { ok: false, error: "not found" };
  await supabase.from("notification_log").update({ attempts: (log.attempts || 0) + 1 }).eq("id", logId);
  return notify({
    event_code: log.event_code,
    audience: log.audience as NotificationAudience,
    recipient_user_id: log.recipient_user_id,
    recipient_email: log.recipient_email,
    recipient_phone: log.recipient_phone,
    variables: (log.metadata as any)?.variables || {},
    channels_override: [log.channel as NotificationChannel],
    related_entity: log.related_entity || undefined,
    related_entity_id: log.related_entity_id || undefined,
  });
}
