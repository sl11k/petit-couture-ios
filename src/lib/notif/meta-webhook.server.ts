import { createHmac, timingSafeEqual } from "node:crypto";
import { createHash } from "node:crypto";

export function verifyMetaSignature(rawBody: string, signature: string, appSecret: string): boolean {
  if (!signature.startsWith("sha256=") || !appSecret) return false;
  const received = signature.slice(7);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export function extractMetaStatuses(payload: any) {
  const result: Array<{ eventKey: string; messageId: string; status: string; timestamp: string; errorCode?: string; errorMessage?: string; sanitized: Record<string, unknown> }> = [];
  for (const entry of payload?.entry || []) for (const change of entry?.changes || []) {
    for (const item of change?.value?.statuses || []) {
      const status = String(item?.status || "").toLowerCase();
      const messageId = String(item?.id || "");
      if (!messageId || !["sent", "delivered", "read", "failed"].includes(status)) continue;
      const error = item?.errors?.[0];
      const timestamp = new Date(Number(item?.timestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString();
      const eventKey = createHash("sha256").update(`${messageId}:${status}:${item?.timestamp || ""}:${error?.code || ""}`).digest("hex");
      result.push({
        eventKey, messageId, status, timestamp,
        errorCode: error?.code != null ? String(error.code) : undefined,
        errorMessage: error?.title ? String(error.title).slice(0, 300) : undefined,
        sanitized: { status, timestamp: item?.timestamp, error_code: error?.code, error_title: error?.title },
      });
    }
  }
  return result;
}
