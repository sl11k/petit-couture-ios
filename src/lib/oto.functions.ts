import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOtoAccessToken, otoFetch, createOtoShipmentForOrder } from "./oto.server";

async function requireOtoAdmin(userId: string) {
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
      const token = await getOtoAccessToken();
      return { ok: true, tokenPreview: token.slice(0, 12) + "…" };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Unknown error" };
    }
  });

export const otoCreateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    return await createOtoShipmentForOrder(data.orderId, userId);
  });

export const otoSyncShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shipmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    const { data: ship, error } = await supabaseAdmin
      .from("shipments").select("*").eq("id", data.shipmentId).single();
    if (error || !ship) throw new Error("Shipment not found");
    if (!ship.tracking_number) return { ok: false, error: "No tracking number" };
    try {
      const resp: any = await otoFetch(`/orderStatus?orderId=${encodeURIComponent(ship.tracking_number)}`, { method: "GET" });
      const newStatus = (resp?.status || resp?.tracking?.status || "").toString().toLowerCase();
      const update: any = { last_polled_at: new Date().toISOString(), raw_response: resp };
      if (newStatus.includes("delivered")) { update.status = "delivered"; update.delivered_at = new Date().toISOString(); }
      else if (newStatus.includes("transit")) update.status = "in_transit";
      else if (newStatus.includes("out")) update.status = "out_for_delivery";
      else if (newStatus.includes("pick")) { update.status = "picked_up"; update.shipped_at = new Date().toISOString(); }
      else if (newStatus.includes("return")) { update.status = "returned"; update.is_returned = true; }
      await supabaseAdmin.from("shipments").update(update).eq("id", ship.id);
      if (update.status && ship.order_id) {
        const map: Record<string, string> = { picked_up: "shipped", in_transit: "in_transit", out_for_delivery: "out_for_delivery", delivered: "delivered", returned: "returned" };
        if (map[update.status]) await supabaseAdmin.from("orders").update({ shipping_status: map[update.status] }).eq("id", ship.order_id);
      }
      return { ok: true, status: update.status || "unchanged", raw: resp };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Sync failed" };
    }
  });

export const otoListShipments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await requireOtoAdmin(userId);
    const { data } = await supabaseAdmin
      .from("shipments")
      .select("id,order_id,order_number,status,tracking_number,tracking_url,customer_name,city,cod_amount,created_at,shipped_at,delivered_at,last_polled_at")
      .eq("carrier_code", "oto")
      .order("created_at", { ascending: false })
      .limit(200);
    return { items: data || [] };
  });
