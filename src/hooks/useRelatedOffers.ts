import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RelatedOffer = {
  id: string;
  relation_type: string;
  display_order: number;
  discount_percent: number | null;
  discount_amount: number | null;
  title_ar: string | null;
  title_en: string | null;
  related: {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string;
    price: number;
    compare_at_price: number | null;
    image_url: string | null;
    brand: string | null;
  };
};

export function useRelatedOffers(productId: string | null) {
  const [data, setData] = useState<RelatedOffer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase
        .from("product_relations")
        .select(
          `id, relation_type, display_order, discount_percent, discount_amount, title_ar, title_en,
           related:products!product_relations_related_product_id_fkey(id, slug, name_ar, name_en, price, compare_at_price, image_url, brand)`
        )
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(6);
      if (cancelled) return;
      setData(((rows ?? []) as any[]).filter((r) => r.related).map((r) => r as RelatedOffer));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { offers: data, loading };
}
