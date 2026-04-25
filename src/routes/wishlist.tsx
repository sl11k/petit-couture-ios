import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Heart, Sparkles, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { categories, getProductForCategory } from "@/data/categories";
import hero from "@/assets/hero-campaign.jpg";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — Maisonnét" },
      {
        name: "description",
        content: "Your saved Maisonnét pieces — review, remove, and shop your wishlist.",
      },
      { property: "og:title", content: "Wishlist — Maisonnét" },
      {
        property: "og:description",
        content: "Your saved Maisonnét pieces — review, remove, and shop your wishlist.",
      },
    ],
  }),
  component: WishlistPage,
});

type ResolvedItem = {
  id: string;
  kind: "product" | "category" | "campaign";
  slug: string | null;
  name: string;
  brand: string | null;
  image: string;
  price: number | null;
  currency: string;
  detailTo: "/category/$slug" | "/" ;
};

function WishlistPage() {
  const router = useRouter();
  const { t, lang, isRTL } = useLanguage();
  const wishlist = useWishlist();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const resolved = useMemo<ResolvedItem[]>(() => {
    return wishlist.items
      .map((id): ResolvedItem | null => {
        if (id.startsWith("product:") || id.startsWith("category:")) {
          const slug = id.split(":")[1];
          const cat = categories.find((c) => c.slug === slug);
          if (!cat) return null;
          const product = getProductForCategory(slug);
          return {
            id,
            kind: id.startsWith("product:") ? "product" : "category",
            slug,
            name: product.name,
            brand: product.brand,
            image: product.images[0] ?? cat.img,
            price: product.price,
            currency: product.currency,
            detailTo: "/category/$slug",
          };
        }
        if (id.startsWith("hero:")) {
          return {
            id,
            kind: "campaign",
            slug: null,
            name: t.hero.title + " " + t.hero.subtitle,
            brand: t.hero.eyebrow,
            image: hero,
            price: null,
            currency: "SAR",
            detailTo: "/",
          };
        }
        return null;
      })
      .filter((x): x is ResolvedItem => x !== null);
  }, [wishlist.items, t.hero]);

  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

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
            {lang === "en" ? t.wishlist.eyebrow : t.wishlist.eyebrow}
          </span>
          {resolved.length > 0 ? (
            <button
              onClick={() => wishlist.clear()}
              className="h-10 px-3 -me-2 grid place-items-center rounded-full text-[10.5px] tracking-luxury text-gold-deep active:scale-95 transition"
            >
              {lang === "en" ? t.wishlist.clearAll.toUpperCase() : t.wishlist.clearAll}
            </button>
          ) : (
            <span className="h-10 w-10" />
          )}
        </header>

        <main className="pb-12">
          {resolved.length === 0 ? (
            <section className="px-6 pt-24 flex flex-col items-center text-center">
              <div className="h-[88px] w-[88px] rounded-full bg-cream-warm grid place-items-center border border-gold-soft">
                <Heart className="h-[28px] w-[28px] text-gold-deep" strokeWidth={1.4} />
              </div>
              <h1 className="mt-6 font-serif text-[28px] text-foreground">
                {t.wishlist.empty}
              </h1>
              <p className="mt-2 text-[13px] text-muted-foreground tracking-soft max-w-[280px]">
                {t.wishlist.emptySubtitle}
              </p>
              <Link
                to="/"
                className="mt-8 h-[52px] px-10 rounded-full bg-foreground text-background text-[13px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition shadow-soft"
              >
                {t.wishlist.emptyCta}
              </Link>
            </section>
          ) : (
            <>
              <section className="px-5 pt-2">
                <h1 className="font-serif text-[30px] leading-tight text-foreground">
                  {t.wishlist.title}
                </h1>
                <p className="mt-1 text-[12px] tracking-luxury text-gold-deep">
                  {fmt(resolved.length)}{" "}
                  {resolved.length === 1 ? t.wishlist.item : t.wishlist.items}
                </p>
              </section>

              <section className="px-5 mt-6 space-y-4">
                {resolved.map((it) => {
                  const linkedCard =
                    it.kind === "category" || it.kind === "product";
                  const ariaLabel = isRTL
                    ? `${t.wishlist.remove}: ${it.name}`
                    : `${t.wishlist.remove} ${it.name}`;

                  return (
                    <article
                      key={it.id}
                      className="relative flex gap-4 rounded-[22px] border border-border bg-cream-warm/40 p-3"
                    >
                      {linkedCard && it.slug ? (
                        <Link
                          to="/category/$slug"
                          params={{ slug: it.slug }}
                          className="h-[112px] w-[92px] overflow-hidden rounded-[16px] bg-pastel-peach shrink-0 active:opacity-90"
                          aria-label={it.name}
                        >
                          <img
                            src={it.image}
                            alt={it.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </Link>
                      ) : (
                        <div className="h-[112px] w-[92px] overflow-hidden rounded-[16px] bg-pastel-peach shrink-0">
                          <img
                            src={it.image}
                            alt={it.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col">
                        {it.brand && (
                          <span className="text-[10px] tracking-luxury text-gold-deep">
                            {lang === "en" ? it.brand.toUpperCase() : it.brand}
                          </span>
                        )}
                        {linkedCard && it.slug ? (
                          <Link
                            to="/category/$slug"
                            params={{ slug: it.slug }}
                            className="font-serif text-[16px] leading-snug text-foreground mt-0.5 truncate"
                          >
                            {it.name}
                          </Link>
                        ) : (
                          <h2 className="font-serif text-[16px] leading-snug text-foreground mt-0.5 truncate">
                            {it.name}
                          </h2>
                        )}

                        {it.price !== null ? (
                          <p className="mt-1 text-[13.5px] text-foreground/85 tabular-nums">
                            {fmt(it.price)} {it.currency}
                          </p>
                        ) : (
                          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-gold-deep tracking-soft">
                            <Sparkles className="h-[12px] w-[12px]" strokeWidth={1.6} />
                            {t.hero.eyebrow}
                          </p>
                        )}

                        <div className="mt-auto pt-2 flex items-center gap-2">
                          {linkedCard && it.slug && (
                            <Link
                              to="/category/$slug"
                              params={{ slug: it.slug }}
                              className="h-9 px-4 rounded-full bg-foreground text-background text-[12px] tracking-soft font-medium grid place-items-center active:scale-[0.97] transition"
                            >
                              {t.wishlist.view}
                            </Link>
                          )}
                          <button
                            aria-label={ariaLabel}
                            onClick={() => wishlist.remove(it.id)}
                            className="h-9 px-3 rounded-full border border-border text-[12px] tracking-soft text-muted-foreground hover:text-foreground active:scale-95 transition inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="h-[13px] w-[13px]" strokeWidth={1.6} />
                            {t.wishlist.remove}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>

              <div className="mt-8 text-center">
                <Link to="/" className="text-[12px] tracking-luxury text-gold-deep">
                  {lang === "en"
                    ? t.bag.continueShopping.toUpperCase()
                    : t.bag.continueShopping}
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
