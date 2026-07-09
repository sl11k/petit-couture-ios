// WasenderAPI adapter. Docs: https://wasenderapi.com
// Compatible endpoint: POST {api_url}/api/send-message with { to, text }
import type {
  HealthCheckResult,
  NotificationProvider,
  ProviderCredentials,
  SendMessageInput,
  SendMessageResult,
} from "./types";

const DEFAULT_BASE = "https://wasenderapi.com";

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/[^\d]/g, "");
  return digits.length ? digits : "";
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
    const to = normalizePhone(input.to);
    if (!to) {
      return { ok: false, error_message: "Invalid recipient phone" };
    }
    if (!creds.api_key) {
      return { ok: false, error_message: "Missing Wasender API key" };
    }
    const body: Record<string, any> = { to, text: input.body };
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
      if (!res.ok) {
        return {
          ok: false,
          http_status: res.status,
          duration_ms: duration,
          request_snapshot: requestSnapshot,
          response_snapshot: json ?? text,
          error_message: (json && (json.message || json.error)) || `HTTP ${res.status}`,
        };
      }
      const providerMessageId =
        json?.data?.msgId ?? json?.data?.id ?? json?.messageId ?? json?.id ?? null;
      return {
        ok: true,
        provider_message_id: providerMessageId ? String(providerMessageId) : null,
        http_status: res.status,
        duration_ms: duration,
        request_snapshot: requestSnapshot,
        response_snapshot: json ?? text,
      };
    } catch (err: any) {
      return {
        ok: false,
        duration_ms: Date.now() - started,
        request_snapshot: requestSnapshot,
        error_message: err?.message || "Network error",
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
      const ok = res.ok;
      return {
        ok,
        session_status: json?.data?.status ?? json?.status ?? (ok ? "connected" : "unknown"),
        instance_status: json?.data?.instance ?? null,
        avg_response_ms: Date.now() - started,
        error_message: ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err: any) {
      return { ok: false, error_message: err?.message || "Health check failed" };
    }
  },
};
