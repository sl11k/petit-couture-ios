import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireOtoAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some(({ role }) => role === "admin" || role === "super_admin")) {
    throw new Error("Forbidden: admin role required");
  }
}

export const otoTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    try {
      const { getOtoAccessToken } = await import("./oto.server");
      const token = await getOtoAccessToken();
      return { ok: true, tokenPreview: token.slice(0, 12) + "…" };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Unknown error" };
    }
  });

export const otoCreateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        deliveryOptionId: z.string().optional().nullable(),
        force: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    const { createOtoShipmentForOrder } = await import("./oto.server");
    return await createOtoShipmentForOrder(data.orderId, userId, data.deliveryOptionId, {
      force: Boolean(data.force),
      waitOnThrottle: Boolean(data.force),
    });
  });

export const otoGetDeliveryOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    const { getOtoDeliveryOptionsForOrder } = await import("./oto.server");
    return await getOtoDeliveryOptionsForOrder(data.orderId);
  });

export const otoSyncShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shipmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { otoGetOrderStatus } = await import("./oto.server");
    const { data: ship, error } = await supabaseAdmin
      .from("shipments").select("*").eq("id", data.shipmentId).single();
    if (error || !ship) throw new Error("Shipment not found");
    try {
      const { extractOtoShipmentDetails, otoPrintAwb } = await import("./oto.server");
      const otoLookupId = ship.order_number || ship.tracking_number;
      if (!otoLookupId) return { ok: false, error: "No OTO order number" };
      const resp: any = await otoGetOrderStatus(otoLookupId);
      const printResp: any = await otoPrintAwb(otoLookupId).catch(() => null);
      const details = extractOtoShipmentDetails(resp, printResp);
      const newStatus = (resp?.status || resp?.tracking?.status || "").toString().toLowerCase();
      const update: any = { last_polled_at: new Date().toISOString(), raw_response: { status: resp, printAwb: printResp } };
      if (details.trackingNumber) update.tracking_number = details.trackingNumber;
      if (details.trackingUrl) update.tracking_url = details.trackingUrl;
      if (details.awbUrl) update.awb_url = details.awbUrl;
      if (newStatus.includes("delivered")) { update.status = "delivered"; update.delivered_at = new Date().toISOString(); }
      else if (newStatus.includes("transit")) update.status = "in_transit";
      else if (newStatus.includes("out")) update.status = "out_for_delivery";
      else if (newStatus.includes("pick")) { update.status = "picked_up"; update.shipped_at = new Date().toISOString(); }
      else if (newStatus.includes("return")) { update.status = "returned"; update.is_returned = true; }
      await supabaseAdmin.from("shipments").update(update).eq("id", ship.id);
      if (ship.order_id) {
        const map: Record<string, string> = { picked_up: "shipped", in_transit: "in_transit", out_for_delivery: "out_for_delivery", delivered: "delivered", returned: "returned" };
        if (map[update.status] || details.trackingNumber || details.trackingUrl || details.awbUrl) {
          await supabaseAdmin.from("orders").update({
            shipping_status: map[update.status] || ship.status || "processing",
            shipping_carrier: "oto",
            tracking_number: details.trackingNumber || ship.tracking_number || null,
            tracking_url: details.trackingUrl || details.awbUrl || ship.tracking_url || null,
          }).eq("id", ship.order_id);
        }
      }
      return { ok: true, status: update.status || "unchanged", tracking_number: details.trackingNumber || ship.tracking_number || null, raw: resp };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Sync failed" };
    }
  });

export const otoListShipments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("shipments")
      .select("id,order_id,order_number,status,tracking_number,tracking_url,customer_name,city,cod_amount,created_at,shipped_at,delivered_at,last_polled_at")
      .eq("carrier_code", "oto")
      .order("created_at", { ascending: false })
      .limit(200);
    return { items: data || [] };
  });
