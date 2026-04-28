import { supabase } from "@/integrations/supabase/client";

export type ShipmentStatus =
  | "pending"
  | "label_created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery"
  | "returned"
  | "lost"
  | "cancelled";

export interface RateContext {
  city?: string;
  country_code?: string;
  weight_kg: number;
  order_value: number;
  cod_amount?: number;
}

export interface ResolvedRate {
  carrier_id: string;
  carrier_code: string;
  carrier_name: string;
  zone_id: string;
  rate_id: string;
  fee: number;
  delivery_days_min?: number;
  delivery_days_max?: number;
  is_free: boolean;
  free_reason?: string;
}

/**
 * Resolve the best shipping rate for the given context.
 * Picks lowest fee among matching active carriers/zones/rates.
 */
export async function resolveShippingRates(ctx: RateContext): Promise<ResolvedRate[]> {
  const { data: carriers } = await supabase
    .from("shipping_carriers")
    .select("*")
    .eq("is_active", true);
  if (!carriers?.length) return [];

  const { data: zones } = await supabase
    .from("shipping_zones")
    .select("*")
    .eq("is_active", true);
  const { data: rates } = await supabase
    .from("shipping_rates")
    .select("*")
    .eq("is_active", true);

  const results: ResolvedRate[] = [];
  const country = ctx.country_code || "SA";
  const cityLower = (ctx.city || "").trim().toLowerCase();

  for (const carrier of carriers) {
    if (ctx.cod_amount && ctx.cod_amount > 0 && !carrier.supports_cod) continue;
    if (country !== "SA" && !carrier.supports_international) continue;

    const carrierZones = (zones || []).filter((z: any) => z.carrier_id === carrier.id);
    const matchedZone = carrierZones.find((z: any) => {
      if (z.country_code !== country) return false;
      const cities: string[] = Array.isArray(z.cities) ? z.cities : [];
      if (cities.length === 0) return true; // empty = covers all
      return cities.some((c) => c.toLowerCase() === cityLower);
    });
    if (!matchedZone) continue;

    const zoneRates = (rates || []).filter((r: any) => r.zone_id === matchedZone.id);
    let best: any = null;
    for (const rate of zoneRates) {
      if (rate.min_weight_kg != null && ctx.weight_kg < Number(rate.min_weight_kg)) continue;
      if (rate.max_weight_kg != null && ctx.weight_kg > Number(rate.max_weight_kg)) continue;
      if (rate.min_order_value != null && ctx.order_value < Number(rate.min_order_value)) continue;
      if (rate.max_order_value != null && ctx.order_value > Number(rate.max_order_value)) continue;

      let fee = Number(rate.base_fee || 0);
      if (rate.rate_type === "weight") {
        fee += Number(rate.per_kg_fee || 0) * ctx.weight_kg;
      }
      if (ctx.cod_amount && ctx.cod_amount > 0) fee += Number(rate.cod_extra_fee || 0);

      let isFree = false;
      let freeReason: string | undefined;
      if (rate.free_shipping_threshold != null && ctx.order_value >= Number(rate.free_shipping_threshold)) {
        fee = 0;
        isFree = true;
        freeReason = `الطلب فوق ${rate.free_shipping_threshold} SAR`;
      }

      if (!best || fee < best.fee) {
        best = {
          carrier_id: carrier.id,
          carrier_code: carrier.code,
          carrier_name: carrier.name_ar,
          zone_id: matchedZone.id,
          rate_id: rate.id,
          fee,
          delivery_days_min: matchedZone.delivery_days_min ?? carrier.default_delivery_days_min,
          delivery_days_max: matchedZone.delivery_days_max ?? carrier.default_delivery_days_max,
          is_free: isFree,
          free_reason: freeReason,
        };
      }
    }
    if (best) results.push(best);
  }

  return results.sort((a, b) => a.fee - b.fee);
}

/**
 * Auto-pick the cheapest carrier matching the context, or null if none cover.
 */
export async function autoPickCarrier(ctx: RateContext): Promise<ResolvedRate | null> {
  const list = await resolveShippingRates(ctx);
  return list[0] || null;
}

export interface CreateShipmentInput {
  order_id: string;
  carrier_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address: Record<string, any>;
  city?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  weight_kg?: number;
  dimensions?: { l?: number; w?: number; h?: number };
  declared_value?: number;
  cod_amount?: number;
  shipping_fee?: number;
  zone_id?: string;
  created_by?: string;
}

/**
 * Validate and create a shipment record.
 * Returns { error } if validation fails.
 */
export async function createShipment(input: CreateShipmentInput) {
  // Validation
  const errors: string[] = [];
  if (!input.customer_name?.trim()) errors.push("اسم العميل مطلوب");
  if (!input.customer_phone || !/^(\+?\d{9,15})$/.test(input.customer_phone.replace(/\s/g, "")))
    errors.push("رقم جوال غير صالح");
  if (!input.shipping_address || Object.keys(input.shipping_address).length === 0)
    errors.push("العنوان مطلوب");
  if (input.weight_kg != null && (input.weight_kg <= 0 || input.weight_kg > 1000))
    errors.push("وزن غير صحيح");
  if (errors.length) return { data: null, error: new Error(errors.join("، ")) };

  const { data: carrier } = await supabase
    .from("shipping_carriers")
    .select("code, supports_cod")
    .eq("id", input.carrier_id)
    .single();
  if (!carrier) return { data: null, error: new Error("شركة الشحن غير موجودة") };
  if (input.cod_amount && input.cod_amount > 0 && !carrier.supports_cod)
    return { data: null, error: new Error("هذه الشركة لا تدعم الدفع عند الاستلام") };

  // Order lookup for number
  const { data: order } = await supabase
    .from("orders")
    .select("order_number")
    .eq("id", input.order_id)
    .single();

  const { data: shipment, error } = await supabase
    .from("shipments")
    .insert({
      order_id: input.order_id,
      order_number: order?.order_number,
      carrier_id: input.carrier_id,
      carrier_code: carrier.code,
      zone_id: input.zone_id ?? null,
      status: "label_created",
      customer_name: input.customer_name.trim(),
      customer_phone: input.customer_phone.trim(),
      customer_email: input.customer_email?.trim(),
      shipping_address: input.shipping_address,
      city: input.city,
      country_code: input.country_code || "SA",
      lat: input.lat,
      lng: input.lng,
      weight_kg: input.weight_kg,
      dimensions: input.dimensions || null,
      declared_value: input.declared_value,
      cod_amount: input.cod_amount || 0,
      shipping_fee: input.shipping_fee || 0,
      created_by: input.created_by,
      tracking_number: `LCL-${Date.now().toString(36).toUpperCase()}`,
    })
    .select()
    .single();

  if (error) return { data: null, error };

  // Initial tracking event
  await supabase.from("shipment_tracking_events").insert({
    shipment_id: shipment.id,
    status: "label_created",
    description: "تم إنشاء بوليصة الشحن",
    source: "system",
  });

  // Update order shipping_status
  await supabase
    .from("orders")
    .update({
      shipping_status: "created",
      shipping_carrier: carrier.code,
      tracking_number: shipment.tracking_number,
    })
    .eq("id", input.order_id);

  return { data: shipment, error: null };
}

export async function addTrackingEvent(shipmentId: string, status: ShipmentStatus, description?: string, location?: string, source: "manual" | "webhook" | "polling" | "system" = "manual") {
  await supabase.from("shipment_tracking_events").insert({
    shipment_id: shipmentId,
    status,
    description,
    location,
    source,
    occurred_at: new Date().toISOString(),
  });
  const update: any = { status, updated_at: new Date().toISOString() };
  if (status === "picked_up") update.shipped_at = new Date().toISOString();
  if (status === "delivered") update.delivered_at = new Date().toISOString();
  if (status === "returned") update.is_returned = true;
  await supabase.from("shipments").update(update).eq("id", shipmentId);

  // Mirror to order shipping_status
  const orderStatusMap: Record<string, string> = {
    picked_up: "shipped",
    in_transit: "in_transit",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
    failed_delivery: "failed",
    returned: "returned",
    lost: "lost",
  };
  const newOrderStatus = orderStatusMap[status];
  if (newOrderStatus) {
    const { data: ship } = await supabase.from("shipments").select("order_id").eq("id", shipmentId).single();
    if (ship?.order_id) {
      await supabase.from("orders").update({ shipping_status: newOrderStatus }).eq("id", ship.order_id);
    }
  }
}

export function shipmentStatusLabel(status: string): { ar: string; tone: string } {
  const m: Record<string, { ar: string; tone: string }> = {
    pending: { ar: "بانتظار الشحن", tone: "bg-amber-100 text-amber-800" },
    label_created: { ar: "تم إنشاء البوليصة", tone: "bg-blue-100 text-blue-800" },
    picked_up: { ar: "تم الاستلام", tone: "bg-blue-100 text-blue-800" },
    in_transit: { ar: "قيد النقل", tone: "bg-indigo-100 text-indigo-800" },
    out_for_delivery: { ar: "خرج للتوصيل", tone: "bg-cyan-100 text-cyan-800" },
    delivered: { ar: "تم التسليم", tone: "bg-emerald-100 text-emerald-800" },
    failed_delivery: { ar: "فشل التوصيل", tone: "bg-red-100 text-red-800" },
    returned: { ar: "مرتجع", tone: "bg-orange-100 text-orange-800" },
    lost: { ar: "مفقود", tone: "bg-red-100 text-red-800" },
    cancelled: { ar: "ملغى", tone: "bg-gray-200 text-gray-800" },
  };
  return m[status] || { ar: status, tone: "bg-muted text-foreground" };
}
