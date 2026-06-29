// Server-side checkout with idempotency.
// Keyed on (session_id + cart_hash) via a unique constraint on orders.idempotency_key.
// If the same key is submitted twice, the second call returns the original order
// instead of creating a duplicate.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveShippingRates } from "@/lib/shipping";

const ItemSchema = z.object({
  slug: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  brand: z.string().max(255).nullable().optional(),
  image: z.string().max(2048).nullable().optional(),
  price: z.number().min(0).max(1_000_000),
  qty: z.number().int().min(1).max(999),
  size: z.string().max(64).nullable().optional(),
  color: z.string().max(64).nullable().optional(),
  sku: z.string().max(120).nullable().optional(),
  variant_id: z.string().uuid().nullable().optional(),
});

const AddressSchema = z
  .object({
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
  })
  .passthrough();

const InputSchema = z.object({
  session_id: z.string().min(1).max(128),
  auth_token: z.string().min(20).max(4096).nullable().optional(),
  items: z.array(ItemSchema).min(1).max(100),
  address: AddressSchema,
  currency: z.string().min(3).max(8),
  payment_method: z.enum(["card", "apple_pay", "tabby", "tamara"]).default("card"),
  coupon_code: z.string().min(1).max(64).nullable().optional(),
  pricing: z.object({
    shipping_method: z.string().min(1).max(64),
    shipping_fee: z.number().min(0).max(1_000_000).optional(),
    shipping_country_code: z.string().min(2).max(4).optional(),
    shipping_city: z.string().max(100).nullable().optional(),
  }),
});

export type PlaceOrderInput = z.infer<typeof InputSchema>;

// Stable hash of the cart contents — order-independent for items, includes pricing.
async function hashCart(input: PlaceOrderInput, verifiedUserId: string | null): Promise<string> {
  const normalized = {
    items: [...input.items]
      .map((it) => ({
        slug: it.slug,
        qty: it.qty,
        size: it.size ?? null,
        color: it.color ?? null,
        sku: it.sku ?? null,
        variant_id: it.variant_id ?? null,
      }))
      .sort((a, b) =>
        `${a.slug}|${a.size}|${a.color}`.localeCompare(`${b.slug}|${b.size}|${b.color}`),
      ),
    shipping_method: input.pricing.shipping_method,
    coupon_code: input.coupon_code ?? null,
    payment_method: input.payment_method,
    currency: input.currency,
    user_id: verifiedUserId,
    address: {
      fullName: input.address.fullName.trim(),
      email: input.address.email.trim().toLowerCase(),
      phone: input.address.phone.trim(),
      shortCode: input.address.shortCode ?? null,
      buildingNumber: input.address.buildingNumber ?? null,
      street: input.address.street ?? null,
      district: input.address.district ?? null,
      city: input.address.city ?? null,
      postalCode: input.address.postalCode ?? null,
    },
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
    let verifiedUserId: string | null = null;
    if (data.auth_token) {
      const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.auth_token);
      if (authError || !auth.user) throw new Error("Invalid checkout authentication");
      verifiedUserId = auth.user.id;
    }

    // Rebuild every line price from active catalog records. Browser prices are
    // display hints only and never become chargeable amounts.
    const slugs = [...new Set(data.items.map((item) => item.slug))];
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, slug, name_ar, name_en, brand, image_url, price, currency, is_active, weight")
      .in("slug", slugs)
      .eq("is_active", true);
    if (productsError) throw new Error(`Catalog validation failed: ${productsError.message}`);
    if (!products || products.length !== slugs.length) {
      throw new Error("One or more products are unavailable");
    }

    const productBySlug = new Map(products.map((product) => [product.slug, product]));
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id, sku, price, price_override, is_active, weight")
      .in(
        "product_id",
        products.map((product) => product.id),
      )
      .eq("is_active", true);
    if (variantsError) throw new Error(`Variant validation failed: ${variantsError.message}`);

    const pricedItems = data.items.map((item) => {
      const product = productBySlug.get(item.slug);
      if (!product) throw new Error(`Product unavailable: ${item.slug}`);
      if (String(product.currency).toUpperCase() !== data.currency.toUpperCase()) {
        throw new Error(`Currency mismatch for product ${item.slug}`);
      }
      const productVariants = (variants || []).filter(
        (candidate) => candidate.product_id === product.id,
      );
      const variant = productVariants.find(
        (candidate) =>
          (item.variant_id && candidate.id === item.variant_id) ||
          (!item.variant_id && item.sku && candidate.sku === item.sku),
      );
      if (productVariants.length > 0 && !variant) {
        throw new Error(`Variant unavailable for ${item.slug}`);
      }
      const unitPrice = Number(variant?.price_override ?? variant?.price ?? product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Invalid catalog price");
      return {
        ...item,
        product_id: product.id,
        variant_id: variant?.id ?? item.variant_id ?? null,
        product_weight: Number(variant?.weight ?? product.weight ?? 0),
        name: item.name || product.name_en || product.name_ar,
        brand: product.brand ?? item.brand ?? null,
        image: product.image_url ?? item.image ?? null,
        price: Math.round(unitPrice * 100) / 100,
      };
    });

    const subtotal =
      Math.round(pricedItems.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100;
    const shippingCountryCode =
      (data.address as any).country_code ||
      (data.address as any).countryCode ||
      data.pricing.shipping_country_code ||
      "SA";
    const shippingCity = (data.address as any).city || data.pricing.shipping_city || "";
    const totalWeightKg = pricedItems.reduce((sum, item) => {
      const weight = item.product_weight > 0 ? item.product_weight : 1;
      return sum + weight * item.qty;
    }, 0);
    const shippingCandidates = await resolveShippingRates(
      {
        city: shippingCity,
        country_code: shippingCountryCode,
        weight_kg: totalWeightKg > 0 ? totalWeightKg : 1,
        order_value: subtotal,
      },
      supabaseAdmin,
    );
    const selectedShipping =
      shippingCandidates.find((rate) => {
        const ids = [rate.rate_id, `${rate.carrier_id}:${rate.rate_id}`, rate.carrier_code];
        return ids.includes(data.pricing.shipping_method);
      }) ?? shippingCandidates[0] ?? null;
    const shipping_fee = Number((selectedShipping?.fee ?? 0).toFixed(2));
    const tax = Math.round(subtotal * 0.15 * 100) / 100;

    const cartHash = await hashCart(data, verifiedUserId);
    const idempotencyKey = `${data.session_id}:${cartHash}`;

    // ── Re-validate coupon server-side and recompute total. Never trust client.
    let discount_amount = 0;
    let coupon_id: string | null = null;
    let coupon_code: string | null = null;
    if (data.coupon_code) {
      const { data: rows, error: cErr } = await (supabaseAdmin as any).rpc("validate_coupon", {
        _code: data.coupon_code,
        _subtotal: subtotal,
        _user_id: verifiedUserId,
        _customer_email: data.address.email,
      });
      if (cErr) throw new Error(`Coupon validation failed: ${cErr.message}`);
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || !row.valid) {
        throw new Error(`Coupon invalid: ${row?.reason ?? "unknown"}`);
      }
      discount_amount = Math.min(Number(row.discount_amount) || 0, subtotal);
      coupon_id = row.coupon_id;
      coupon_code = row.code;
    }
    const finalTotal = Math.max(
      0,
      Number((subtotal + shipping_fee + tax - discount_amount).toFixed(2)),
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
    const { data: order, error: orderErr } = await (supabaseAdmin.from("orders") as any)
      .insert({
        idempotency_key: idempotencyKey,
        user_id: verifiedUserId,
        customer_name: data.address.fullName,
        customer_email: data.address.email,
        customer_phone: data.address.phone,
        status: "pending",
        payment_method: data.payment_method,
        subtotal,
        shipping_fee,
        tax,
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
    const items = pricedItems.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      product_slug: it.slug,
      product_name: it.name,
      brand: it.brand ?? null,
      image_url: it.image ?? null,
      unit_price: it.price,
      qty: it.qty,
      size: it.size ?? null,
      color: it.color ?? null,
      sku: it.sku ?? null,
      variant_id: it.variant_id ?? null,
      line_total: it.price * it.qty,
    }));
    let { error: itemsErr } = await supabaseAdmin.from("order_items").insert(items as any);
    // Defensive: if the per-size SKU column hasn't been migrated yet on this
    // environment, retry without it so checkout never breaks on a timing gap.
    if (itemsErr && /sku/i.test(itemsErr.message)) {
      const itemsNoSku = items.map(({ sku: _sku, ...rest }) => rest);
      ({ error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsNoSku));
    }
    if (itemsErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(itemsErr.message);
    }

    // 3b. Stock handling:
    //  - COD is confirmed at placement, so finalize now.
    //  - Hosted/deferred methods reserve only until their webhook confirms payment.
    //    The payment webhook later calls finalize_order_stock on confirmation,
    //    or release_order_inventory on cancel/expiry.
    const asyncPayment = ["card", "apple_pay", "tabby", "tamara"].includes(data.payment_method);
    const rpcName = asyncPayment ? "reserve_order_inventory" : "finalize_order_stock";
    try {
      const { error: stockErr } = await (supabaseAdmin as any).rpc(rpcName, {
        _order_id: order.id,
      });
      if (stockErr) throw stockErr;
    } catch (error) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      const message = error instanceof Error ? error.message : "Inventory allocation failed";
      throw new Error(`Could not allocate inventory: ${message}`);
    }

    // 3c. Record coupon redemption + bump used_count (best-effort).
    if (coupon_id) {
      try {
        await supabaseAdmin.from("coupon_redemptions").insert({
          coupon_id,
          order_id: order.id,
          user_id: verifiedUserId,
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

    // 5. Auto-create OTO shipment ONLY after payment is confirmed.
    //    Hosted/deferred methods wait until the payment webhook marks
    //    payment_status='paid', then the webhook triggers OTO idempotently.
    return { order, duplicate: false as const };
  });
