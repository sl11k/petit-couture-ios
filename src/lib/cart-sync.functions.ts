import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCanonicalProductPrice } from "@/lib/pricing";

const Input = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      variantId: z.string().nullable().optional(),
    }),
  ),
});

/**
 * Returns the current catalog price for each cart line so the client can
 * refresh stale prices before the customer proceeds to payment. This keeps
 * the checkout total in perfect sync with what the server will charge.
 */
export const syncCartPrices = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    if (!data.items.length) return { items: [] as Array<{ id: string; price: number }> };
    const slugs = Array.from(new Set(data.items.map((i) => i.slug))).filter(Boolean);
    const variantIds = Array.from(
      new Set(data.items.map((i) => i.variantId).filter((v): v is string => !!v)),
    );

    const [{ data: products }, { data: variants }] = await Promise.all([
      (supabaseAdmin as any)
        .from("products")
        .select("id, slug, price, is_active")
        .in("slug", slugs),
      variantIds.length
        ? (supabaseAdmin as any)
            .from("product_variants")
            .select("id, price, price_override, is_active")
            .in("id", variantIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const bySlug = new Map<string, any>((products ?? []).map((p: any) => [p.slug, p]));
    const byVariant = new Map<string, any>((variants ?? []).map((v: any) => [v.id, v]));

    const out = data.items.map((line) => {
      const prod = bySlug.get(line.slug);
      const variant = line.variantId ? byVariant.get(line.variantId) : null;
      const price = getCanonicalProductPrice(
        prod?.price ?? null,
        variant?.price_override ?? variant?.price ?? null,
      );
      return { id: line.id, price, available: !!prod?.is_active };
    });
    return { items: out };
  });
