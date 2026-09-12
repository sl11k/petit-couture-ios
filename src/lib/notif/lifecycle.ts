export type WhatsAppStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "dead_letter"
  | "sent_unconfirmed"
  | "manual_link";

const STATUS_RANK: Record<string, number> = {
  queued: 0,
  retry: 0,
  sending: 1,
  processing: 1,
  sent_unconfirmed: 2,
  sent: 3,
  delivered: 4,
  read: 5,
};

export function canApplyProviderStatus(current: string, incoming: string): boolean {
  if (incoming === "failed") return !["delivered", "read"].includes(current);
  if (current === "failed" || current === "dead_letter" || current === "manual_link") return false;
  return (STATUS_RANK[incoming] ?? -1) >= (STATUS_RANK[current] ?? -1);
}

export function retryDisposition(httpStatus?: number, code?: string, message?: string) {
  const haystack = `${code || ""} ${message || ""}`.toLowerCase();
  const permanent = httpStatus === 400 || httpStatus === 401 || httpStatus === 403 ||
    /invalid.*recipient|recipient.*invalid|template.*(missing|invalid|not found|rejected)|permission|unsupported/.test(haystack);
  const transient = httpStatus === 408 || httpStatus === 409 || httpStatus === 429 ||
    (httpStatus != null && httpStatus >= 500) || /timeout|network|rate.?limit|temporar/.test(haystack);
  return { retry: !permanent && transient, permanent };
}

export function retryDelayMs(attempt: number): number {
  const boundedAttempt = Math.max(1, Math.min(attempt, 6));
  return Math.min(60 * 60_000, 30_000 * 2 ** (boundedAttempt - 1));
}

export function sanitizeProviderError(value: unknown): string {
  return String(value || "Unknown provider error")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/(access_token|api[_-]?key|secret|token)["'=:\s]+[^\s,"'}]+/gi, "$1=[REDACTED]")
    .replace(/\+?[1-9][0-9]{8,14}/g, (phone) => `${phone.slice(0, 3)}***${phone.slice(-4)}`)
    .slice(0, 500);
}
