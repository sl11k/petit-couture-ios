import { Link } from "@tanstack/react-router";
import { Plus, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRelatedOffers, type RelatedOffer } from "@/hooks/useRelatedOffers";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePriceFormatter } from "@/state/CurrencyContext";
import { useBag } from "@/state/BagContext";

type Props = {
  productId: string | null;
  currentProduct: {
    slug: string;
    name: string;
    brand: string;
    price: number;
    image: string;
    currency: string;
  };
};

export function FrequentlyBoughtTogether({ productId, currentProduct }: Props) {
  const { offers, loading } = useRelatedOffers(productId);
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const fmt = usePriceFormatter();
  const bag = useBag();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Default-select all when offers load
  useEffect(() => {
    if (offers.length) {
      setSelected(new Set(offers.map((o) => o.id)));
    }
  }, [offers]);

  if (loading || offers.length === 0) return null;

  const discountFor = (o: RelatedOffer) => {
    const price = Number(o.related.price ?? 0);
    if (o.discount_percent) return (price * Number(o.discount_percent)) / 100;
    if (o.discount_amount) return Math.min(price, Number(o.discount_amount));
    return 0;
  };

  const pickedOffers = offers.filter((o) => selected.has(o.id));
  const totalOriginal =
    currentProduct.price +
    pickedOffers.reduce((s, o) => s + Number(o.related.price ?? 0), 0);
  const totalDiscount = pickedOffers.reduce((s, o) => s + discountFor(o), 0);
  const totalFinal = totalOriginal - totalDiscount;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addAll = () => {
    // Add current product
    bag.add({
      slug: currentProduct.slug,
      name: currentProduct.name,
      brand: currentProduct.brand,
      price: currentProduct.price,
      currency: currentProduct.currency,
      image: currentProduct.image,
      size: "",
      color: "",
    });
    // Add picked related (with discount applied to unit price)
    pickedOffers.forEach((o) => {
      const disc = discountFor(o);
      const unit = Math.max(0, Number(o.related.price ?? 0) - disc);
      const name = ar ? o.related.name_ar : o.related.name_en;
      bag.add({
        slug: o.related.slug,
        name: name || o.related.slug,
        brand: o.related.brand ?? "",
        price: unit,
        currency: currentProduct.currency,
        image: o.related.image_url ?? "",
        size: "",
        color: "",
      });
    });
    toast.success(ar ? "تمت الإضافة إلى الحقيبة" : "Added to bag");
  };

  return (
    <section className="px-5 mt-9">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-gold-deep" />
        <h2 className="font-serif text-[18px] text-foreground">
          {ar ? "اشتريهم سوا ووفّر" : "Frequently bought together"}
        </h2>
      </div>

      <ul className="space-y-2">
        {/* Current product (always included, not toggleable) */}
        <li className="flex items-center gap-3 p-3 rounded-[14px] border border-border bg-cream-warm/30">
          <img
            src={currentProduct.image}
            alt={currentProduct.name}
            className="w-14 h-14 rounded-lg object-cover bg-muted"
            loading="lazy"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">
              {currentProduct.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {ar ? "هذا المنتج" : "This item"}
            </p>
          </div>
          <p className="text-[13px] font-semibold text-foreground whitespace-nowrap">
            {fmt(currentProduct.price)}
          </p>
        </li>

        {offers.map((o) => {
          const checked = selected.has(o.id);
          const disc = discountFor(o);
          const unitFinal = Number(o.related.price ?? 0) - disc;
          const name = ar ? o.related.name_ar : o.related.name_en;
          const offerTitle = ar ? o.title_ar : o.title_en;
          const discountLabel = o.discount_percent
            ? `-${Number(o.discount_percent)}%`
            : o.discount_amount
            ? `-${fmt(Number(o.discount_amount))}`
            : null;
          return (
            <li key={o.id} className="flex items-center gap-3 p-3 rounded-[14px] border border-border">
              <button
                type="button"
                onClick={() => toggle(o.id)}
                aria-label={checked ? "إزالة" : "إضافة"}
                className={`h-5 w-5 shrink-0 rounded-md border-2 grid place-items-center transition ${
                  checked ? "bg-gold-deep border-gold-deep" : "border-border bg-background"
                }`}
              >
                {checked && (
                  <svg viewBox="0 0 16 16" className="h-3 w-3 text-background">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <Link to="/product/$slug" params={{ slug: o.related.slug }}>
                <img
                  src={o.related.image_url ?? ""}
                  alt={name || ""}
                  className="w-14 h-14 rounded-lg object-cover bg-muted"
                  loading="lazy"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  to="/product/$slug"
                  params={{ slug: o.related.slug }}
                  className="text-[13px] font-medium text-foreground truncate block"
                >
                  {name || o.related.slug}
                </Link>
                {offerTitle && (
                  <p className="text-[11px] text-gold-deep mt-0.5">{offerTitle}</p>
                )}
                {discountLabel && !offerTitle && (
                  <p className="text-[11px] text-gold-deep mt-0.5">
                    {ar ? `وفّر ${discountLabel}` : `Save ${discountLabel}`}
                  </p>
                )}
              </div>
              <div className="text-end">
                {disc > 0 && (
                  <p className="text-[10.5px] text-muted-foreground line-through">
                    {fmt(Number(o.related.price ?? 0))}
                  </p>
                )}
                <p className="text-[13px] font-semibold text-gold-deep whitespace-nowrap">
                  {fmt(Math.max(0, unitFinal))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 p-4 rounded-[16px] bg-gold-deep/5 border border-gold-deep/30">
        <div className="flex items-center justify-between mb-1 text-[12.5px] text-muted-foreground">
          <span>{ar ? "السعر الأصلي" : "Original"}</span>
          <span className="line-through">{fmt(totalOriginal)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex items-center justify-between mb-1 text-[12.5px] text-emerald-700">
            <span>{ar ? "وفّر" : "You save"}</span>
            <span>−{fmt(totalDiscount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[15px] font-semibold text-foreground">
          <span>{ar ? "إجمالي الباقة" : "Bundle total"}</span>
          <span>{fmt(totalFinal)}</span>
        </div>
        <button
          onClick={addAll}
          className="mt-3 w-full h-12 rounded-xl bg-gold-deep text-background text-[13.5px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <ShoppingBag className="h-4 w-4" />
          {ar ? `أضف ${1 + pickedOffers.length} منتجات إلى الحقيبة` : `Add ${1 + pickedOffers.length} items to bag`}
        </button>
      </div>
    </section>
  );
}
