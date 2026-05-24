import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProductVariantsPublic } from "@/lib/variants.functions";
import { useBag } from "@/state/BagContext";
import { useLanguage } from "@/i18n/LanguageContext";

type Props = {
  productId: string;
  slug: string;
  productName: string;
  brand: string;
  basePrice: number;
  currency: string;
  image: string;
};

export function VariantsPicker(props: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const bag = useBag();
  const fetchVariants = useServerFn(getProductVariantsPublic);
  const { data } = useQuery({
    queryKey: ["product-variants-public", props.productId],
    queryFn: () => fetchVariants({ data: { productId: props.productId } }),
    enabled: !!props.productId,
  });

  const variants = (data ?? []).filter((v: any) => v.is_active);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && variants.length > 0) {
      const firstAvailable = variants.find((v: any) => Number(v.available_quantity) > 0);
      if (firstAvailable) setSelected(firstAvailable.variant_id);
    }
  }, [variants, selected]);

  if (!variants.length) return null;

  const current = variants.find((v: any) => v.variant_id === selected);
  const labelFor = (v: any) => {
    const parts: string[] = (v.option_values ?? []).map((ov: any) => ar ? ov.value : (ov.value_en || ov.value));
    return parts.join(" • ") || (v.sku || "—");
  };

  const addThisVariant = () => {
    if (!current) return;
    if (Number(current.available_quantity) <= 0) {
      toast.error(ar ? "غير متوفر" : "Out of stock");
      return;
    }
    bag.add({
      slug: props.slug,
      name: props.productName,
      brand: props.brand,
      price: Number(current.price_override ?? props.basePrice),
      currency: props.currency,
      image: current.image_url || props.image,
      size: "",
      color: "",
      variantId: current.variant_id,
      variantLabel: labelFor(current),
    });
    toast.success(ar ? "تمت الإضافة" : "Added to bag");
  };

  return (
    <div className="my-4 rounded-xl border border-border bg-card p-3" dir={ar ? "rtl" : "ltr"}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {ar ? "المتغيرات المتاحة" : "Available variants"}
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v: any) => {
          const oos = Number(v.available_quantity) <= 0;
          const isSel = selected === v.variant_id;
          return (
            <button
              key={v.variant_id}
              disabled={oos}
              onClick={() => setSelected(v.variant_id)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${isSel ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground"} ${oos ? "opacity-50 line-through" : ""}`}
            >
              {labelFor(v)}
              {v.price_override != null && (
                <span className="ms-1 text-[10px] opacity-70">
                  {Number(v.price_override).toLocaleString(ar ? "ar" : "en")} {ar ? "ر.س" : props.currency}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {current && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {ar ? "المتوفر: " : "Available: "}{Number(current.available_quantity)}
          </span>
          <button
            onClick={addThisVariant}
            disabled={Number(current.available_quantity) <= 0}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {ar ? "أضف المتغير إلى السلة" : "Add variant to bag"}
          </button>
        </div>
      )}
    </div>
  );
}
