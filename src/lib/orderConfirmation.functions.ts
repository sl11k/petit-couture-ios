// Fetches a single order for the customer-facing confirmation page.
// Guest orders are bound to the browser session that placed them via
// `idempotency_key` (prefixed with `${session_id}:`). Authenticated users
// can fetch any order they own. Uses supabaseAdmin so RLS does not block
// guest reads — access is authorized inside the handler.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  order_number: z.string().min(3).max(64),
  session_id: z.string().min(1).max(128).nullable().optional(),
  auth_token: z.string().min(20).max(4096).nullable().optional(),
});

export const getOrderConfirmation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_method, payment_gateway, customer_name, customer_email, customer_phone, subtotal, shipping_fee, tax, total, currency, shipping_address, idempotency_key, user_id, created_at, order_items(id, product_name, brand, qty, size, color, sku, unit_price, line_total, image_url)",
      )
      .eq("order_number", data.order_number)
      .maybeSingle();

    if (error) throw new Error(`Could not load order: ${error.message}`);
    if (!order) return { ok: false as const, reason: "not_found" as const };

    // Authorization: guest session ownership OR authenticated user match.
    let authorized = false;
    if (data.session_id && typeof order.idempotency_key === "string") {
      if (order.idempotency_key.startsWith(`${data.session_id}:`)) authorized = true;
    }
    if (!authorized && data.auth_token && order.user_id) {
      try {
        const client = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: userRes } = await client.auth.getUser(data.auth_token);
        if (userRes?.user?.id && userRes.user.id === order.user_id) authorized = true;
      } catch {
        /* ignore */
      }
    }

    if (!authorized) return { ok: false as const, reason: "forbidden" as const };

    // Strip internal fields before returning.
    const { idempotency_key: _ik, user_id: _uid, ...safe } = order as Record<string, unknown>;
    return { ok: true as const, order: JSON.parse(JSON.stringify(safe)) as Record<string, any> };
  });
