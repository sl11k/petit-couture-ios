import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendMessage } from "@/lib/messaging";
import { getCanonicalProductPrice } from "@/lib/pricing";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asUuid = (v: unknown) => (typeof v === "string" && UUID_RE.test(v.trim()) ? v.trim() : null);
const asEmail = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s && s.length <= 255 && EMAIL_RE.test(s) ? s : null;
};

// Lenient on purpose: bad emails / non-uuid variant ids must never throw,
// otherwise the UI shows a generic "could not validate coupon" error.
const Input = z.object({
  code: z.string().min(1).max(64),
  cart_items: z.array(z.object({
    slug: z.string(),
    variant_id: z.any().transform(asUuid).nullable().optional(),
    price: z.coerce.number().catch(0),
    qty: z.coerce.number().catch(0),
    is_discounted: z.coerce.boolean().catch(false),
  })).default([]),
  user_id: z.any().transform(asUuid).nullable().optional(),
  customer_email: z.any().transform(asEmail).nullable().optional(),
});

export type ValidateCouponResult =
  | { ok: true; code: string; discount_amount: number; discount_type: string; discount_value: number; coupon_id: string }
  | { ok: false; reason: string; message_ar: string; message_en: string };

function messageFor(reason: string, extra?: { min_subtotal?: number; currency?: string }): { ar: string; en: string } {
  const cur = extra?.currency || "SAR";
  switch (reason) {
    case "not_found": return { ar: "كود الكوبون غير موجود", en: "Coupon code not found" };
    case "inactive": return { ar: "هذا الكوبون غير مفعّل", en: "This coupon is inactive" };
    case "not_started": return { ar: "لم يبدأ سريان الكوبون بعد", en: "Coupon has not started yet" };
    case "expired": return { ar: "انتهت صلاحية الكوبون", en: "Coupon has expired" };
    case "usage_limit_reached": return { ar: "تم استنفاد عدد مرات استخدام الكوبون", en: "Coupon usage limit reached" };
    case "per_customer_limit": return { ar: "استخدمت هذا الكوبون من قبل", en: "You've already used this coupon" };
    case "not_first_order": return { ar: "هذا الكوبون للطلب الأول فقط", en: "This coupon is for first orders only" };
    case "first_order_requires_login": return { ar: "أدخل بريدك الإلكتروني لاستخدام هذا الكوبون", en: "Enter your email to use this coupon" };
    case "not_allowed_user": return { ar: "هذا الكوبون غير متاح لحسابك", en: "This coupon is not available for your account" };
    case "empty_cart": return { ar: "سلتك فارغة", en: "Your cart is empty" };
    case "no_eligible_items": return { ar: "الكوبون لا ينطبق على المنتجات في سلتك", en: "Coupon doesn't apply to items in your cart" };
    case "unsupported_discount_type": return { ar: "نوع الخصم غير مدعوم", en: "Unsupported discount type" };
    case "min_subtotal":
      return extra?.min_subtotal
        ? { ar: `الحد الأدنى للطلب ${extra.min_subtotal} ${cur}`, en: `Minimum order amount is ${extra.min_subtotal} ${cur}` }
        : { ar: "الحد الأدنى للطلب غير مستوفى", en: "Minimum order amount not met" };
    case "empty_code": return { ar: "أدخل كود الكوبون", en: "Enter a coupon code" };
    default: return { ar: "كوبون غير صالح", en: "Invalid coupon" };
  }
}



export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ValidateCouponResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slugs = data.cart_items.map(it => it.slug);
    const variantIds = data.cart_items
      .map((it) => it.variant_id)
      .filter((id): id is string => Boolean(id));

    const [{ data: products }, { data: variants }] = await Promise.all([
      (supabaseAdmin as any)
        .from("products")
        .select("id, slug, price, compare_at_price")
        .in("slug", slugs),
      variantIds.length
        ? (supabaseAdmin as any)
            .from("product_variants")
            .select("id, product_id, price, price_override, compare_at_price")
            .in("id", variantIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const productBySlug = new Map<string, any>(products?.map((p: any) => [p.slug, p]) || []);
    const variantById = new Map<string, any>(variants?.map((v: any) => [v.id, v]) || []);
    
    const dbCartItems = data.cart_items.map((it) => {
      const product = productBySlug.get(it.slug);
      const variant = it.variant_id ? variantById.get(it.variant_id) : null;
      const catalogPrice = getCanonicalProductPrice(
        product?.price ?? null,
        variant?.price_override ?? variant?.price ?? null,
      );
      const compareAt = Number(variant?.compare_at_price ?? product?.compare_at_price ?? 0);
      return {
        product_id: product?.id || "",
        price: Number.isFinite(catalogPrice) && catalogPrice >= 0 ? catalogPrice : it.price,
        qty: it.qty,
        is_discounted: it.is_discounted || (compareAt > 0 && catalogPrice < compareAt),
      };
    });

    const { data: rows, error } = await (supabaseAdmin as any).rpc("validate_coupon", {
      _code: data.code,
      _cart_items: dbCartItems,
      _user_id: data.user_id ?? null,
      _customer_email: data.customer_email ?? null,
    });
    if (error) {
      const m = messageFor("unknown");
      return { ok: false, reason: "error", message_ar: m.ar, message_en: m.en };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.valid) {
      const reason = row?.reason ?? "unknown";
      let extra: { min_subtotal?: number; currency?: string } | undefined;
      if (reason === "min_subtotal") {
        const { data: c } = await (supabaseAdmin as any)
          .from("coupons")
          .select("min_subtotal")
          .ilike("code", data.code)
          .maybeSingle();
        if (c?.min_subtotal) extra = { min_subtotal: Number(c.min_subtotal), currency: "SAR" };
      }
      const m = messageFor(reason, extra);
      return { ok: false, reason, message_ar: m.ar, message_en: m.en };
    }

    return {
      ok: true,
      code: row.code,
      discount_amount: Number(row.discount_amount) || 0,
      discount_type: row.discount_type,
      discount_value: Number(row.discount_value) || 0,
      coupon_id: row.coupon_id,
    };
  });

export const notifyCouponUsers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      coupon_id: z.string().uuid(),
      message: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: coupon } = await (supabaseAdmin as any)
      .from("coupons")
      .select("allowed_user_ids")
      .eq("id", data.coupon_id)
      .single();

    if (!coupon || !coupon.allowed_user_ids || !Array.isArray(coupon.allowed_user_ids)) {
      return { ok: false, error: "No users assigned to this coupon." };
    }

    const userIds = coupon.allowed_user_ids as string[];
    // fetch phone numbers
    const { data: profiles } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, phone")
      .in("id", userIds);

    const phones = (profiles || [])
      .map((p: any) => p.phone)
      .filter((p: string | null) => !!p);

    if (phones.length === 0) {
      return { ok: false, error: "No valid phone numbers found for the assigned users." };
    }

    let successCount = 0;
    for (const phone of phones) {
      try {
        await sendMessage({
          channel: "whatsapp",
          phone,
          body: data.message,
        });
        successCount++;
      } catch (e) {
        // ignore individual failures
      }
    }

    return { ok: true, count: successCount };
  });
