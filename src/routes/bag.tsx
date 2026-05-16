import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useBag } from "@/state/BagContext";
import { useWishlist } from "@/state/WishlistContext";
import { getProductForCategory, categories, productsByCategory } from "@/data/categories";
import { useDbProductsBySlugs } from "@/hooks/useDbProducts";
import { usePriceFormatter } from "@/state/CurrencyContext";
import { ShareSheet, type ShareSheetPayload } from "@/components/ShareSheet";

export const Route = createFileRoute("/bag")({
  head: () =>
    buildMeta({
      title: "حقيبتك — Le Petit Paradis",
      description:
        "راجع القطع التي اخترتها وأكمل عملية الشراء عبر دفع آمن.",
      path: "/bag",
      noindex: true,
    }),
  component: BagPage,
});

const FREE_SHIPPING_THRESHOLD = 500;
const SHIPPING_FEE = 25;
const TAX_RATE = 0.15;

// Demo promo codes (client-side validation only)
const PROMO_CODES: Record<string, { type: "percent" | "fixed" | "freeship"; value: number; minSubtotal?: number }> = {
  WELCOME10: { type: "percent", value: 10 },
  SAVE50: { type: "fixed", value: 50, minSubtotal: 300 },
  FREESHIP: { type: "freeship", value: 0 },
};

function BagPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { isRTL, lang } = useLanguage();
  const ar = isRTL;
  const bag = useBag();
  const wishlist = useWishlist();
  const BackIcon = ar ? ChevronRight : ChevronLeft;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const fmt = (n: number) => Math.round(n).toLocaleString(locale);
  const fmtPrice = usePriceFormatter();

  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sharePayload, setSharePayload] = useState<ShareSheetPayload | null>(null);

  // Resolve current product info from DB (fallback to static categories) for each bag item.
  const { bySlug: bagProductsBySlug } = useDbProductsBySlugs(
    useMemo(() => bag.items.map((i) => i.slug), [bag.items]),
  );

  // Compute item meta (stock, price-changed) from product source
  const itemsMeta = useMemo(() => {
    return bag.items.map((it) => {
      const product = bagProductsBySlug[it.slug] ?? getProductForCategory(it.slug);
      const currentPrice = product.price;
      const priceChanged = currentPrice !== it.price;
      const stock = product.stock;
      const overStock = it.qty > stock;
      const lowStock = stock > 0 && stock <= 5;
      return { it, product, currentPrice, priceChanged, stock, overStock, lowStock };
    });
  }, [bag.items, bagProductsBySlug]);

  const promo = appliedCode ? PROMO_CODES[appliedCode] : null;

  const subtotal = bag.subtotal;
  const discount = useMemo(() => {
    if (!promo) return 0;
    if (promo.type === "percent") return Math.round((subtotal * promo.value) / 100);
    if (promo.type === "fixed") return Math.min(promo.value, subtotal);
    return 0;
  }, [promo, subtotal]);

  const subAfterDiscount = Math.max(0, subtotal - discount);
  const freeShippingByPromo = promo?.type === "freeship";
  const qualifiesFreeShip = subAfterDiscount >= FREE_SHIPPING_THRESHOLD;
  const shipping = bag.items.length === 0 ? 0 : (freeShippingByPromo || qualifiesFreeShip ? 0 : SHIPPING_FEE);
  const tax = Math.round(subAfterDiscount * TAX_RATE);
  const total = subAfterDiscount + shipping + tax;

  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subAfterDiscount);
  const freeShipProgress = Math.min(100, (subAfterDiscount / FREE_SHIPPING_THRESHOLD) * 100);

  const applyCode = () => {
    const normalized = code.trim().toUpperCase();
    setCodeError(null);
    if (!normalized) {
      setCodeError(ar ? "أدخل كود الخصم" : "Please enter a promo code");
      return;
    }
    const found = PROMO_CODES[normalized];
    if (!found) {
      setCodeError(ar ? "الكود غير صحيح أو منتهي الصلاحية" : "Invalid or expired code");
      return;
    }
    if (found.minSubtotal && subtotal < found.minSubtotal) {
      setCodeError(
        ar
          ? `الحد الأدنى للطلب ${fmt(found.minSubtotal)} ر.س`
          : `Minimum order of ${fmt(found.minSubtotal)} SAR required`,
      );
      return;
    }
    setAppliedCode(normalized);
  };

  const removeCode = () => {
    setAppliedCode(null);
    setCode("");
    setCodeError(null);
  };

  const moveToWishlist = (itemId: string, slug: string) => {
    wishlist.toggle(`product:${slug}`, "wishlist_screen");
    bag.remove(itemId);
  };

  const onShareBag = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://maisonnet.app";
    const ids = bag.items.map((i) => `product:${i.slug}`).join(",");
    setSharePayload({
      url: `${origin}/wishlist/share?ids=${encodeURIComponent(ids)}`,
      title: ar ? "سلتي من لو بوتي باراديس" : "My Le Petit Paradis bag",
      message: ar ? "ألقِ نظرة على القطع التي اخترتها" : "Check out the pieces I picked",
    });
  };

  // Recommendations (other categories)
  const recommendations = useMemo(() => {
    const owned = new Set(bag.items.map((i) => i.slug));
    return categories
      .filter((c) => !owned.has(c.slug))
      .slice(0, 6)
      .map((c) => ({ ...productsByCategory["best-sellers"], slug: c.slug, category: c.name }));
  }, [bag.items]);

  const tt = {
    title: ar ? "سلة التسوق" : "Shopping Bag",
    item: ar ? "قطعة" : "item",
    items: ar ? "قطعة" : "items",
    empty: ar ? "سلتك فارغة" : "Your bag is empty",
    emptyDesc: ar ? "ابدأ بإضافة قطعك المفضلة" : "Start adding your favourite pieces",
    continueShopping: ar ? "متابعة التسوق" : "Continue shopping",
    size: ar ? "المقاس" : "Size",
    color: ar ? "اللون" : "Color",
    remove: ar ? "حذف" : "Remove",
    moveToWishlist: ar ? "نقل للمفضلة" : "Move to wishlist",
    lowStock: (n: number) => ar ? `بقي ${n} فقط` : `Only ${n} left`,
    overStock: (n: number) => ar ? `الحد الأقصى المتاح ${n}` : `Max available: ${n}`,
    priceChanged: ar ? "السعر تغيّر" : "Price changed",
    subtotal: ar ? "إجمالي المنتجات" : "Subtotal",
    discount: ar ? "الخصم" : "Discount",
    shipping: ar ? "الشحن" : "Shipping",
    tax: ar ? "ضريبة (15%)" : "Tax (15%)",
    free: ar ? "مجاني" : "Free",
    total: ar ? "الإجمالي" : "Total",
    shippingNote: ar ? "تكلفة الشحن قد تتغير حسب موقعك في الخطوة التالية" : "Shipping may vary based on your delivery address",
    promoCode: ar ? "كود الخصم" : "Promo code",
    apply: ar ? "تطبيق" : "Apply",
    promoApplied: (c: string) => ar ? `تم تطبيق كود ${c}` : `Code ${c} applied`,
    freeShipBar: (n: number) => ar ? `أضف ${fmt(n)} ر.س للحصول على شحن مجاني` : `Add ${fmt(n)} SAR more for free shipping`,
    freeShipUnlocked: ar ? "🎉 حصلت على شحن مجاني!" : "🎉 You unlocked free shipping!",
    youMayNeed: ar ? "قد تحتاج هذه أيضًا" : "You may also need",
    checkout: ar ? "إكمال الشراء" : "Checkout securely",
    secure: ar ? "دفع آمن ومشفر 100%" : "100% secure & encrypted",
    clearBag: ar ? "تفريغ السلة" : "Clear bag",
    shareBag: ar ? "مشاركة السلة" : "Share bag",
    confirmClear: ar ? "تفريغ كل المنتجات؟" : "Remove all items?",
    cancel: ar ? "إلغاء" : "Cancel",
    confirm: ar ? "نعم، تفريغ" : "Yes, clear",
    placeholderCode: ar ? "مثل: WELCOME10" : "e.g. WELCOME10",
  };

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center" dir={ar ? "rtl" : "ltr"}>
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
        {/* Header */}
        <header className="px-5 pt-2 pb-3 flex items-center justify-between sticky top-0 z-30 bg-background/95 backdrop-blur">
          <button aria-label={ar ? "رجوع" : "Back"} onClick={() => router.history.back()} className="h-10 w-10 -ms-2 grid place-items-center rounded-full text-foreground/80 active:scale-95 transition">
            <BackIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {lang === "en" ? tt.title.toUpperCase() : tt.title}
          </span>
          {bag.items.length > 0 ? (
            <button aria-label={tt.shareBag} onClick={onShareBag} className="h-10 w-10 -me-2 grid place-items-center rounded-full text-foreground/70 active:scale-95 transition">
              <Share2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          ) : (
            <span className="h-10 w-10" />
          )}
        </header>

        <main className="pb-[200px]">
          {bag.items.length === 0 ? (
            <section className="px-6 pt-24 flex flex-col items-center text-center">
              <div className="h-[88px] w-[88px] rounded-full bg-cream-warm grid place-items-center border border-gold-soft">
                <ShoppingBag className="h-[30px] w-[30px] text-gold-deep" strokeWidth={1.4} />
              </div>
              <h1 className="mt-6 font-serif text-[28px] text-foreground">{tt.empty}</h1>
              <p className="mt-2 text-[13px] text-muted-foreground tracking-soft max-w-[280px]">{tt.emptyDesc}</p>
              <Link to="/" className="mt-8 h-[52px] px-10 rounded-full bg-foreground text-background text-[13px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition shadow-soft">
                {tt.continueShopping}
              </Link>
            </section>
          ) : (
            <>
              {/* Title */}
              <section className="px-5 pt-2">
                <h1 className="font-serif text-[28px] leading-tight text-foreground">{tt.title}</h1>
                <p className="mt-1 text-[12px] tracking-luxury text-gold-deep">
                  {bag.count} {bag.count === 1 ? tt.item : tt.items}
                </p>
              </section>

              {/* Free shipping bar */}
              <section className="px-5 mt-5">
                <div className="rounded-[16px] border border-gold-soft bg-gold-soft/30 p-3.5">
                  <div className="flex items-center gap-2 text-[12.5px] text-foreground/85">
                    <Truck className="h-[15px] w-[15px] text-gold-deep" />
                    <span className="flex-1">
                      {qualifiesFreeShip || freeShipProgress >= 100 ? tt.freeShipUnlocked : tt.freeShipBar(remainingForFreeShip)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full bg-gold-deep transition-all duration-300"
                      style={{ width: `${freeShipProgress}%` }}
                    />
                  </div>
                </div>
              </section>

              {/* Items */}
              <section className="px-5 mt-5 space-y-4">
                {itemsMeta.map(({ it, currentPrice, priceChanged, stock, overStock, lowStock }) => (
                  <article key={it.id} className="rounded-[22px] border border-border bg-cream-warm/40 p-3">
                    <div className="flex gap-4">
                      <Link to="/category/$slug" params={{ slug: it.slug }} className="h-[112px] w-[92px] overflow-hidden rounded-[16px] bg-pastel-peach shrink-0">
                        <img src={it.image} alt={it.name} loading="lazy" className="w-full h-full object-cover" />
                      </Link>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-[10px] tracking-luxury text-gold-deep">
                          {lang === "en" ? it.brand.toUpperCase() : it.brand}
                        </span>
                        <h2 className="font-serif text-[15.5px] leading-snug text-foreground mt-0.5 line-clamp-2">{it.name}</h2>
                        <p className="mt-1 text-[11.5px] text-muted-foreground tracking-soft">
                          {tt.size} {it.size} · {tt.color} {it.color}
                        </p>

                        <div className="mt-auto pt-2 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-full border border-border bg-background">
                            <button aria-label={ar ? "إنقاص" : "Decrease"} onClick={() => bag.setQty(it.id, it.qty - 1)} className="h-8 w-8 grid place-items-center text-foreground/70 active:scale-95">
                              <Minus className="h-[14px] w-[14px]" strokeWidth={1.6} />
                            </button>
                            <span className="w-7 text-center text-[13px] tabular-nums">{fmt(it.qty)}</span>
                            <button
                              aria-label={ar ? "زيادة" : "Increase"}
                              onClick={() => {
                                if (it.qty + 1 > stock) return;
                                bag.setQty(it.id, it.qty + 1);
                              }}
                              disabled={it.qty >= stock}
                              className="h-8 w-8 grid place-items-center text-foreground/70 disabled:opacity-30 active:scale-95"
                            >
                              <Plus className="h-[14px] w-[14px]" strokeWidth={1.6} />
                            </button>
                          </div>
                          <div className="text-end">
                            <div className="text-[14px] text-foreground tracking-tight tabular-nums">
                              {fmtPrice(it.price * it.qty)}
                            </div>
                            {it.qty > 1 && (
                              <div className="text-[10.5px] text-muted-foreground tabular-nums">
                                {fmtPrice(it.price)} × {fmt(it.qty)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Alerts */}
                    {(priceChanged || overStock || lowStock) && (
                      <div className="mt-3 space-y-1.5">
                        {priceChanged && (
                          <div className="flex items-center gap-2 text-[11.5px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{tt.priceChanged}: {fmtPrice(currentPrice)}</span>
                          </div>
                        )}
                        {overStock && (
                          <div className="flex items-center gap-2 text-[11.5px] text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{tt.overStock(stock)}</span>
                          </div>
                        )}
                        {!overStock && lowStock && (
                          <div className="flex items-center gap-2 text-[11.5px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{tt.lowStock(stock)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Item actions */}
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <button onClick={() => moveToWishlist(it.id, it.slug)} className="text-[11.5px] text-foreground/75 inline-flex items-center gap-1.5 active:scale-95">
                        <Heart className="h-[13px] w-[13px]" strokeWidth={1.5} /> {tt.moveToWishlist}
                      </button>
                      <button onClick={() => bag.remove(it.id)} className="text-[11.5px] text-red-600 inline-flex items-center gap-1.5 active:scale-95">
                        <Trash2 className="h-[13px] w-[13px]" strokeWidth={1.5} /> {tt.remove}
                      </button>
                    </div>
                  </article>
                ))}
              </section>

              {/* Promo code */}
              <section className="px-5 mt-6">
                <label className="text-[12px] tracking-luxury text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> {tt.promoCode}
                </label>
                {appliedCode ? (
                  <div className="mt-2 flex items-center justify-between rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                    <span className="text-[13px] text-emerald-800 inline-flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> {tt.promoApplied(appliedCode)}
                    </span>
                    <button onClick={removeCode} className="text-emerald-800/70 hover:text-emerald-900">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={code}
                        onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
                        onKeyDown={(e) => e.key === "Enter" && applyCode()}
                        placeholder={tt.placeholderCode}
                        className="flex-1 h-11 rounded-full border border-border bg-background px-4 text-[13px] uppercase placeholder:normal-case placeholder:text-muted-foreground"
                      />
                      <button onClick={applyCode} className="h-11 px-5 rounded-full bg-foreground text-background text-[13px] font-medium active:scale-95">
                        {tt.apply}
                      </button>
                    </div>
                    {codeError && (
                      <p className="mt-2 text-[11.5px] text-red-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" /> {codeError}
                      </p>
                    )}
                  </>
                )}
              </section>

              {/* Totals */}
              <section className="px-5 mt-6">
                <div className="rounded-[20px] border border-border bg-background p-5 space-y-3">
                  <div className="flex items-center justify-between text-[13.5px] text-foreground/80">
                    <span>{tt.subtotal}</span>
                    <span className="tabular-nums">{fmtPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between text-[13.5px] text-emerald-700">
                      <span>{tt.discount}</span>
                      <span className="tabular-nums">−{fmtPrice(discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[13.5px] text-foreground/80">
                    <span>{tt.shipping}</span>
                    {shipping === 0 ? (
                      <span className="text-gold-deep tracking-soft">{tt.free}</span>
                    ) : (
                      <span className="tabular-nums">{fmtPrice(shipping)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[13.5px] text-foreground/80">
                    <span>{tt.tax}</span>
                    <span className="tabular-nums">{fmtPrice(tax)}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] tracking-luxury text-muted-foreground">
                      {lang === "en" ? tt.total.toUpperCase() : tt.total}
                    </span>
                    <span className="font-serif text-[24px] text-foreground tabular-nums">{fmtPrice(total)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground tracking-soft pt-1">{tt.shippingNote}</p>
                </div>
              </section>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <section className="mt-8">
                  <h2 className="px-5 font-serif text-[18px] text-foreground">{tt.youMayNeed}</h2>
                  <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none px-5 pb-2">
                    {recommendations.map((p) => (
                      <Link key={p.slug} to="/category/$slug" params={{ slug: p.slug }} className="shrink-0 w-[130px]">
                        <div className="aspect-[4/5] rounded-[14px] overflow-hidden bg-pastel-peach">
                          <img src={p.images[0]} alt={p.category} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <p className="mt-2 text-[12px] text-foreground/85 line-clamp-1">{p.category}</p>
                        <p className="text-[12px] text-muted-foreground tabular-nums">{fmtPrice(p.price)}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Secondary actions */}
              <section className="px-5 mt-8 flex items-center justify-between">
                <Link to="/" className="text-[12.5px] tracking-luxury text-gold-deep">
                  {lang === "en" ? tt.continueShopping.toUpperCase() : tt.continueShopping}
                </Link>
                <button onClick={() => setConfirmClear(true)} className="text-[12px] text-red-600 inline-flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> {tt.clearBag}
                </button>
              </section>
            </>
          )}
        </main>

        {/* Sticky checkout CTA */}
        {bag.items.length > 0 && (
          <div className="fixed lg:absolute bottom-0 inset-x-0 max-w-[440px] mx-auto bg-background/95 backdrop-blur-md border-t border-border z-40">
            <div className="px-5 pt-4 pb-6">
              <button onClick={() => navigate({ to: "/checkout" })} className="w-full h-[56px] rounded-full bg-foreground text-background text-[14px] font-medium tracking-soft active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-soft">
                <Lock className="h-[15px] w-[15px]" strokeWidth={1.7} />
                {tt.checkout} · {fmtPrice(total)}
              </button>
              <p className="mt-2 text-center text-[10.5px] text-muted-foreground tracking-soft">{tt.secure}</p>
            </div>
          </div>
        )}

        {/* Clear-bag confirm */}
        {confirmClear && (
          <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center px-5" onClick={() => setConfirmClear(false)}>
            <div className="w-full max-w-[360px] bg-background rounded-[20px] p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-serif text-[18px] text-foreground">{tt.confirmClear}</h3>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setConfirmClear(false)} className="flex-1 h-11 rounded-full border border-border text-[13px]">{tt.cancel}</button>
                <button onClick={() => { bag.clear(); setConfirmClear(false); }} className="flex-1 h-11 rounded-full bg-red-600 text-white text-[13px] font-medium">{tt.confirm}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ShareSheet open={sharePayload !== null} onClose={() => setSharePayload(null)} payload={sharePayload} />
    </div>
  );
}
