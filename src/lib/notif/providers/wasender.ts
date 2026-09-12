// WasenderAPI adapter. Docs: https://wasenderapi.com
// Compatible endpoint: POST {api_url}/api/send-message with { to, text }
import type {
  HealthCheckResult,
  NotificationProvider,
  ProviderCredentials,
  SendMessageInput,
  SendMessageResult,
} from "./types";
import { normalizeWhatsAppPhone } from "../phone";
import { retryDisposition, sanitizeProviderError } from "../lifecycle";

const DEFAULT_BASE = "https://wasenderapi.com";

function providerRejected(json: any): { rejected: boolean; message?: string; code?: string } {
  const message = String(json?.message ?? json?.error ?? json?.data?.message ?? "").trim();
  const status = String(json?.data?.status ?? json?.status ?? "").toLowerCase();
  const rejected =
    json?.success === false ||
    json?.status === false ||
    ["disconnected", "not_connected", "failed", "error"].includes(status) ||
    /not connected|disconnected|connect your session/i.test(message);
  return {
    rejected,
    message: message || undefined,
    code: String(json?.code ?? (rejected ? "provider_rejected" : "")) || undefined,
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

export const wasenderProvider: NotificationProvider = {
  code: "wasender",

  async send(creds: ProviderCredentials, input: SendMessageInput): Promise<SendMessageResult> {
    const started = Date.now();
    const base = (creds.api_url || DEFAULT_BASE).replace(/\/+$/, "");
    const url = `${base}/api/send-message`;
    const normalized = normalizeWhatsAppPhone(input.to);
    if (!normalized.ok) {
      return { ok: false, error_code: normalized.error, error_message: normalized.error, retryable: false };
    }
    if (!creds.api_key) {
      return { ok: false, error_message: "Missing Wasender API key" };
    }
    const body: Record<string, any> = { to: normalized.digits, text: input.body };
    if (input.media_url) body.imageUrl = input.media_url;
    const requestSnapshot = { url, method: "POST", body: { ...body, text: `[${input.body.length} chars]` } };
    try {
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${creds.api_key}`,
          },
          body: JSON.stringify(body),
        }),
        creds.timeout_ms ?? 15000,
      );
      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* keep as text */ }
      const duration = Date.now() - started;
      const rejection = providerRejected(json);
      if (!res.ok || rejection.rejected) {
        const disconnected = /not connected|disconnected|connect your session/i.test(rejection.message ?? "");
        return {
          ok: false,
          http_status: res.status,
          duration_ms: duration,
          request_snapshot: requestSnapshot,
          response_snapshot: json ? { success: json.success, error: json.error, message: sanitizeProviderError(json.message) } : undefined,
          error_code: disconnected ? "provider_session_disconnected" : (rejection.code ?? String(res.status)),
          error_message: sanitizeProviderError(rejection.message || `HTTP ${res.status}`),
          retryable: disconnected
            ? false
            : retryDisposition(res.status, String(json?.code ?? ""), rejection.message).retry,
        };
      }
      const providerMessageId =
        json?.data?.msgId ?? json?.data?.id ?? json?.messageId ?? json?.id ?? null;
      if (!providerMessageId) return {
        ok: false,
        error_code: "provider_message_id_missing",
        error_message: "Provider returned success without a message ID",
        retryable: false,
        http_status: res.status,
        duration_ms: duration,
      };
      return {
        ok: true,
        provider_message_id: providerMessageId ? String(providerMessageId) : null,
        http_status: res.status,
        duration_ms: duration,
        request_snapshot: requestSnapshot,
        response_snapshot: { message_id: String(providerMessageId), success: json?.success },
      };
    } catch (err: any) {
      return {
        ok: false,
        duration_ms: Date.now() - started,
        request_snapshot: requestSnapshot,
        error_code: "provider_network_error",
        error_message: sanitizeProviderError(err?.message || "Network error"),
        retryable: true,
      };
    }
  },

  async checkHealth(creds: ProviderCredentials): Promise<HealthCheckResult> {
    const started = Date.now();
    const base = (creds.api_url || DEFAULT_BASE).replace(/\/+$/, "");
    if (!creds.api_key) return { ok: false, error_message: "Missing API key" };
    try {
      const res = await withTimeout(
        fetch(`${base}/api/status`, {
          method: "GET",
          headers: { Authorization: `Bearer ${creds.api_key}` },
        }),
        creds.timeout_ms ?? 10000,
      );
      const json = await res.json().catch(() => null);
      const rejection = providerRejected(json);
      const sessionStatus = String(json?.data?.status ?? json?.status ?? (res.ok ? "unknown" : "unavailable"));
      const connected = /^(connected|ready|authenticated|online)$/i.test(sessionStatus);
      const ok = res.ok && !rejection.rejected && connected;
      return {
        ok,
        session_status: sessionStatus,
        instance_status: json?.data?.instance ?? null,
        avg_response_ms: Date.now() - started,
        error_message: ok
          ? undefined
          : sanitizeProviderError(rejection.message || (!connected ? `WhatsApp session is ${sessionStatus}` : `HTTP ${res.status}`)),
      };
    } catch (err: any) {
      return { ok: false, error_message: err?.message || "Health check failed" };
    }
  },
};
