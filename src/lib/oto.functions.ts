import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOtoAccessToken, otoCreateOrder, otoFetch } from "./oto.server";

export const otoTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
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
    const { userId } = context as any;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");

    const addr: any = order.shipping_address || {};
    const itemsCountRes = await supabaseAdmin
      .from("order_items")
      .select("qty")
      .eq("order_id", order.id);
    const itemsCount = (itemsCountRes.data || []).reduce((s, r: any) => s + Number(r.qty || 0), 0) || 1;

    let otoResp: any;
    try {
      otoResp = await otoCreateOrder({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerEmail: order.customer_email,
        city: addr.city || (order as any).shipping_city || "Riyadh",
        country: addr.country_code || "SA",
        address1: addr.line1 || addr.address || "",
        address2: addr.line2 || null,
        postcode: addr.postcode || addr.zip || null,
        weight: Number((order as any).total_weight_kg || 1),
        codAmount: order.payment_status !== "paid" ? Number(order.total) : 0,
        itemsCount,
        totalValue: Number(order.total),
        currency: order.currency || "SAR",
      });
    } catch (e: any) {
      return { ok: false, error: e?.message || "OTO request failed" };
    }

    const trackingNumber: string | undefined =
      otoResp?.tracking_number || otoResp?.awb || otoResp?.otoId || otoResp?.reference;
    const trackingUrl: string | undefined =
      otoResp?.tracking_url || otoResp?.trackingLink || otoResp?.label_url;
    const awbUrl: string | undefined = otoResp?.label_url || otoResp?.awb_url;

    // Insert shipment row
    const { data: shipment } = await supabaseAdmin
      .from("shipments")
      .insert({
        order_id: order.id,
        order_number: order.order_number,
        carrier_code: "oto",
        status: "label_created",
        tracking_number: trackingNumber || null,
        tracking_url: trackingUrl || null,
        awb_url: awbUrl || null,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        shipping_address: addr,
        city: addr.city || null,
        country_code: addr.country_code || "SA",
        weight_kg: Number((order as any).total_weight_kg || 1),
        declared_value: Number(order.total),
        cod_amount: order.payment_status !== "paid" ? Number(order.total) : 0,
        shipping_fee: Number(order.shipping_fee || 0),
        raw_response: otoResp,
        created_by: userId,
      })
      .select()
      .single();

    // Update order
    await supabaseAdmin
      .from("orders")
      .update({
        shipping_carrier: "oto",
        tracking_number: trackingNumber || null,
        tracking_url: trackingUrl || null,
        shipping_status: "label_created",
      })
      .eq("id", order.id);

    return { ok: true, shipment, otoResp };
  });
