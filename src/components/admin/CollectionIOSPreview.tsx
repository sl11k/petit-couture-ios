import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

type SortMode = "manual" | "newest" | "best_sellers" | "price_asc" | "price_desc";

type Product = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  slug: string | null;
  price: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at?: string;
  sales_count?: number | null;
};

export type PreviewPage = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  hero_image?: string | null;
  cta_text?: string | null;
  coupon_code?: string | null;
  product_ids: string[];
  sort_mode: SortMode;
  is_active: boolean;
};

export function CollectionIOSPreview({ page }: { page: PreviewPage }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [items, setItems] = useState<Product[]>([]);

  const idsKey = useMemo(() => page.product_ids.join(","), [page.product_ids]);

  useEffect(() => {
    if (page.product_ids.length === 0) { setItems([]); return; }
    supabase.from("products")
      .select("id, name_ar, name_en, slug, price, image_url, is_active, created_at, sales_count")
      .in("id", page.product_ids)
      .then(({ data }) => {
        const map = new Map((data ?? []).map((p) => [p.id, p as Product]));
        let list = page.product_ids.map((id) => map.get(id)).filter(Boolean) as Product[];

        // Sort according to selected mode
        if (page.sort_mode === "newest") {
          list = list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        } else if (page.sort_mode === "best_sellers") {
          list = list.sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0));
        } else if (page.sort_mode === "price_asc") {
          list = list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        } else if (page.sort_mode === "price_desc") {
          list = list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        }
        setItems(list);
      });
  }, [idsKey, page.sort_mode]);

  return (
    <div className="sticky top-20">
      <p className="text-xs font-medium text-muted-foreground mb-2 text-center">
        {ar ? "معاينة مباشرة على iOS" : "Live iOS preview"}
      </p>

      {/* iPhone frame */}
      <div className="mx-auto w-[320px] rounded-[2.75rem] border-[10px] border-foreground bg-foreground shadow-2xl">
        <div className="relative rounded-[2.1rem] overflow-hidden bg-background h-[640px]">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 h-6 w-32 bg-foreground rounded-b-2xl" />
          {/* Status bar */}
          <div className="h-9 bg-background z-10 relative" />

          {/* Scrollable content */}
          <div className="h-[calc(100%-2.25rem)] overflow-y-auto" dir={ar ? "rtl" : "ltr"}>
            {/* Hero */}
            {page.hero_image ? (
              <div className="relative">
                <img
                  src={page.hero_image}
                  alt=""
                  className="w-full aspect-[4/5] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-3 text-white">
                  <h1 className="font-serif text-base leading-tight">{page.title || (ar ? "عنوان الصفحة" : "Page title")}</h1>
                  {page.subtitle && <p className="text-[10px] mt-1 opacity-90">{page.subtitle}</p>}
                  {page.cta_text && (
                    <span className="mt-2 inline-block w-fit bg-white text-black text-[10px] px-3 py-1.5 rounded">
                      {page.cta_text}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-4 py-6 text-center">
                <h1 className="font-serif text-xl text-foreground">{page.title || (ar ? "عنوان الصفحة" : "Page title")}</h1>
                {page.subtitle && <p className="mt-1.5 text-[11px] text-muted-foreground">{page.subtitle}</p>}
              </div>
            )}

            {page.description && (
              <p className="px-4 py-3 text-[11px] text-muted-foreground text-center leading-relaxed">
                {page.description}
              </p>
            )}

            {page.coupon_code && (
              <div className="mx-4 my-2 rounded border border-gold/40 bg-cream-warm px-3 py-2 text-center text-[10px]">
                {ar ? "كود: " : "Code: "}
                <span className="font-mono font-semibold text-gold-deep">{page.coupon_code}</span>
              </div>
            )}

            {/* Grid */}
            <div className="px-3 py-3">
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-10">
                  {ar ? "لا توجد منتجات بعد." : "No products yet."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {items.map((p) => {
                    const name = ar ? (p.name_ar ?? p.name_en) : (p.name_en ?? p.name_ar);
                    return (
                      <div key={p.id} className="block">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-full aspect-[4/5] object-cover rounded" />
                        ) : (
                          <div className="aspect-[4/5] bg-muted rounded" />
                        )}
                        <p className="mt-1.5 text-[10px] text-foreground line-clamp-1">{name}</p>
                        {p.price != null && (
                          <p className="text-[10px] text-gold-deep">{p.price.toFixed(2)} {ar ? "ر.س" : "SAR"}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="h-6" />
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-24 bg-foreground/40 rounded-full" />
        </div>
      </div>

      <p className="text-[11px] text-center text-muted-foreground mt-2">
        {page.is_active
          ? (ar ? "● منشورة — التغييرات ستظهر فوراً" : "● Published — changes are live")
          : (ar ? "○ مسودة (غير منشورة)" : "○ Draft (not published)")}
      </p>
    </div>
  );
}
