import { createServerFn } from "@tanstack/react-start";

export type RecoveredItem = {
  slug: string;
  name: string;
  brand?: string | null;
  image?: string | null;
  price: number;
  qty: number;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  variant_id?: string | null;
  variant_label?: string | null;
  currency?: string | null;
};

/**
 * Loads an abandoned cart by its one-time recovery token (sent over WhatsApp).
 * Public on purpose: the token is the credential. Returns only cart contents.
 */
export const getRecoveryCart = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => ({ token: String(d?.token ?? "") }))
  .handler(async ({ data }) => {
    const token = data.token.trim();
    if (!/^[a-f0-9]{16,64}$/i.test(token)) {
      return { ok: false as const, items: [] as RecoveredItem[], coupon: null as string | null };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cart } = await (supabaseAdmin as any)
      .from("abandoned_carts")
      .select("id, items, currency, recovery_coupon_code, converted")
      .eq("recovery_token", token)
      .maybeSingle();

    if (!cart) {
      return { ok: false as const, items: [] as RecoveredItem[], coupon: null as string | null };
    }

    await (supabaseAdmin as any)
      .from("abandoned_carts")
      .update({ contact_status: "clicked", updated_at: new Date().toISOString() })
      .eq("id", cart.id);

    await (supabaseAdmin as any).from("cart_recovery_attempts").insert({
      cart_id: cart.id,
      channel: "whatsapp",
      status: "clicked",
      coupon_code: cart.recovery_coupon_code ?? null,
      metadata: { auto: true },
    });

    return {
      ok: true as const,
      items: (Array.isArray(cart.items) ? cart.items : []) as RecoveredItem[],
      currency: (cart.currency as string | null) ?? "SAR",
      coupon: (cart.recovery_coupon_code as string | null) ?? null,
    };
  });
