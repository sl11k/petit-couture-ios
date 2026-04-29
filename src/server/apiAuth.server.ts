/**
 * REST API v1 — external partners.
 * Authentication: Bearer token (api_keys.key_hash).
 * Pattern: /api/v1/{resource}
 *
 * Wrap handlers with `withApi(scope, handler)` to enforce auth, scope check,
 * rate-limit hint, and request logging.
 */
import {
  authenticateApiKey,
  hasScope,
  logApiRequest,
} from "@/server/webhooks.server";

type ApiHandler = (req: {
  request: Request;
  keyId: string;
  scopes: string[];
  url: URL;
}) => Promise<Response>;

export function withApi(requiredScope: string, handler: ApiHandler) {
  return async ({ request }: { request: Request }) => {
    const start = Date.now();
    const url = new URL(request.url);
    const ip = request.headers.get("x-forwarded-for") ?? undefined;
    const ua = request.headers.get("user-agent") ?? undefined;
    let keyId: string | undefined;
    let status = 500;
    let errorMessage: string | undefined;

    try {
      const auth = await authenticateApiKey(request.headers.get("authorization"));
      if (!auth.ok) {
        status = 401;
        errorMessage = auth.error;
        return jsonError(401, "unauthorized", auth.error ?? "Invalid API key");
      }
      keyId = auth.keyId;
      if (!hasScope(auth.scopes, requiredScope)) {
        status = 403;
        errorMessage = `missing scope ${requiredScope}`;
        return jsonError(403, "forbidden", `Missing required scope: ${requiredScope}`);
      }

      const res = await handler({ request, keyId: auth.keyId!, scopes: auth.scopes ?? [], url });
      status = res.status;
      return res;
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
      status = 500;
      return jsonError(500, "internal_error", "Unexpected error");
    } finally {
      logApiRequest({
        apiKeyId: keyId,
        method: request.method,
        path: url.pathname,
        statusCode: status,
        durationMs: Date.now() - start,
        ip,
        userAgent: ua,
        error: errorMessage,
      }).catch(() => {});
    }
  };
}

export function jsonOk(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function paging(url: URL, defaults = { page: 1, pageSize: 20 }) {
  const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || defaults.page));
  const pageSize = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("page_size")) || defaults.pageSize),
  );
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}
