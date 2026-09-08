/**
 * Server-only helpers for the public live order-tracking page.
 * Refreshes shipment status straight from the carrier (OTO) API and stores
 * the timeline in `shipment_tracking_events`.
 */

const STALE_MS = 3 * 60 * 1000; // don't hammer the carrier API

type Ev = { status: string; description: string | null; location: string | null; occurred_at: string };

function pickArray(obj: any, depth = 0): any[] | null {
  if (!obj || typeof obj !== "object" || depth > 4) return null;
  for (const key of Object.keys(obj)) {
    const v = (obj as any)[key];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      if (/history|tracking|events|status|timeline|updates/i.test(key)) return v;
    }
  }
  for (const key of Object.keys(obj)) {
    const nested = pickArray((obj as any)[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function toEvent(raw: any): Ev | null {
  if (!raw || typeof raw !== "object") return null;
  const status =
    raw.status ?? raw.statusName ?? raw.state ?? raw.activity ?? raw.event ?? raw.description ?? null;
  const when =
    raw.timestamp ?? raw.time ?? raw.date ?? raw.createdAt ?? raw.created_at ?? raw.updatedAt ?? raw.occurred_at;
  if (!status) return null;
  const ts = when ? new Date(when) : new Date();
  return {
    status: String(status).slice(0, 80),
    description: raw.description ? String(raw.description).slice(0, 300) : null,
    location: (raw.location ?? raw.city ?? raw.hub ?? null) ? String(raw.location ?? raw.city ?? raw.hub).slice(0, 120) : null,
    occurred_at: isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString(),
  };
}

function mapStatus(text: string): string | null {
  const s = text.toLowerCase();
  if (!s) return null;
  if (s.includes("deliver") && !s.includes("out") && !s.includes("attempt")) return "delivered";
  if (s.includes("out for")) return "out_for_delivery";
  if (s.includes("transit")) return "in_transit";
  if (s.includes("pick")) return "picked_up";
  if (s.includes("return")) return "returned";
  if (s.includes("fail") || s.includes("attempt")) return "failed";
  return null;
}

/** Pull the freshest carrier state for a shipment and persist it. Safe to call often. */
export async function refreshShipmentFromCarrier(shipmentId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ship } = await supabaseAdmin
    .from("shipments")
    .select("id,order_id,order_number,tracking_number,status,last_polled_at,carrier_code")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!ship) return;
  if (ship.status === "delivered" || ship.status === "returned") return;
  if (ship.last_polled_at && Date.now() - new Date(ship.last_polled_at).getTime() < STALE_MS) return;

  const lookup = ship.order_number || ship.tracking_number;
  if (!lookup) return;

  try {
    const { otoGetOrderStatus, extractOtoShipmentDetails } = await import("./oto.server");
    const resp: any = await otoGetOrderStatus(lookup);
    const details = extractOtoShipmentDetails(resp);
    const statusText = String(resp?.status ?? resp?.tracking?.status ?? "");
    const mapped = mapStatus(statusText);

    const update: any = { last_polled_at: new Date().toISOString() };
    if (details.trackingNumber) update.tracking_number = details.trackingNumber;
    if (details.trackingUrl) update.tracking_url = details.trackingUrl;
    if (mapped) {
      update.status = mapped;
      if (mapped === "delivered") update.delivered_at = new Date().toISOString();
      if (mapped === "picked_up") update.shipped_at = new Date().toISOString();
    }
    await supabaseAdmin.from("shipments").update(update).eq("id", ship.id);

    // Persist the carrier timeline (deduped by status + timestamp).
    const rows = (pickArray(resp) ?? []).map(toEvent).filter(Boolean) as Ev[];
    if (rows.length) {
      const { data: existing } = await supabaseAdmin
        .from("shipment_tracking_events")
        .select("status,occurred_at")
        .eq("shipment_id", ship.id)
        .limit(500);
      const seen = new Set((existing ?? []).map((e: any) => `${e.status}|${new Date(e.occurred_at).getTime()}`));
      const fresh = rows
        .filter((e) => !seen.has(`${e.status}|${new Date(e.occurred_at).getTime()}`))
        .slice(0, 50)
        .map((e) => ({ ...e, shipment_id: ship.id, source: "carrier" }));
      if (fresh.length) await supabaseAdmin.from("shipment_tracking_events").insert(fresh);
    }
  } catch {
    /* carrier unavailable — the stored state is still shown */
  }
}
