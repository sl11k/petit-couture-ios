import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Heart,
  MessageCircle,
  Menu,
  Home as HomeIcon,
  User,
  Search,
  ShoppingBag,
} from "lucide-react";
import hero from "@/assets/hero-campaign.jpg";
import { categories, getProductForCategory } from "@/data/categories";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { useImpression } from "@/hooks/useImpression";
import { useBag } from "@/state/BagContext";



type AgeKey = "baby" | "girl" | "boy";
type NavKey = "menu" | "home" | "account" | "search" | "bag";

/** Wishlist impression target — fires once per (source, id) per session. */
function ImpressionCell({
  itemId,
  source,
  className,
  children,
}: {
  itemId: string;
  source: "category_card";
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useImpression<HTMLDivElement>({ itemId, source });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function HomeScreen() {
  const { t, lang, toggle, isRTL } = useLanguage();
  const wishlist = useWishlist();
  const bag = useBag();
  const [age, setAge] = useState<AgeKey>("girl");
  const [nav, setNav] = useState<NavKey>("home");
  const [annIdx, setAnnIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setAnnIdx((i) => (i + 1) % t.announcements.length),
      4000,
    );
    return () => clearInterval(id);
  }, [t.announcements.length]);

  // Reset announcement index when language changes
  useEffect(() => {
    setAnnIdx(0);
  }, [lang]);

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
        {/* Header */}
        <header className="px-6 pt-2 pb-4 flex items-center justify-between">
          <button
            aria-label={isRTL ? "تبديل اللغة" : "Toggle language"}
            onClick={toggle}
            className="h-10 min-w-[52px] px-3 -ms-2 grid place-items-center rounded-full border border-gold-soft text-gold-deep text-[11px] font-medium tracking-[0.18em] active:scale-95 transition"
          >
            {lang === "en" ? "ع AR" : "EN"}
          </button>

          {/* Brand mark */}
          <div className="flex flex-col items-center select-none">
            <span className="font-serif text-[26px] leading-none text-foreground tracking-[0.04em]">
              Mais<span className="text-gold">on</span>nét
            </span>
            <span className="mt-1 text-[9px] tracking-luxury text-muted-foreground">
              {t.brandTagline}
            </span>
          </div>

          <Link
            to="/wishlist"
            aria-label={
              wishlist.count > 0
                ? isRTL
                  ? `المفضلة، ${wishlist.count} عنصر`
                  : `Wishlist, ${wishlist.count} item${wishlist.count === 1 ? "" : "s"}`
                : isRTL
                  ? "المفضلة"
                  : "Wishlist"
            }
            className="relative h-10 w-10 -me-2 grid place-items-center rounded-full border border-gold-soft text-gold-deep active:scale-95 transition"
          >
            <Heart
              className="h-[18px] w-[18px]"
              strokeWidth={1.5}
              fill={wishlist.count > 0 ? "currentColor" : "none"}
            />
            {wishlist.count > 0 && (
              <span
                key={wishlist.count}
                aria-hidden="true"
                className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-background text-[10px] font-medium grid place-items-center shadow-soft animate-in zoom-in-50 fade-in duration-200"
              >
                {wishlist.count > 99 ? "99+" : wishlist.count}
              </span>
            )}
          </Link>
        </header>

        {/* Announcement bar */}
        <div className="relative bg-cream-warm">
          <div className="h-[52px] flex items-center justify-center px-6 text-[13.5px] text-foreground/80 tracking-soft">
            <span key={`${lang}-${annIdx}`} className="animate-in fade-in duration-500 text-center">
              {t.announcements[annIdx]}
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        </div>

        {/* Scrollable content */}
        <main className="pb-[120px]">
          {/* Hero */}
          <section className="px-5 pt-5">
            <div className="relative overflow-hidden rounded-[28px] bg-pastel-peach">
              <img
                src={hero}
                alt={isRTL ? "حملة الربيع" : "Spring campaign — luxury kids editorial"}
                className="w-full h-[440px] object-cover"
                width={1280}
                height={1280}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-transparent" />

              <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 px-6 text-center">
                <span className="text-[10.5px] tracking-luxury text-foreground/75">
                  {t.hero.eyebrow}
                </span>
                <h1 className="mt-2 font-serif text-[64px] leading-[0.95] text-foreground">
                  {t.hero.title}
                </h1>
                <p className="mt-1 font-serif italic text-[26px] text-foreground/85">
                  {t.hero.subtitle}
                </p>
                <p className="mt-2 text-[10.5px] text-foreground/60 tracking-soft max-w-[260px]">
                  {t.hero.legal}
                </p>
                <button className="mt-5 h-[52px] px-10 rounded-full bg-background text-foreground text-[14px] font-medium tracking-soft shadow-soft active:scale-[0.97] transition">
                  {t.hero.cta}
                </button>
              </div>
            </div>
          </section>

          {/* Age chips */}
          <section className="px-5 mt-7">
            <div className="grid grid-cols-3 gap-3">
              {(["baby", "girl", "boy"] as AgeKey[]).map((k) => {
                const active = age === k;
                return (
                  <button
                    key={k}
                    onClick={() => setAge(k)}
                    className={[
                      "h-[54px] rounded-full text-[15px] tracking-soft transition active:scale-[0.97] border",
                      active
                        ? "bg-gold-soft border-gold text-gold-deep font-medium"
                        : "bg-background border-border text-muted-foreground",
                    ].join(" ")}
                  >
                    {t.ages[k]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Wishlist insights panel */}
          {(() => {
            if (wishlist.count === 0) return null;
            const priced = wishlist.items
              .map((id) => {
                if (!id.startsWith("product:") && !id.startsWith("category:")) return null;
                const slug = id.split(":")[1];
                const cat = categories.find((c) => c.slug === slug);
                if (!cat) return null;
                return getProductForCategory(slug);
              })
              .filter((p): p is NonNullable<typeof p> => p !== null);
            const total = priced.reduce((sum, p) => sum + p.price, 0);
            const currency = priced[0]?.currency ?? "SAR";
            const avg = priced.length ? Math.round(total / priced.length) : 0;
            const fmt = (n: number) =>
              n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
            const labels = {
              eyebrow: isRTL ? "نظرة عامة" : "WISHLIST INSIGHTS",
              title: isRTL ? "قائمة رغباتك" : "Your wishlist",
              items: isRTL ? "عناصر" : "Items",
              total: isRTL ? "القيمة" : "Total value",
              avg: isRTL ? "المتوسط" : "Avg. price",
              cta: isRTL ? "عرض" : "VIEW",
            };
            return (
              <section className="px-5 mt-8">
                <Link
                  to="/wishlist"
                  className="block rounded-[24px] border border-gold-soft bg-cream-warm/60 p-5 active:scale-[0.99] transition shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-luxury text-gold-deep">
                      {labels.eyebrow}
                    </span>
                    <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-foreground text-background text-[10px] tracking-luxury">
                      <Heart className="h-[11px] w-[11px]" strokeWidth={1.8} fill="currentColor" />
                      {labels.cta}
                    </span>
                  </div>
                  <h3 className="mt-2 font-serif text-[22px] leading-tight text-foreground">
                    {labels.title}
                  </h3>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className={isRTL ? "text-right" : "text-left"}>
                      <p className="font-serif text-[24px] leading-none text-foreground tabular-nums">
                        {fmt(wishlist.count)}
                      </p>
                      <p className="mt-1.5 text-[10px] tracking-luxury text-muted-foreground">
                        {labels.items}
                      </p>
                    </div>
                    <div className={isRTL ? "text-right" : "text-left"}>
                      <p className="font-serif text-[24px] leading-none text-foreground tabular-nums">
                        {priced.length ? fmt(total) : "—"}
                      </p>
                      <p className="mt-1.5 text-[10px] tracking-luxury text-muted-foreground">
                        {labels.total}
                        {priced.length ? ` · ${currency}` : ""}
                      </p>
                    </div>
                    <div className={isRTL ? "text-right" : "text-left"}>
                      <p className="font-serif text-[24px] leading-none text-foreground tabular-nums">
                        {priced.length ? fmt(avg) : "—"}
                      </p>
                      <p className="mt-1.5 text-[10px] tracking-luxury text-muted-foreground">
                        {labels.avg}
                        {priced.length ? ` · ${currency}` : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              </section>
            );
          })()}

          {/* Most Popular */}
          <section className="mt-12 px-5">
            <div className="text-center">
              <span className="text-[10.5px] tracking-luxury text-gold-deep">
                {t.curatedEdit}
              </span>
              <h2 className="font-serif text-[34px] leading-tight text-foreground mt-1.5">
                {t.mostPopular}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-7">
              {categories.map((c) => {
                const wishId = `category:${c.slug}`;
                const liked = wishlist.has(wishId);
                return (
                  <ImpressionCell key={c.slug} itemId={wishId} source="category_card">
                    <Link
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      className="group flex flex-col items-center text-left active:scale-[0.99] transition"
                    >
                      <div className="relative w-full overflow-hidden rounded-[22px] bg-cream-warm aspect-[1.35/1]">
                        <img
                          src={c.img}
                          alt={t.categories[c.slug] ?? c.name}
                          loading="lazy"
                          width={768}
                          height={576}
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.04] group-active:opacity-90"
                        />
                        <button
                          type="button"
                          aria-label={
                            isRTL
                              ? liked
                                ? "إزالة من المفضلة"
                                : "أضف إلى المفضلة"
                              : liked
                                ? "Remove from wishlist"
                                : "Add to wishlist"
                          }
                          aria-pressed={liked}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            wishlist.toggle(wishId, "category_card");
                          }}
                          className="absolute top-2.5 end-2.5 h-9 w-9 rounded-full bg-background/85 backdrop-blur grid place-items-center text-gold-deep border border-gold-soft active:scale-90 transition"
                        >
                          <Heart
                            className="h-[15px] w-[15px]"
                            strokeWidth={1.6}
                            fill={liked ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                      <span className="mt-3 text-[15px] text-foreground/85 font-medium tracking-tight text-center">
                        {t.categories[c.slug] ?? c.name}
                      </span>
                    </Link>
                  </ImpressionCell>
                );
              })}
            </div>

            <div className="mt-10 flex justify-center">
              <button className="h-[52px] px-10 rounded-full bg-background border border-border text-gold-deep text-[12px] tracking-luxury font-medium active:scale-[0.97] transition">
                {t.shopAll}
              </button>
            </div>

            <p className="mt-10 text-center text-[11px] text-muted-foreground tracking-soft">
              {t.footer}
            </p>
          </section>
        </main>

        {/* Floating chat (RTL-aware position) */}
        <button
          aria-label={isRTL ? "خدمة العملاء" : "Customer support"}
          className={[
            "fixed lg:absolute bottom-[108px] h-[60px] w-[60px] rounded-full bg-gold text-background grid place-items-center shadow-gold active:scale-95 transition z-40",
            isRTL ? "left-5" : "right-5",
          ].join(" ")}
        >
          <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.6} />
        </button>

        {/* Bottom nav */}
        <nav className="fixed lg:absolute bottom-0 inset-x-0 max-w-[440px] mx-auto bg-background/95 backdrop-blur-md border-t border-border z-40">
          <div className="px-3 pt-2 pb-6">
            <div className="grid grid-cols-5">
              {(
                [
                  { k: "menu", Icon: Menu, to: null },
                  { k: "home", Icon: HomeIcon, to: "/" as const },
                  { k: "account", Icon: User, to: "/account" as const },
                  { k: "search", Icon: Search, to: "/search" as any },
                  { k: "bag", Icon: ShoppingBag, to: "/bag" as const },
                ] as { k: NavKey; Icon: typeof Menu; to: "/" | "/bag" | "/account" | null }[]
              ).map(({ k, Icon, to }) => {
                const active = nav === k;
                const badge = k === "bag" && bag.count > 0 ? bag.count : null;
                const inner = (
                  <>
                    {active && (
                      <span className="absolute inset-x-3 inset-y-1 rounded-full bg-cream-warm" />
                    )}
                    <div className="relative">
                      <Icon
                        className={[
                          "h-[20px] w-[20px]",
                          active ? "text-gold-deep" : "text-gold",
                        ].join(" ")}
                        strokeWidth={active ? 1.8 : 1.5}
                      />
                      {badge !== null && (
                        <span className="absolute -top-1.5 -end-2 min-w-[16px] h-[16px] px-1 rounded-full bg-gold text-background text-[9.5px] font-medium grid place-items-center">
                          {badge}
                        </span>
                      )}
                    </div>
                    <span
                      className={[
                        "relative text-[11px] tracking-soft",
                        active ? "text-gold-deep font-medium" : "text-gold-deep/80",
                      ].join(" ")}
                    >
                      {t.nav[k]}
                    </span>
                  </>
                );

                const className =
                  "relative h-[58px] flex flex-col items-center justify-center gap-1 active:scale-95 transition";

                return to ? (
                  <Link
                    key={k}
                    to={to}
                    onClick={() => setNav(k)}
                    className={className}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button key={k} onClick={() => setNav(k)} className={className}>
                    {inner}
                  </button>
                );
              })}
            </div>
            
          </div>
        </nav>
      </div>
    </div>
  );
}
