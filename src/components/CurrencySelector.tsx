import { useCurrency } from "@/state/CurrencyContext";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * CurrencySelector — mirrors the visual treatment of the header language
 * toggle (uppercase tracking, tiny size, hover only changes color). Sits
 * next to the EN/عربي button without altering the header layout.
 */
export function CurrencySelector({ className = "" }: { className?: string }) {
  const { currency, setCurrency, currencies, info } = useCurrency();
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ar ? "اختيار العملة" : "Select currency"}
          className={[
            "tracking-luxury text-foreground/75 hover:text-foreground transition",
            "inline-flex items-center gap-1 text-[11px]",
            className,
          ].join(" ")}
        >
          <span>{currency}</span>
          <span aria-hidden className="opacity-60">·</span>
          <span className="opacity-70">{ar ? info.symbolAr : info.symbol}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isRTL ? "start" : "end"}
        className="max-h-[60vh] overflow-y-auto w-56"
      >
        <DropdownMenuLabel className="text-[10.5px] tracking-luxury text-muted-foreground">
          {ar ? "العملة" : "Currency"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currencies.map((c) => {
          const active = c.code === currency;
          return (
            <DropdownMenuItem
              key={c.code}
              onSelect={() => setCurrency(c.code)}
              className={[
                "flex items-center justify-between gap-3 text-xs",
                active ? "bg-cream-warm font-medium text-foreground" : "",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-gold-deep w-9">{c.code}</span>
                <span>{ar ? c.nameAr : c.nameEn}</span>
              </span>
              <span className="opacity-70 text-[11px]">{ar ? c.symbolAr : c.symbol}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
