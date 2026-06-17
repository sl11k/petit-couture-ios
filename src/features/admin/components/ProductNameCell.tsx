// src/features/admin/components/ProductNameCell.tsx
//
// Resolves a product UUID to its display name (with a small in-memory cache),
// so admin tables can show readable product names instead of raw IDs.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

type CachedProduct = { name_ar: string | null; name_en: string | null; image_url: string | null; slug: string | null };
const cache = new Map<string, CachedProduct | null>();
const inflight = new Map<string, Promise<CachedProduct | null>>();

async function fetchProduct(id: string): Promise<CachedProduct | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  if (inflight.has(id)) return inflight.get(id)!;
  const p = (async () => {
    const { data } = await supabase
      .from("products")
      .select("name_ar, name_en, image_url, slug")
      .eq("id", id)
      .maybeSingle();
    const row = (data as CachedProduct | null) ?? null;
    cache.set(id, row);
    inflight.delete(id);
    return row;
  })();
  inflight.set(id, p);
  return p;
}

export function ProductNameCell({ productId }: { productId: string | null | undefined }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [row, setRow] = useState<CachedProduct | null | undefined>(
    productId ? cache.get(productId) : null,
  );

  useEffect(() => {
    if (!productId) { setRow(null); return; }
    if (cache.has(productId)) { setRow(cache.get(productId) ?? null); return; }
    let cancelled = false;
    fetchProduct(productId).then((r) => { if (!cancelled) setRow(r); });
    return () => { cancelled = true; };
  }, [productId]);

  if (!productId) return <span className="text-muted-foreground">—</span>;
  if (row === undefined) {
    return <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-muted" />;
  }
  if (!row) {
    return <span className="font-mono text-[10px] text-muted-foreground" title={productId}>{productId.slice(0, 8)}…</span>;
  }
  const name = (ar ? row.name_ar || row.name_en : row.name_en || row.name_ar) || "—";
  const content = (
    <span className="inline-flex items-center gap-2">
      {row.image_url && (
        <img src={row.image_url} alt="" className="h-7 w-7 shrink-0 rounded object-cover" loading="lazy" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
  if (row.slug) {
    return (
      <Link to="/product/$slug" params={{ slug: row.slug }} target="_blank" className="hover:underline">
        {content}
      </Link>
    );
  }
  return content;
}
