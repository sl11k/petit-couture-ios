import { supabase } from "@/integrations/supabase/client";

export type OfferType =
  | "coupon"
  | "auto"
  | "first_order"
  | "free_shipping"
  | "bxgy"
  | "bundle"
  | "category"
  | "product"
  | "city"
  | "threshold";

export type DiscountType = "percent" | "fixed" | "free_shipping" | "bxgy" | "bundle";

export type CartItem = {
  product_id?: string | null;
  category_ids?: string[];
  qty: number;
  unit_price: number;
};

export type ApplyContext = {
  items: CartItem[];
  subtotal: number;
  shipping_fee: number;
  city?: string | null;
  payment_method?: string | null;
  shipping_zone_id?: string | null;
  user_id?: string | null;
  customer_email?: string | null;
  is_first_order?: boolean;
};

export type ApplyResult = {
  ok: boolean;
  reason?: string;
  discount: number;
  free_shipping: boolean;
  coupon?: { id: string; code: string; name?: string | null };
};

const COUPON_PUBLIC_COLS =
  "id, code, description, discount_type, discount_value, min_subtotal, max_uses, used_count, starts_at, expires_at, is_active, created_at, updated_at, name, offer_type, bxgy_config, bundle_config, per_customer_limit, first_order_only, allowed_cities, allowed_payment_methods, allowed_shipping_zones, included_product_ids, excluded_product_ids, included_category_ids, no_combine, auto_apply, priority";

export async function fetchActiveCoupon(code: string) {
  const { data, error } = await supabase
    .from("coupons")
    .select(COUPON_PUBLIC_COLS)
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function jsonArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

export function evaluateCoupon(c: any, ctx: ApplyContext): ApplyResult {
  const fail = (reason: string): ApplyResult => ({ ok: false, reason, discount: 0, free_shipping: false });
  const now = new Date();
  if (!c.is_active) return fail("الكوبون غير مفعل");
  if (c.starts_at && new Date(c.starts_at) > now) return fail("الكوبون لم يبدأ بعد");
  if (c.expires_at && new Date(c.expires_at) < now) return fail("الكوبون منتهي");
  if (c.max_uses != null && c.used_count >= c.max_uses) return fail("استُنفد عدد الاستخدامات");
  if (c.min_subtotal && ctx.subtotal < Number(c.min_subtotal)) return fail(`الحد الأدنى ${c.min_subtotal}`);
  if (c.first_order_only && !ctx.is_first_order) return fail("للطلب الأول فقط");

  const allowedUsers = jsonArr(c.allowed_user_ids);
  if (allowedUsers.length && (!ctx.user_id || !allowedUsers.includes(ctx.user_id))) return fail("غير متاح لهذا العميل");

  const allowedCities = jsonArr(c.allowed_cities);
  if (allowedCities.length && (!ctx.city || !allowedCities.includes(ctx.city))) return fail("غير متاح في مدينتك");

  const allowedPM = jsonArr(c.allowed_payment_methods);
  if (allowedPM.length && (!ctx.payment_method || !allowedPM.includes(ctx.payment_method))) return fail("غير متاح لطريقة الدفع");

  const allowedZones = jsonArr(c.allowed_shipping_zones);
  if (allowedZones.length && (!ctx.shipping_zone_id || !allowedZones.includes(ctx.shipping_zone_id))) return fail("غير متاح لمنطقة الشحن");

  const included = jsonArr(c.included_product_ids);
  const excluded = jsonArr(c.excluded_product_ids);
  const incCats = jsonArr(c.included_category_ids);

  const eligibleItems = ctx.items.filter((it) => {
    if (excluded.length && it.product_id && excluded.includes(it.product_id)) return false;
    if (included.length && (!it.product_id || !included.includes(it.product_id))) return false;
    if (incCats.length) {
      const cats = it.category_ids ?? [];
      if (!cats.some((cid) => incCats.includes(cid))) return false;
    }
    return true;
  });

  if ((included.length || incCats.length || excluded.length) && eligibleItems.length === 0) {
    return fail("لا توجد منتجات مؤهلة في السلة");
  }

  const eligibleSubtotal = eligibleItems.reduce((s, it) => s + it.qty * it.unit_price, 0);
  const baseSubtotal = (included.length || incCats.length) ? eligibleSubtotal : ctx.subtotal;

  let discount = 0;
  let free_shipping = false;

  switch (c.discount_type as DiscountType) {
    case "percent":
      discount = (baseSubtotal * Number(c.discount_value || 0)) / 100;
      break;
    case "fixed":
      discount = Math.min(Number(c.discount_value || 0), baseSubtotal);
      break;
    case "free_shipping":
      free_shipping = true;
      discount = ctx.shipping_fee || 0;
      break;
    case "bxgy": {
      const cfg = c.bxgy_config || {};
      const buy = Math.max(1, Number(cfg.buy_qty ?? 1));
      const get = Math.max(1, Number(cfg.get_qty ?? 1));
      const getDiscPct = Math.max(0, Math.min(100, Number(cfg.get_discount_percent ?? 100)));
      const sorted = [...eligibleItems].flatMap((it) => Array(it.qty).fill(it.unit_price)).sort((a, b) => a - b);
      const groupSize = buy + get;
      const groups = Math.floor(sorted.length / groupSize);
      for (let g = 0; g < groups; g++) {
        const groupPrices = sorted.slice(g * groupSize, g * groupSize + groupSize);
        const cheapest = groupPrices.slice(0, get);
        discount += cheapest.reduce((s, p) => s + p * (getDiscPct / 100), 0);
      }
      break;
    }
    case "bundle": {
      const cfg = c.bundle_config || {};
      const requiredIds = jsonArr(cfg.product_ids);
      const bundlePrice = Number(cfg.bundle_price ?? 0);
      const haveAll = requiredIds.every((pid) => ctx.items.some((it) => it.product_id === pid && it.qty >= 1));
      if (haveAll && bundlePrice > 0) {
        const original = requiredIds.reduce((s, pid) => {
          const it = ctx.items.find((x) => x.product_id === pid);
          return s + (it ? it.unit_price : 0);
        }, 0);
        discount = Math.max(0, original - bundlePrice);
      }
      break;
    }
  }

  discount = Math.max(0, Math.min(discount, ctx.subtotal));

  return {
    ok: true,
    discount,
    free_shipping,
    coupon: { id: c.id, code: c.code, name: c.name },
  };
}

export async function applyCouponCode(code: string, ctx: ApplyContext): Promise<ApplyResult> {
  try {
    const c = await fetchActiveCoupon(code);
    if (!c) return { ok: false, reason: "كود غير صحيح", discount: 0, free_shipping: false };
    if (ctx.user_id && c.per_customer_limit) {
      const { count } = await supabase
        .from("coupon_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("coupon_id", c.id)
        .eq("user_id", ctx.user_id);
      if ((count ?? 0) >= c.per_customer_limit) {
        return { ok: false, reason: "تجاوزت حد الاستخدام لكل عميل", discount: 0, free_shipping: false };
      }
    }
    return evaluateCoupon(c, ctx);
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "خطأ", discount: 0, free_shipping: false };
  }
}

export async function fetchAutoOffers(ctx: ApplyContext): Promise<ApplyResult[]> {
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .eq("auto_apply", true)
    .order("priority", { ascending: true });
  if (!data) return [];
  return data.map((c) => evaluateCoupon(c, ctx)).filter((r) => r.ok && r.discount > 0);
}

export async function recordRedemption(args: {
  coupon_id: string;
  order_id?: string;
  user_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  discount_amount: number;
  order_total: number;
}) {
  await supabase.from("coupon_redemptions").insert(args);
  // Increment counters - read-modify-write (no race-critical here since admin display)
  const { data: c } = await supabase.from("coupons").select("used_count, discount_total, revenue_total").eq("id", args.coupon_id).maybeSingle();
  if (c) {
    await supabase
      .from("coupons")
      .update({
        used_count: (c.used_count ?? 0) + 1,
        discount_total: Number(c.discount_total ?? 0) + args.discount_amount,
        revenue_total: Number(c.revenue_total ?? 0) + args.order_total,
      })
      .eq("id", args.coupon_id);
  }
}
