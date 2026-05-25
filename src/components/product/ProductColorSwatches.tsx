// src/components/product/ProductColorSwatches.tsx
//
// Storefront colour-swatch picker — reads the `product_variants_public`
// view added by schema_upgrade_v2.sql.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

type Row = {
  variant_id: string;
  color_name_ar: string | null;
  color_name_en: string | null;
  color_hex: string | null;
  color_image_url: string | null;
  size: string | null;
  available_quantity: number | null;
  is_active: boolean;
  sort_order: number;
};

export function ProductColorSwatches({
  productId,
  onImageChange,
  onVariantChange,
  hideOutOfStock = false,
  className,
}: {
  productId: string;
  onImageChange?: (imageUrl: string | null) => void;
  onVariantChange?: (variant: Row | null) => void;
  hideOutOfStock?: boolean;
  className?: string;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("product_variants_public")
        .select("variant_id, color_name_ar, color_name_en, color_hex, color_image_url, size, available_quantity, is_active, sort_order")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[ProductColorSwatches] fetch failed", error);
        setRows([]);
      } else {
        const colourRows = (data ?? []).filter((r: Row) => r.color_hex || r.color_name_ar || r.color_name_en);
        setRows(colourRows);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const visible = useMemo(
    () => (hideOutOfStock ? rows.filter((r) => Number(r.available_quantity ?? 0) > 0) : rows),
    [rows, hideOutOfStock],
  );

  useEffect(() => {
    if (selectedId || rows.length === 0) return;
    const first = rows.find((r) => Number(r.available_quantity ?? 0) > 0) ?? rows[0];
    if (first) {
      setSelectedId(first.variant_id);
      onImageChange?.(first.color_image_url);
      onVariantChange?.(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const pickVariant = (r: Row) => {
    setSelectedId(r.variant_id);
    onImageChange?.(r.color_image_url);
    onVariantChange?.(r);
  };

  if (loading) return null;
  if (visible.length === 0) return null;

  const labelFor = (r: Row) => (ar ? r.color_name_ar || r.color_name_en : r.color_name_en || r.color_name_ar) || "—";
  const selected = rows.find((r) => r.variant_id === selectedId);

  return (
    <section className={cn("my-4", className)} dir={ar ? "rtl" : "ltr"}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium uppercase tracking-wide text-muted-foreground">
          {ar ? "اللون" : "Colour"}
        </span>
        {selected && (
          <span className="text-muted-foreground">
            {labelFor(selected)}
            {selected.size ? ` · ${selected.size}` : ""}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {visible.map((r) => {
          const oos = Number(r.available_quantity ?? 0) <= 0;
          const isSel = selectedId === r.variant_id;
          return (
            <button
              key={r.variant_id}
              type="button"
              disabled={oos}
              onClick={() => pickVariant(r)}
              title={labelFor(r) + (oos ? (ar ? " · غير متوفر" : " · out of stock") : "")}
              aria-label={labelFor(r)}
              aria-pressed={isSel}
              className={cn(
                "relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition",
                isSel ? "border-foreground ring-2 ring-foreground/30" : "border-border hover:border-foreground/60",
                oos && "opacity-40",
              )}
              style={{ backgroundColor: r.color_hex || "transparent" }}
            >
              {!r.color_hex && (
                <span className="text-[10px] font-semibold text-foreground/80">
                  {labelFor(r).slice(0, 2)}
                </span>
              )}
              {oos && (
                <span
                  className="absolute inset-0 m-auto h-[2px] w-[120%] -rotate-45 bg-destructive/80"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {Number(selected.available_quantity ?? 0) > 0
            ? (ar
                ? `متوفّر: ${Number(selected.available_quantity)} قطعة`
                : `${Number(selected.available_quantity)} in stock`)
            : (ar ? "غير متوفّر حالياً" : "Out of stock right now")}
        </div>
      )}
    </section>
  );
}

