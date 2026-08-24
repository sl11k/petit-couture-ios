import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public, token-gated live tracking. The token is only known to whoever
 * received the tracking link (WhatsApp/email), so no extra auth is required.
 */
export const getPublicTracking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().trim().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const load = async () => {
      const { data: res } = await (supabaseAdmin as any).rpc("get_order_tracking", { _token: data.token });
      return res as any | null;
    };

    let tracking = await load();
    if (!tracking) return { ok: false as const, error: "not_found" };

    if (tracking.shipment_id) {
      try {
        const { refreshShipmentFromCarrier } = await import("./tracking.server");
        await refreshShipmentFromCarrier(tracking.shipment_id);
        tracking = (await load()) ?? tracking;
      } catch {
        /* keep stored state */
      }
    }

    return { ok: true as const, tracking };
  });

/** Resolve a tracking token from order number + email (manual lookup form). */
export const findTrackingToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ orderNumber: z.string().trim().min(3).max(50), email: z.string().trim().email().max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select("tracking_token")
      .eq("order_number", data.orderNumber)
      .ilike("customer_email", data.email)
      .maybeSingle();
    if (!row?.tracking_token) return { ok: false as const };
    return { ok: true as const, token: row.tracking_token as string };
  });
