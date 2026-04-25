import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useBag } from "@/state/BagContext";

export const Route = createFileRoute("/bag")({
  head: () => ({
    meta: [
      { title: "Your Bag — Maisonnét" },
      { name: "description", content: "Review your saved pieces and proceed to a secure checkout." },
      { property: "og:title", content: "Your Bag — Maisonnét" },
      { property: "og:description", content: "Review your saved pieces and proceed to a secure checkout." },
    ],
  }),
  component: BagPage,
});

function BagPage() {
  const router = useRouter();
  const { t, isRTL, lang } = useLanguage();
  const bag = useBag();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const fmt = (n: number) => n.toLocaleString(locale);
  const shipping = 0;
  const total = bag.subtotal + shipping;

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
        {/* iOS status bar */}
        <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold text-foreground tracking-tight">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-[2px] border border-foreground/80" />
            <span className="text-[11px]">100%</span>
          </div>
        </div>

        {/* Header */}
        <header className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            aria-label={isRTL ? "رجوع" : "Back"}
            onClick={() => router.history.back()}
            className="h-10 w-10 -ms-2 grid place-items-center rounded-full text-foreground/80 active:scale-95 transition"
          >
            <BackIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {lang === "en" ? t.bag.title.toUpperCase() : t.bag.title}
          </span>
          <span className="h-10 w-10" />
        </header>

        <main className="pb-[180px]">
          {bag.items.length === 0 ? (
            <section className="px-6 pt-24 flex flex-col items-center text-center">
              <div className="h-[88px] w-[88px] rounded-full bg-cream-warm grid place-items-center border border-gold-soft">
                <ShoppingBag className="h-[30px] w-[30px] text-gold-deep" strokeWidth={1.4} />
              </div>
              <h1 className="mt-6 font-serif text-[28px] text-foreground">{t.bag.empty}</h1>
              <p className="mt-2 text-[13px] text-muted-foreground tracking-soft max-w-[280px]">
                {t.footer}
              </p>
              <Link
                to="/"
                className="mt-8 h-[52px] px-10 rounded-full bg-foreground text-background text-[13px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition shadow-soft"
              >
                {t.bag.emptyCta}
              </Link>
            </section>
          ) : (
            <>
              {/* Title */}
              <section className="px-5 pt-2">
                <h1 className="font-serif text-[30px] leading-tight text-foreground">
                  {t.bag.title}
                </h1>
                <p className="mt-1 text-[12px] tracking-luxury text-gold-deep">
                  {bag.count} {bag.count === 1 ? t.bag.item : t.bag.items}
                </p>
              </section>

              {/* Items */}
              <section className="px-5 mt-6 space-y-4">
                {bag.items.map((it) => (
                  <article
                    key={it.id}
                    className="flex gap-4 rounded-[22px] border border-border bg-cream-warm/40 p-3"
                  >
                    <div className="h-[112px] w-[92px] overflow-hidden rounded-[16px] bg-pastel-peach shrink-0">
                      <img
                        src={it.image}
                        alt={it.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[10px] tracking-luxury text-gold-deep">
                        {lang === "en" ? it.brand.toUpperCase() : it.brand}
                      </span>
                      <h2 className="font-serif text-[16px] leading-snug text-foreground mt-0.5 truncate">
                        {it.name}
                      </h2>
                      <p className="mt-1 text-[11.5px] text-muted-foreground tracking-soft">
                        {t.bag.size} {it.size} · {t.bag.color} {it.color}
                      </p>

                      <div className="mt-auto pt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-full border border-border bg-background">
                          <button
                            aria-label={isRTL ? "إنقاص" : "Decrease"}
                            onClick={() => bag.setQty(it.id, it.qty - 1)}
                            className="h-8 w-8 grid place-items-center text-foreground/70 active:scale-95"
                          >
                            <Minus className="h-[14px] w-[14px]" strokeWidth={1.6} />
                          </button>
                          <span className="w-6 text-center text-[13px] tabular-nums">
                            {fmt(it.qty)}
                          </span>
                          <button
                            aria-label={isRTL ? "زيادة" : "Increase"}
                            onClick={() => bag.setQty(it.id, it.qty + 1)}
                            className="h-8 w-8 grid place-items-center text-foreground/70 active:scale-95"
                          >
                            <Plus className="h-[14px] w-[14px]" strokeWidth={1.6} />
                          </button>
                        </div>
                        <span className="text-[14px] text-foreground tracking-tight">
                          {fmt(it.price * it.qty)} {it.currency}
                        </span>
                      </div>
                    </div>

                    <button
                      aria-label={t.bag.remove}
                      onClick={() => bag.remove(it.id)}
                      className="self-start h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:text-foreground active:scale-90 transition"
                    >
                      <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.5} />
                    </button>
                  </article>
                ))}
              </section>

              {/* Totals */}
              <section className="px-5 mt-7">
                <div className="rounded-[20px] border border-border bg-background p-5 space-y-3">
                  <div className="flex items-center justify-between text-[13.5px] text-foreground/80">
                    <span>{t.bag.subtotal}</span>
                    <span className="tabular-nums">
                      {fmt(bag.subtotal)} {bag.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13.5px] text-foreground/80">
                    <span>{t.bag.shipping}</span>
                    <span className="text-gold-deep tracking-soft">{t.bag.shippingFree}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] tracking-luxury text-muted-foreground">
                      {lang === "en" ? t.bag.estimatedTotal.toUpperCase() : t.bag.estimatedTotal}
                    </span>
                    <span className="font-serif text-[22px] text-foreground tabular-nums">
                      {fmt(total)} {bag.currency}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground tracking-soft">
                    {t.product.tamara(Math.round(total / 4), bag.currency)}
                  </p>
                </div>
              </section>

              <div className="mt-6 text-center">
                <Link to="/" className="text-[12px] tracking-luxury text-gold-deep">
                  {lang === "en"
                    ? t.bag.continueShopping.toUpperCase()
                    : t.bag.continueShopping}
                </Link>
              </div>
            </>
          )}
        </main>

        {/* Sticky checkout CTA */}
        {bag.items.length > 0 && (
          <div className="absolute bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border">
            <div className="px-5 pt-4 pb-6">
              <button className="w-full h-[58px] rounded-full bg-foreground text-background text-[14px] font-medium tracking-soft active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-soft">
                <Lock className="h-[16px] w-[16px]" strokeWidth={1.7} />
                {t.bag.checkout} · {fmt(total)} {bag.currency}
              </button>
              <p className="mt-2 text-center text-[10.5px] text-muted-foreground tracking-soft">
                {t.bag.secure}
              </p>
            </div>
            <div className="mx-auto mb-2 h-[5px] w-[120px] rounded-full bg-foreground/80" />
          </div>
        )}
      </div>
    </div>
  );
}
