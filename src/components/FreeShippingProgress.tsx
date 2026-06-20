import { Truck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePriceFormatter } from "@/state/CurrencyContext";

type Props = {
  subtotal: number;
  threshold: number;
};

export function FreeShippingProgress({ subtotal, threshold }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const fmt = usePriceFormatter();

  const reached = subtotal >= threshold;
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));

  return (
    <div className="rounded-[14px] border border-gold-deep/30 bg-gold-deep/5 p-3.5">
      <div className="flex items-center gap-2 text-[12.5px] text-foreground">
        <Truck className="h-4 w-4 text-gold-deep shrink-0" />
        {reached ? (
          <p className="font-medium text-emerald-700">
            {ar ? "🎉 حصلت على الشحن المجاني!" : "🎉 You unlocked free shipping!"}
          </p>
        ) : (
          <p>
            {ar ? (
              <>
                أضف <span className="font-semibold text-gold-deep">{fmt(remaining)}</span> للحصول على شحن مجاني
              </>
            ) : (
              <>
                Add <span className="font-semibold text-gold-deep">{fmt(remaining)}</span> more for free shipping
              </>
            )}
          </p>
        )}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-emerald-500" : "bg-gold-deep"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
