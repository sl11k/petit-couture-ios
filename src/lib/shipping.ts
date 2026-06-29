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
  carrier_name_ar: string;
  carrier_name_en: string;
  zone_id: string;
  rate_id: string;
  fee: number;
  delivery_days_min?: number;
  delivery_days_max?: number;
  is_free: boolean;
  free_reason?: string;
}

export interface ShippingCountryOption {
  code: string;
  label: string;
}

const normalizeCountry = (value?: string) => String(value ?? "").trim().toUpperCase();
const normalizeCity = (value?: string) => String(value ?? "").trim().toLowerCase();

function zoneMatchesContext(zone: any, country: string, cityLower: string) {
  if (!country) return false;
  if (normalizeCountry(zone.country_code) !== country) return false;
  const cities = Array.isArray(zone.cities)
    ? zone.cities
        .map((city: unknown) => String(city ?? "").trim())
        .filter(Boolean)
    : [];
  if (!cities.length) return true;
  if (!cityLower) return false;
  return cities.some((city: string) => normalizeCity(city) === cityLower);
}

function computeRateFee(rate: any, ctx: RateContext) {
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

  return { fee, isFree, freeReason };
}

async function loadShippingCatalog(client: any = supabase) {
  const [{ data: carriers }, { data: zones }, { data: rates }] = await Promise.all([
    client
      .from("shipping_carriers")
      .select(
        "id, code, name_ar, name_en, carrier_type, logo_url, is_active, supports_cod, supports_international, supports_tracking, supports_webhook, default_delivery_days_min, default_delivery_days_max, display_order",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    client.from("shipping_zones").select("*").eq("is_active", true),
    client.from("shipping_rates").select("*").eq("is_active", true),
  ]);

  return {
    carriers: carriers ?? [],
    zones: zones ?? [],
    rates: rates ?? [],
  };
}

export async function getAvailableShippingCountries(
  client: any = supabase,
): Promise<ShippingCountryOption[]> {
  const { carriers, zones, rates } = await loadShippingCatalog(client);
  if (!carriers.length || !zones.length || !rates.length) return [];

  const activeCarrierIds = new Set(carriers.map((carrier: any) => carrier.id));
  const zonesWithRates = new Set(
    rates
      .map((rate: any) => String(rate.zone_id || "").trim())
      .filter(Boolean),
  );

  const byCountry = new Map<string, string>();
  for (const zone of zones) {
    if (!activeCarrierIds.has(zone.carrier_id)) continue;
    if (!zonesWithRates.has(String(zone.id))) continue;
    const code = normalizeCountry(zone.country_code);
    if (!code) continue;
    const carrier = carriers.find((item: any) => item.id === zone.carrier_id);
    if (!carrier) continue;
    if (code !== "SA" && carrier.supports_international === false) continue;
    const label = String(zone.name_ar || zone.name_en || code).trim() || code;
    if (!byCountry.has(code)) byCountry.set(code, label);
  }

  return Array.from(byCountry.entries())
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ar"));
}

/**
 * Resolve the best shipping rate for the given context.
 * Picks lowest fee among matching active carriers/zones/rates.
 */
export async function resolveShippingRates(
  ctx: RateContext,
  client: any = supabase,
): Promise<ResolvedRate[]> {
  const { carriers, zones, rates } = await loadShippingCatalog(client);
  if (!carriers?.length) return [];

  const results: ResolvedRate[] = [];
  const country = normalizeCountry(ctx.country_code);
  const cityLower = normalizeCity(ctx.city);

  for (const carrier of carriers) {
    if (ctx.cod_amount && ctx.cod_amount > 0 && !carrier.supports_cod) continue;
    if (country !== "SA" && carrier.supports_international === false) continue;

    let matchedZones = (zones || []).filter((zone: any) => zone.carrier_id === carrier.id && zoneMatchesContext(zone, country, cityLower));
    
    // Strict priority: if we have a matched zone with a specific list of cities, 
    // filter out the country-wide general zones (which have an empty or null cities list).
    const hasSpecificCityZone = matchedZones.some((zone: any) => Array.isArray(zone.cities) && zone.cities.filter(Boolean).length > 0);
    if (hasSpecificCityZone) {
      matchedZones = matchedZones.filter((zone: any) => Array.isArray(zone.cities) && zone.cities.filter(Boolean).length > 0);
    }

    if (!matchedZones.length) continue;

    let best: ResolvedRate | null = null;
    for (const matchedZone of matchedZones) {
      const zoneRates = (rates || []).filter((rate: any) => rate.zone_id === matchedZone.id);
      for (const rate of zoneRates) {
        if (rate.carrier_id && rate.carrier_id !== carrier.id) continue;
        if (rate.min_weight_kg != null && ctx.weight_kg < Number(rate.min_weight_kg)) continue;
        if (rate.max_weight_kg != null && ctx.weight_kg > Number(rate.max_weight_kg)) continue;
        if (rate.min_order_value != null && ctx.order_value < Number(rate.min_order_value)) continue;
        if (rate.max_order_value != null && ctx.order_value > Number(rate.max_order_value)) continue;

        const { fee, isFree, freeReason } = computeRateFee(rate, ctx);
        const candidate: ResolvedRate = {
          carrier_id: carrier.id,
          carrier_code: carrier.code,
          carrier_name_ar: carrier.name_ar ?? carrier.name_en ?? carrier.code,
          carrier_name_en: carrier.name_en ?? carrier.name_ar ?? carrier.code,
          zone_id: matchedZone.id,
          rate_id: rate.id,
          fee,
          delivery_days_min: matchedZone.delivery_days_min ?? carrier.default_delivery_days_min,
          delivery_days_max: matchedZone.delivery_days_max ?? carrier.default_delivery_days_max,
          is_free: isFree,
          free_reason: freeReason,
        };

        const matchedZoneCities = Array.isArray(matchedZone.cities) ? matchedZone.cities.length : 0;
        const bestZoneId = best?.zone_id;
        const bestRateId = best?.rate_id;
        const bestZone = bestZoneId ? zones.find((zone: any) => zone.id === bestZoneId) : null;
        const bestRate = bestRateId ? rates.find((item: any) => item.id === bestRateId) : null;
        const bestZoneCities = bestZone && Array.isArray(bestZone.cities) ? bestZone.cities.length : 0;
        const bestRatePriority = Number(bestRate?.priority ?? 0);

        const shouldReplace =
          !best ||
          fee < best.fee ||
          (fee === best.fee && matchedZoneCities > bestZoneCities) ||
          (fee === best.fee &&
            matchedZoneCities === bestZoneCities &&
            Number(rate.priority ?? 0) < bestRatePriority);

        if (shouldReplace) best = candidate;
      }
    }
    if (best) results.push(best);
  }

  // Enforce a single shipping method per order. Pick the lowest fee, then by
  // carrier display_order. The checkout UI must never present multiple options.
  const sorted = results.sort((a, b) => {
    if (a.fee !== b.fee) return a.fee - b.fee;
    const carrierA = carriers.find((carrier: any) => carrier.id === a.carrier_id);
    const carrierB = carriers.find((carrier: any) => carrier.id === b.carrier_id);
    return Number(carrierA?.display_order ?? 0) - Number(carrierB?.display_order ?? 0);
  });
  return sorted.length ? [sorted[0]] : [];
}

/**
 * Auto-pick the cheapest carrier matching the context, or null if none cover.
 */
export async function autoPickCarrier(
  ctx: RateContext,
  client: any = supabase,
): Promise<ResolvedRate | null> {
  const list = await resolveShippingRates(ctx, client);
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
