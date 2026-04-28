import { supabase } from "@/integrations/supabase/client";
import { renderTemplate } from "@/lib/notifications";

export type MessagingChannel = "whatsapp" | "sms";

export interface SendParams {
  channel?: MessagingChannel | "auto";
  phone: string;
  body: string;
  template_key?: string;
  variables?: Record<string, any>;
  customer_user_id?: string | null;
  customer_name?: string | null;
  related_order_id?: string | null;
  related_entity?: string;
  related_entity_id?: string;
  sent_by?: string | null;
  sent_by_email?: string | null;
}

function normalizePhone(p: string) {
  return p.replace(/[^\d+]/g, "");
}

/** Pick the best enabled provider for a channel by priority and budget. */
async function pickProvider(channel: MessagingChannel) {
  const { data } = await supabase
    .from("messaging_providers")
    .select("*")
    .eq("channel", channel)
    .eq("is_enabled", true)
    .order("priority", { ascending: true });
  if (!data || data.length === 0) return null;
  for (const p of data) {
    if (p.monthly_budget && Number(p.monthly_spend) >= Number(p.monthly_budget)) continue;
    return p;
  }
  return data[0];
}

/** Get or create the conversation thread for (phone, channel). */
export async function ensureConversation(
  phone: string,
  channel: MessagingChannel,
  opts: { customer_user_id?: string | null; customer_name?: string | null; related_order_id?: string | null } = {},
) {
  const cleanPhone = normalizePhone(phone);
  const { data: existing } = await supabase
    .from("messaging_conversations")
    .select("*")
    .eq("customer_phone", cleanPhone)
    .eq("channel", channel)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("messaging_conversations")
    .insert({
      customer_phone: cleanPhone,
      channel,
      customer_user_id: opts.customer_user_id ?? null,
      customer_name: opts.customer_name ?? null,
      related_order_id: opts.related_order_id ?? null,
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return created!;
}

async function logCost(providerId: string | null, channel: string, cost: number) {
  if (!providerId) return;
  const today = new Date().toISOString().slice(0, 10);
  // upsert daily row
  const { data: existing } = await supabase
    .from("messaging_costs_log")
    .select("*")
    .eq("provider_id", providerId)
    .eq("day", today)
    .maybeSingle();
  if (existing) {
    await supabase.from("messaging_costs_log").update({
      message_count: (existing.message_count || 0) + 1,
      total_cost: Number(existing.total_cost || 0) + cost,
    }).eq("id", existing.id);
  } else {
    await supabase.from("messaging_costs_log").insert({
      provider_id: providerId, channel, day: today, message_count: 1, total_cost: cost,
    });
  }
  // increment provider monthly spend
  const { data: prov } = await supabase.from("messaging_providers").select("monthly_spend").eq("id", providerId).single();
  await supabase.from("messaging_providers").update({
    monthly_spend: Number(prov?.monthly_spend || 0) + cost,
  }).eq("id", providerId);
}

/**
 * Send a message via WhatsApp or SMS. If channel="auto", tries WhatsApp first then SMS.
 * Records the message in messaging_messages and updates the conversation.
 */
export async function sendMessage(params: SendParams) {
  const body = params.variables ? renderTemplate(params.body, params.variables) : params.body;
  const channels: MessagingChannel[] = params.channel === "auto" || !params.channel
    ? ["whatsapp", "sms"]
    : [params.channel];

  let lastError: string | null = null;

  for (const ch of channels) {
    const provider = await pickProvider(ch);
    if (!provider) {
      lastError = `لا يوجد مزود ${ch} مفعّل`;
      continue;
    }

    const conv = await ensureConversation(params.phone, ch, {
      customer_user_id: params.customer_user_id,
      customer_name: params.customer_name,
      related_order_id: params.related_order_id,
    });

    const { data: msgRow } = await supabase.from("messaging_messages").insert({
      conversation_id: conv.id,
      direction: "outbound",
      channel: ch,
      provider_id: provider.id,
      template_key: params.template_key,
      body,
      status: "queued",
      cost: provider.cost_per_message || 0,
      related_order_id: params.related_order_id,
      related_entity: params.related_entity,
      related_entity_id: params.related_entity_id,
      sent_by: params.sent_by,
      sent_by_email: params.sent_by_email,
    }).select().single();

    const dispatch = await dispatchToProvider(provider, params.phone, body);

    if (dispatch.ok) {
      await supabase.from("messaging_messages").update({
        status: "sent",
        provider_message_id: dispatch.providerMessageId,
        delivered_at: new Date().toISOString(),
      }).eq("id", msgRow!.id);
      await supabase.from("messaging_conversations").update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 140),
      }).eq("id", conv.id);
      await logCost(provider.id, ch, Number(provider.cost_per_message || 0));
      return { ok: true, channel: ch, conversation_id: conv.id, message_id: msgRow!.id };
    } else {
      await supabase.from("messaging_messages").update({
        status: "failed",
        error_message: dispatch.error,
        failed_at: new Date().toISOString(),
      }).eq("id", msgRow!.id);
      lastError = dispatch.error || "فشل غير معروف";
      // try next channel in fallback list
    }
  }

  return { ok: false, error: lastError || "فشل الإرسال" };
}

interface DispatchResult { ok: boolean; providerMessageId?: string; error?: string }

async function dispatchToProvider(provider: any, phone: string, body: string): Promise<DispatchResult> {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 9) return { ok: false, error: "رقم جوال غير صالح" };

  switch (provider.provider_type) {
    case "wa_link": {
      // Manual: open WhatsApp web link
      if (typeof window !== "undefined") {
        const url = `https://wa.me/${cleanPhone.replace(/^\+/, "")}?text=${encodeURIComponent(body)}`;
        window.open(url, "_blank");
        return { ok: true, providerMessageId: `wa_link_${Date.now()}` };
      }
      return { ok: false, error: "wa.me يتطلب فتح المتصفح" };
    }
    case "twilio": {
      // Server-side via Twilio connector — placeholder for server function call
      return { ok: false, error: "Twilio يتطلب ربط الموصل من قسم التكاملات" };
    }
    case "unifonic": {
      return { ok: false, error: "Unifonic يتطلب إعداد API key" };
    }
    default:
      return { ok: false, error: `نوع غير مدعوم: ${provider.provider_type}` };
  }
}

/** Generate a 6-digit OTP, hash it, and store. Returns the plain code (caller sends via SMS). */
export async function createOtp(phone: string, purpose = "verification", ttlSec = 300) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  // Simple hash (in real prod use a proper hash; this is for storage only)
  const enc = new TextEncoder().encode(code + phone);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const codeHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  await supabase.from("sms_otp_codes").insert({
    phone: normalizePhone(phone),
    code_hash: codeHash,
    purpose,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  });
  return code;
}

export async function verifyOtp(phone: string, code: string, purpose = "verification") {
  const cleanPhone = normalizePhone(phone);
  const { data: rows } = await supabase
    .from("sms_otp_codes")
    .select("*")
    .eq("phone", cleanPhone)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const otp = rows?.[0];
  if (!otp) return { ok: false, error: "انتهت صلاحية الرمز" };
  if (otp.attempts >= otp.max_attempts) return { ok: false, error: "تجاوزت الحد المسموح" };

  const enc = new TextEncoder().encode(code + cleanPhone);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const codeHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (codeHash !== otp.code_hash) {
    await supabase.from("sms_otp_codes").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    return { ok: false, error: "رمز غير صحيح" };
  }
  await supabase.from("sms_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
  return { ok: true };
}

/** Convenience helpers used by other modules. */
export const Messaging = {
  async sendOrderConfirmation(phone: string, vars: { order_number: string; total: string; customer_name?: string }) {
    return sendMessage({
      channel: "auto", phone,
      body: `مرحبًا {{customer_name}}،\nتم استلام طلبك رقم {{order_number}} بإجمالي {{total}}. شكراً لتسوقك معنا.`,
      template_key: "order_confirmation", variables: vars, customer_name: vars.customer_name,
    });
  },
  async sendPaymentLink(phone: string, vars: { order_number: string; payment_link: string }) {
    return sendMessage({
      channel: "auto", phone,
      body: `طلبك {{order_number}} بانتظار الدفع. أكمل الدفع عبر:\n{{payment_link}}`,
      template_key: "payment_link", variables: vars,
    });
  },
  async sendTracking(phone: string, vars: { order_number: string; tracking_number: string; carrier?: string }) {
    return sendMessage({
      channel: "auto", phone,
      body: `تم شحن طلبك {{order_number}}{{#carrier}} عبر {{carrier}}{{/carrier}}.\nرقم التتبع: {{tracking_number}}`,
      template_key: "shipment_tracking", variables: vars,
    });
  },
  async sendCartReminder(phone: string, vars: { customer_name?: string; cart_link: string }) {
    return sendMessage({
      channel: "whatsapp", phone,
      body: `مرحبًا {{customer_name}} 👋\nسلتك بانتظارك! أكمل طلبك من هنا:\n{{cart_link}}`,
      template_key: "cart_reminder", variables: vars,
    });
  },
};
