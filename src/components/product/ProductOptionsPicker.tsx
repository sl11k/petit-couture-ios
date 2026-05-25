// src/components/product/ProductOptionsPicker.tsx
// Storefront option picker — reads product_options_public view.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export type ProductOption = {
  option_id: string;
  option_type: string;
  value_ar: string | null;
  value_en: string | null;
  color_hex: string | null;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  sort_order: number;
};

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  color:    { ar: "اللون",    en: "Colour" },
  size:     { ar: "المقاس",   en: "Size" },
  age:      { ar: "العمر",    en: "Age" },
  shape:    { ar: "الشكل",    en: "Shape" },
  occasion: { ar: "المناسبة", en: "Occasion" },
  material: { ar: "الخامة",   en: "Material" },
  season:   { ar: "الموسم",   en: "Season" },
  style:    { ar: "الأسلوب",  en: "Style" },
};

export function ProductOptionsPicker({ productId, onImageChange, onSelectionChange, className }: {
  productId: string;
  onImageChange?: (imageUrl: string | null) => void;
  onSelectionChange?: (picked: Record<string, ProductOption | null>) => void;
  className?: string;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [rows, setRows] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("product_options_public")
        .select("option_id, option_type, value_ar, value_en, color_hex, image_url, stock, is_active, sort_order")
        .eq("product_id", productId)
        .order("option_type", { ascending: true })
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[ProductOptionsPicker] fetch failed", error);
        setRows([]);
      } else {
        setRows((data ?? []) as ProductOption[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const inStock = useMemo(() => rows.filter((r) => Number(r.stock) > 0), [rows]);
  const groups = useMemo(() => {
    const g: Record<string, ProductOption[]> = {};
    for (const r of inStock) (g[r.option_type || "_other"] ||= []).push(r);
    return g;
  }, [inStock]);

  useEffect(() => {
    if (loading || Object.keys(groups).length === 0) return;
    const initial: Record<string, string> = {};
    for (const [type, list] of Object.entries(groups)) {
      const first = list[0];
      if (first) initial[type] = first.option_id;
    }
    setPicked(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, JSON.stringify(Object.keys(groups))]);

  useEffect(() => {
    if (loading) return;
    const out: Record<string, ProductOption | null> = {};
    for (const [type, list] of Object.entries(groups)) {
      const id = picked[type];
      out[type] = id ? list.find((r) => r.option_id === id) ?? null : null;
    }
    onSelectionChange?.(out);
    const colorOpt = out["color"];
    if (colorOpt?.image_url) onImageChange?.(colorOpt.image_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, loading]);

  const labelOf = (type: string) => {
    const m = TYPE_LABELS[type.toLowerCase()];
    if (m) return ar ? m.ar : m.en;
    return type;
  };
  const valueOf = (r: ProductOption) =>
    (ar ? r.value_ar || r.value_en : r.value_en || r.value_ar) || "—";

  if (loading) return null;
  if (Object.keys(groups).length === 0) return null;

  return (
    <section className={cn("my-4 space-y-4", className)} dir={ar ? "rtl" : "ltr"}>
      {Object.entries(groups).map(([type, list]) => {
        const isColor = type.toLowerCase() === "color";
        const selectedId = picked[type];
        return (
          <div key={type}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium uppercase tracking-wide text-muted-foreground">{labelOf(type)}</span>
              {selectedId && (<span className="text-muted-foreground">{valueOf(list.find((r) => r.option_id === selectedId)!)}</span>)}
            </div>
            {isColor ? (
              <div className="flex flex-wrap items-center gap-3">
                {list.map((r) => {
                  const isSel = selectedId === r.option_id;
                  return (
                    <button key={r.option_id} type="button" onClick={() => setPicked((s) => ({ ...s, [type]: r.option_id }))} aria-label={valueOf(r)} aria-pressed={isSel} className={cn("relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition", isSel ? "border-foreground ring-2 ring-foreground/30" : "border-border hover:border-foreground/60")} style={{ backgroundColor: r.color_hex || "transparent" }}>
                      {!r.color_hex && (<span className="text-[10px] font-semibold text-foreground/80">{valueOf(r).slice(0, 2)}</span>)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {list.map((r) => {
                  const isSel = selectedId === r.option_id;
                  return (
                    <button key={r.option_id} type="button" onClick={() => setPicked((s) => ({ ...s, [type]: r.option_id }))} aria-pressed={isSel} className={cn("rounded-full border px-3 py-1.5 text-xs transition", isSel ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/60")}>
                      {valueOf(r)}
                      <span className="ms-1 text-[10px] opacity-60">· {r.stock}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

