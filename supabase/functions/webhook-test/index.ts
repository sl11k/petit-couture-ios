// Test webhook endpoint by sending a sample payload and logging the result.
// Body: { url: string, secret?: string, event_type?: string, endpoint_id?: string, payload?: object }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const url: string = body?.url;
    const secret: string | undefined = body?.secret;
    const eventType: string = body?.event_type ?? "test.ping";
    const endpointId: string | null = body?.endpoint_id ?? null;
    const payload = body?.payload ?? {
      event: eventType,
      sent_at: new Date().toISOString(),
      message: "This is a test webhook from the admin panel.",
      sample: {
        order_number: "TEST-0001",
        status: "in_transit",
        tracking_number: "TRK-TEST-12345",
      },
    };

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const eventId = crypto.randomUUID();
    const bodyStr = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": eventType,
      "X-Webhook-Event-Id": eventId,
      "X-Webhook-Test": "true",
    };
    if (secret) {
      headers["X-Webhook-Signature"] = await hmacSha256Hex(secret, bodyStr);
    }

    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let respText = "";
    let errorMessage: string | null = null;

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: bodyStr,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      httpStatus = resp.status;
      respText = (await resp.text()).slice(0, 4000);
    } catch (e: any) {
      errorMessage = String(e?.message ?? e);
    }

    const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
    const elapsed = Date.now() - startedAt;

    await supabase.from("webhook_deliveries").insert({
      endpoint_id: endpointId,
      event_type: eventType,
      event_id: eventId,
      payload,
      attempt: 1,
      status: ok ? "delivered" : "failed",
      http_status: httpStatus,
      response_body: respText,
      error_message: errorMessage,
      delivered_at: ok ? new Date().toISOString() : null,
    });

    return new Response(
      JSON.stringify({
        ok,
        http_status: httpStatus,
        elapsed_ms: elapsed,
        response_preview: respText.slice(0, 500),
        error: errorMessage,
        event_id: eventId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
