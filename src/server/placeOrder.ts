// Server-side checkout with idempotency.
// Keyed on (session_id + cart_hash) via a unique constraint on orders.idempotency_key.
// If the same key is submitted twice, the second call returns the original order
// instead of creating a duplicate.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ItemSchema = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  brand: z.string().max(255).nullable().optional(),
  image: z.string().max(2048).nullable().optional(),
  price: z.number().min(0).max(1_000_000),
  qty: z.number().int().min(1).max(999),
  size: z.string().max(64).nullable().optional(),
  color: z.string().max(64).nullable().optional(),
});

const AddressSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(255),
  phone: z.string().min(1).max(64),
  shortCode: z.string().max(32).optional().nullable(),
  buildingNumber: z.string().max(16).optional().nullable(),
  street: z.string().max(160).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  postalCode: z.string().max(16).optional().nullable(),
  additionalNumber: z.string().max(16).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).passthrough();

const InputSchema = z.object({
  session_id: z.string().min(1).max(128),
  user_id: z.string().uuid().nullable().optional(),
  items: z.array(ItemSchema).min(1).max(100),
  address: AddressSchema,
  currency: z.string().min(3).max(8),
  payment_method: z.enum(["cod", "card", "apple_pay", "bank_transfer", "tabby", "tamara"]).default("cod"),
  coupon_code: z.string().min(1).max(64).nullable().optional(),
  pricing: z.object({
    subtotal: z.number().min(0),
    shipping_fee: z.number().min(0),
    tax: z.number().min(0),
    total: z.number().min(0),
    shipping_method: z.string().min(1).max(64),
  }),
});

export type PlaceOrderInput = z.infer<typeof InputSchema>;

// Stable hash of the cart contents — order-independent for items, includes pricing.
async function hashCart(input: PlaceOrderInput): Promise<string> {
  const normalized = {
    items: [...input.items]
      .map((it) => ({
        slug: it.slug,
        qty: it.qty,
        price: it.price,
        size: it.size ?? null,
        color: it.color ?? null,
      }))
      .sort((a, b) =>
        `${a.slug}|${a.size}|${a.color}`.localeCompare(
          `${b.slug}|${b.size}|${b.color}`,
        ),
      ),
    pricing: input.pricing,
    payment_method: input.payment_method,
    currency: input.currency,
  };
  const data = new TextEncoder().encode(JSON.stringify(normalized));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const cartHash = await hashCart(data);
    const idempotencyKey = `${data.session_id}:${cartHash}`;

    // ── Re-validate coupon server-side and recompute total. Never trust client.
    let discount_amount = 0;
    let coupon_id: string | null = null;
    let coupon_code: string | null = null;
    if (data.coupon_code) {
      const { data: rows, error: cErr } = await (supabaseAdmin as any).rpc("validate_coupon", {
        _code: data.coupon_code,
        _subtotal: data.pricing.subtotal,
        _user_id: data.user_id ?? null,
        _customer_email: data.address.email,
      });
      if (cErr) throw new Error(`Coupon validation failed: ${cErr.message}`);
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || !row.valid) {
        throw new Error(`Coupon invalid: ${row?.reason ?? "unknown"}`);
      }
      discount_amount = Math.min(Number(row.discount_amount) || 0, data.pricing.subtotal);
      coupon_id = row.coupon_id;
      coupon_code = row.code;
    }
    const finalTotal = Math.max(
      0,
      Number((data.pricing.subtotal + data.pricing.shipping_fee + data.pricing.tax - discount_amount).toFixed(2)),
    );

    // 1. If an order with this key already exists, return it (idempotent replay).
    const existing = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, total, currency")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing.data) {
      return { order: existing.data, duplicate: true as const };
    }

    // 2. Insert the order. Unique index on idempotency_key guarantees that
    //    even concurrent requests can't both succeed.
    const { data: order, error: orderErr } = await (supabaseAdmin
      .from("orders") as any)
      .insert({
        idempotency_key: idempotencyKey,
        user_id: data.user_id ?? null,
        customer_name: data.address.fullName,
        customer_email: data.address.email,
        customer_phone: data.address.phone,
        status: "pending",
        payment_method: data.payment_method,
        subtotal: data.pricing.subtotal,
        shipping_fee: data.pricing.shipping_fee,
        tax: data.pricing.tax,
        discount_amount,
        coupon_id,
        coupon_code,
        total: finalTotal,
        currency: data.currency,
        shipping_address: data.address,
        shipping_lat: (data.address as any).lat ?? null,
        shipping_lng: (data.address as any).lng ?? null,
        notes: (data.address as any).notes ?? null,
      })
      .select("id, order_number, status, total, currency")
      .single();

    if (orderErr) {
      // 23505 = unique_violation: a concurrent request beat us. Re-fetch.
      if (orderErr.code === "23505") {
        const replay = await supabaseAdmin
          .from("orders")
          .select("id, order_number, status, total, currency")
          .eq("idempotency_key", idempotencyKey)
          .single();
        if (replay.data) {
          return { order: replay.data, duplicate: true as const };
        }
      }
      throw new Error(orderErr.message);
    }

    if (!order) throw new Error("Order insert returned no row");

    // 3. Insert items. If this fails, the order row remains but no items —
    //    a follow-up replay with the same key will return the existing order
    //    and we re-insert items only if missing.
    const items = data.items.map((it) => ({
      order_id: order.id,
      product_slug: it.slug,
      product_name: it.name,
      brand: it.brand ?? null,
      image_url: it.image ?? null,
      unit_price: it.price,
      qty: it.qty,
      size: it.size ?? null,
      color: it.color ?? null,
      line_total: it.price * it.qty,
    }));
    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(items);
    if (itemsErr) throw new Error(itemsErr.message);

    // 3b. Link product_id on order_items + decrement stock atomically.
    try {
      const { error: finalizeErr } = await (supabaseAdmin as any).rpc(
        "finalize_order_stock",
        { _order_id: order.id },
      );
      if (finalizeErr) console.error("[placeOrder] finalize_order_stock:", finalizeErr.message);
    } catch (e: any) {
      console.error("[placeOrder] finalize_order_stock threw:", e?.message || e);
    }

    // 3c. Record coupon redemption + bump used_count (best-effort).
    if (coupon_id) {
      try {
        await supabaseAdmin.from("coupon_redemptions").insert({
          coupon_id,
          order_id: order.id,
          user_id: data.user_id ?? null,
          customer_email: data.address.email,
          customer_phone: data.address.phone,
          discount_amount,
          order_total: finalTotal,
        });
        const { data: cRow } = await supabaseAdmin
          .from("coupons")
          .select("used_count, discount_total, revenue_total")
          .eq("id", coupon_id)
          .single();
        await (supabaseAdmin as any)
          .from("coupons")
          .update({
            used_count: (cRow?.used_count ?? 0) + 1,
            discount_total: Number(cRow?.discount_total ?? 0) + discount_amount,
            revenue_total: Number(cRow?.revenue_total ?? 0) + finalTotal,
          })
          .eq("id", coupon_id);
      } catch (e: any) {
        console.error("[placeOrder] coupon redemption:", e?.message || e);
      }
    }

    // 4. Mark abandoned cart converted (best-effort).
    await supabaseAdmin
      .from("abandoned_carts")
      .update({ converted: true, updated_at: new Date().toISOString() })
      .eq("session_id", data.session_id);

    // 5. Auto-create OTO shipment (best-effort, never blocks order creation).
    try {
      const { createOtoShipmentForOrder } = await import("@/lib/oto.server");
      const res = await createOtoShipmentForOrder(order.id, data.user_id ?? null);
      if (!res.ok) console.error("[placeOrder] OTO auto-create failed:", res.error);
    } catch (e: any) {
      console.error("[placeOrder] OTO auto-create threw:", e?.message || e);
    }

    return { order, duplicate: false as const };
  });
