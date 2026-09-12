import type { HealthCheckResult, NotificationProvider, ProviderCredentials, SendMessageInput, SendMessageResult } from "./types";
import { normalizeWhatsAppPhone } from "../phone";
import { retryDisposition, sanitizeProviderError } from "../lifecycle";

const GRAPH_VERSION = "v23.0";

function templateConfig(input: SendMessageInput) {
  const event = String(input.meta?.event_code || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const language = input.language === "en" ? "en_US" : "ar";
  const name = (input.meta?.template_name as string | undefined) ||
    process.env[`WHATSAPP_META_TEMPLATE_${event}_${language === "ar" ? "AR" : "EN"}`];
  const values = Array.isArray(input.meta?.template_values) ? input.meta.template_values : [];
  return { name, language, values };
}

export const metaCloudProvider: NotificationProvider = {
  code: "meta_cloud",
  async send(creds: ProviderCredentials, input: SendMessageInput): Promise<SendMessageResult> {
    const started = Date.now();
    const normalized = normalizeWhatsAppPhone(input.to);
    if (!normalized.ok) return { ok: false, error_code: normalized.error, error_message: normalized.error, retryable: false };
    if (!creds.api_key || !creds.phone_number_id) {
      return { ok: false, error_code: "provider_not_configured", error_message: "Meta WhatsApp token or phone number ID is missing", retryable: false };
    }
    const template = templateConfig(input);
    if (!template.name) {
      return { ok: false, error_code: "template_not_configured", error_message: `Approved Meta template is missing for ${String(input.meta?.event_code || "event")}`, retryable: false };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), creds.timeout_ms ?? 15_000);
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalized.digits,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: template.values.length > 0 ? [{ type: "body", parameters: template.values.map((text: unknown) => ({ type: "text", text: String(text ?? "") })) }] : undefined,
      },
    };
    try {
      const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(creds.phone_number_id)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      const providerMessageId = json?.messages?.[0]?.id;
      if (!response.ok || !providerMessageId) {
        const code = String(json?.error?.code ?? response.status);
        const message = sanitizeProviderError(json?.error?.message ?? `HTTP ${response.status}`);
        return { ok: false, http_status: response.status, duration_ms: Date.now() - started, error_code: code, error_message: message, retryable: retryDisposition(response.status, code, message).retry, response_snapshot: { error: { code, message } } };
      }
      return { ok: true, provider_message_id: String(providerMessageId), http_status: response.status, duration_ms: Date.now() - started, response_snapshot: { messaging_product: json?.messaging_product, message_id: String(providerMessageId) } };
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "Provider request timed out" : "Provider network error";
      return { ok: false, error_code: "provider_timeout", error_message: message, retryable: true, duration_ms: Date.now() - started };
    } finally {
      clearTimeout(timeout);
    }
  },
  async checkHealth(creds: ProviderCredentials): Promise<HealthCheckResult> {
    return creds.api_key && creds.phone_number_id
      ? { ok: true, session_status: "configured" }
      : { ok: false, session_status: "configuration_missing", error_message: "Meta WhatsApp token or phone number ID is missing" };
  },
};
