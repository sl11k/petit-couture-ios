import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DbReview = {
  id: string;
  customer_name: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean | null;
  created_at: string;
};

export type DbBundle = {
  id: string;
  name: string;
  description: string | null;
  product_ids: string[];
  bundle_price: number | null;
  discount_percent: number | null;
};

export type DbOffer = {
  id: string;
  offer_type: string;
  config: any;
  starts_at: string | null;
  ends_at: string | null;
};

export function useProductExtras(slug: string) {
  const [productId, setProductId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [bundles, setBundles] = useState<DbBundle[]>([]);
  const [offers, setOffers] = useState<DbOffer[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("products")
        .select("id")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      const pid = p?.id ?? null;
      setProductId(pid);
      if (!pid) {
        setReviews([]);
        setBundles([]);
        setOffers([]);
        return;
      }
      const nowIso = new Date().toISOString();
      const [rev, bun, off] = await Promise.all([
        supabase
          .from("reviews")
          .select("id,customer_name,rating,title,body,verified_purchase,created_at")
          .eq("product_id", pid)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("bundles")
          .select("id,name,description,product_ids,bundle_price,discount_percent,starts_at,ends_at,is_active")
          .eq("is_active", true)
          .contains("product_ids", [pid]),
        supabase
          .from("product_offers")
          .select("id,offer_type,config,starts_at,ends_at,is_active")
          .eq("product_id", pid)
          .eq("is_active", true),
      ]);
      if (cancelled) return;
      setReviews((rev.data as DbReview[]) ?? []);
      const bunActive = ((bun.data as any[]) ?? []).filter(
        (b) => (!b.starts_at || b.starts_at <= nowIso) && (!b.ends_at || b.ends_at >= nowIso),
      );
      setBundles(bunActive as DbBundle[]);
      const offActive = ((off.data as any[]) ?? []).filter(
        (o) => (!o.starts_at || o.starts_at <= nowIso) && (!o.ends_at || o.ends_at >= nowIso),
      );
      setOffers(offActive as DbOffer[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { productId, reviews, bundles, offers };
}
