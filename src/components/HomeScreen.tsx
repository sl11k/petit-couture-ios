import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, ChevronLeft, ChevronRight } from "lucide-react";
import hero from "@/assets/hero-campaign.jpg";
import { categories } from "@/data/categories";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { useImpression } from "@/hooks/useImpression";
import { BrandLogo } from "@/components/Logo";

import {
  fetchAnnouncements,
  fetchBanners,
  fetchFeaturedCategories,
  fetchHomeSections,
  fetchPopularPicks,
  fetchStorefrontSettings,
  resolveSectionProducts,
  type AnnouncementMessage,
  type Banner,
  type FeaturedCategory,
  type HomeSection,
  type PopularPick,
  type ResolvedProduct,
  type StorefrontSettings,
} from "@/lib/storefront";

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
  const ar = lang === "ar";
  const wishlist = useWishlist();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [featuredCats, setFeaturedCats] = useState<FeaturedCategory[]>([]);
  const [popular, setPopular] = useState<PopularPick[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementMessage[]>([]);
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [annIdx, setAnnIdx] = useState(0);

  useEffect(() => {
    fetchBanners().then(setBanners).catch(() => {});
    fetchFeaturedCategories().then(setFeaturedCats).catch(() => {});
    fetchPopularPicks().then(setPopular).catch(() => {});
    fetchAnnouncements().then(setAnnouncements).catch(() => {});
    fetchStorefrontSettings().then(setSettings).catch(() => {});
  }, []);

  const displayMode = settings?.banner_display_mode ?? "rotate";

  // Banner auto-rotate (only in 'rotate' mode)
  useEffect(() => {
    if (banners.length <= 1 || displayMode !== "rotate") return;
    const sec = settings?.banner_autoplay_seconds ?? 5;
    const id = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), sec * 1000);
    return () => clearInterval(id);
  }, [banners.length, settings?.banner_autoplay_seconds, displayMode]);

  // Announcement rotate (DB-driven first, fallback to dictionary)
  const annMessages = announcements.length > 0
    ? announcements.map((a) => (ar ? a.message_ar : a.message_en))
    : t.announcements;
  useEffect(() => {
    if (annMessages.length <= 1) return;
    const sec = settings?.announcement_rotate_seconds ?? 4;
    const id = setInterval(() => setAnnIdx((i) => (i + 1) % annMessages.length), sec * 1000);
    return () => clearInterval(id);
  }, [annMessages.length, settings?.announcement_rotate_seconds]);

  useEffect(() => { setAnnIdx(0); }, [lang, announcements.length]);

  // Render category cards: dynamic if popular_picks exist, else fallback to seed data
  const popularCards = popular.length > 0
    ? popular.map((p) => ({
        key: p.id,
        href: p.link_url,
        img: p.image_url,
        label: ar ? p.label_ar : p.label_en,
        wishId: `popular:${p.id}`,
      }))
    : categories.map((c) => ({
        key: c.slug,
        href: `/category/${c.slug}`,
        img: c.img,
        label: t.categories[c.slug] ?? c.name,
        wishId: `category:${c.slug}`,
      }));

  const currentBanner = banners[bannerIdx];

  return (
    <div className="min-h-screen w-full bg-cream flex flex-col items-center">
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

          <Link to="/" aria-label="Le Petit Paradis" className="flex flex-col items-center select-none">
            <BrandLogo height={34} />
          </Link>

          <Link
            to="/wishlist"
            aria-label={isRTL ? "المفضلة" : "Wishlist"}
            className="relative h-10 w-10 -me-2 grid place-items-center rounded-full border border-gold-soft text-gold-deep active:scale-95 transition"
          >
            <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} fill={wishlist.count > 0 ? "currentColor" : "none"} />
            {wishlist.count > 0 && (
              <span aria-hidden="true" className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-background text-[10px] font-medium grid place-items-center shadow-soft">
                {wishlist.count > 99 ? "99+" : wishlist.count}
              </span>
            )}
          </Link>
        </header>

        {/* Announcement bar (rotating) */}
        <div className="relative bg-cream-warm">
          <div className="h-[52px] flex items-center justify-center px-6 text-[13.5px] text-foreground/80 tracking-soft">
            <span key={`${lang}-${annIdx}`} className="animate-in fade-in duration-500 text-center">
              {annMessages[annIdx] ?? ""}
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        </div>

        <main className="pb-[120px]">
          {/* Banner slider (dynamic) */}
          <section className="px-5 pt-5">
            {displayMode === "slider" && banners.length > 0 ? (
              /* ---- Swipeable horizontal slider ---- */
              <div className="relative">
                <div
                  className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar -mx-1 px-1"
                  style={{ scrollbarWidth: "none" }}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const w = el.clientWidth;
                    setBannerIdx(Math.round(el.scrollLeft / w));
                  }}
                >
                  {banners.map((bn) => (
                    <a
                      key={bn.id}
                      href={bn.cta_url ?? "#"}
                      className="relative shrink-0 w-full snap-center overflow-hidden rounded-[28px] bg-pastel-peach"
                    >
                      <img
                        src={bn.image_url}
                        alt={ar ? (bn.title_ar ?? "") : (bn.title_en ?? "")}
                        className="w-full h-[440px] object-cover"
                        width={1280}
                        height={1280}
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 px-6 text-center">
                        {(ar ? bn.eyebrow_ar : bn.eyebrow_en) && (
                          <span className="text-[10.5px] tracking-luxury text-foreground/75">
                            {ar ? bn.eyebrow_ar : bn.eyebrow_en}
                          </span>
                        )}
                        {(ar ? bn.title_ar : bn.title_en) && (
                          <h1 className="mt-2 font-serif text-[56px] leading-[0.95] text-foreground">
                            {ar ? bn.title_ar : bn.title_en}
                          </h1>
                        )}
                        {(ar ? bn.subtitle_ar : bn.subtitle_en) && (
                          <p className="mt-1 font-serif italic text-[24px] text-foreground/85">
                            {ar ? bn.subtitle_ar : bn.subtitle_en}
                          </p>
                        )}
                        {(ar ? bn.cta_label_ar : bn.cta_label_en) && (
                          <span className="mt-5 inline-flex items-center justify-center h-[52px] px-10 rounded-full bg-background text-foreground text-[14px] font-medium tracking-soft shadow-soft">
                            {ar ? bn.cta_label_ar : bn.cta_label_en}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
                {banners.length > 1 && (
                  <div className="mt-3 flex justify-center gap-1.5">
                    {banners.map((_, i) => (
                      <span key={i} className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? "w-6 bg-foreground" : "w-1.5 bg-foreground/40"}`} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ---- Auto-rotate (stacked) mode ---- */
              <div className="relative overflow-hidden rounded-[28px] bg-pastel-peach">
                {currentBanner ? (
                  <a href={currentBanner.cta_url ?? "#"} className="block">
                    <img
                      key={currentBanner.id}
                      src={currentBanner.image_url}
                      alt={ar ? (currentBanner.title_ar ?? "") : (currentBanner.title_en ?? "")}
                      className="w-full h-[440px] object-cover animate-in fade-in duration-500"
                      width={1280}
                      height={1280}
                      loading="eager"
                      decoding="sync"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 px-6 text-center">
                      {(ar ? currentBanner.eyebrow_ar : currentBanner.eyebrow_en) && (
                        <span className="text-[10.5px] tracking-luxury text-foreground/75">
                          {ar ? currentBanner.eyebrow_ar : currentBanner.eyebrow_en}
                        </span>
                      )}
                      {(ar ? currentBanner.title_ar : currentBanner.title_en) && (
                        <h1 className="mt-2 font-serif text-[56px] leading-[0.95] text-foreground">
                          {ar ? currentBanner.title_ar : currentBanner.title_en}
                        </h1>
                      )}
                      {(ar ? currentBanner.subtitle_ar : currentBanner.subtitle_en) && (
                        <p className="mt-1 font-serif italic text-[24px] text-foreground/85">
                          {ar ? currentBanner.subtitle_ar : currentBanner.subtitle_en}
                        </p>
                      )}
                      {(ar ? currentBanner.cta_label_ar : currentBanner.cta_label_en) && (
                        <span className="mt-5 inline-flex items-center justify-center h-[52px] px-10 rounded-full bg-background text-foreground text-[14px] font-medium tracking-soft shadow-soft">
                          {ar ? currentBanner.cta_label_ar : currentBanner.cta_label_en}
                        </span>
                      )}
                    </div>
                  </a>
                ) : (
                  // Fallback hero (no banners configured yet)
                  <div>
                    <img src={hero} alt="Le Petit Paradis" className="w-full h-[440px] object-cover" loading="eager" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 px-6 text-center">
                      <h1 className="mt-2 font-serif text-[56px] leading-[0.95] text-foreground">Le Petit Paradis</h1>
                      <p className="mt-1 font-serif italic text-[22px] text-foreground/85">{ar ? "أناقة الأطفال" : "Children's elegance"}</p>
                    </div>
                  </div>
                )}

                {/* Banner controls */}
                {banners.length > 1 && (
                  <>
                    <button
                      aria-label="Previous"
                      onClick={() => setBannerIdx((i) => (i - 1 + banners.length) % banners.length)}
                      className="absolute top-1/2 -translate-y-1/2 start-2 h-9 w-9 rounded-full bg-background/80 backdrop-blur grid place-items-center text-foreground"
                    >
                      {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                    <button
                      aria-label="Next"
                      onClick={() => setBannerIdx((i) => (i + 1) % banners.length)}
                      className="absolute top-1/2 -translate-y-1/2 end-2 h-9 w-9 rounded-full bg-background/80 backdrop-blur grid place-items-center text-foreground"
                    >
                      {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                      {banners.map((_, i) => (
                        <span key={i} className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? "w-6 bg-foreground" : "w-1.5 bg-foreground/40"}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Featured categories (dynamic) */}
          {featuredCats.length > 0 && (
            <section className="px-5 mt-7">
              <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(featuredCats.length, 3)}, minmax(0, 1fr))` }}>
                {featuredCats.map((fc) => (
                  <a
                    key={fc.id}
                    href={fc.link_url}
                    className="h-[54px] rounded-full bg-gold-soft border border-gold text-gold-deep font-medium text-[15px] grid place-items-center active:scale-[0.97] transition"
                  >
                    {ar ? fc.label_ar : fc.label_en}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Most Popular */}
          <section className="mt-12 px-5">
            <div className="text-center">
              <span className="text-[10.5px] tracking-luxury text-gold-deep">{t.curatedEdit}</span>
              <h2 className="font-serif text-[34px] leading-tight text-foreground mt-1.5">{t.mostPopular}</h2>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-7">
              {popularCards.map((c) => {
                const liked = wishlist.has(c.wishId);
                return (
                  <ImpressionCell key={c.key} itemId={c.wishId} source="category_card">
                    <a href={c.href} className="group flex flex-col items-center text-left active:scale-[0.99] transition">
                      <div className="relative w-full overflow-hidden rounded-[22px] bg-cream-warm aspect-[1.35/1]">
                        <img
                          src={c.img}
                          alt={c.label}
                          loading="lazy"
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                        <button
                          type="button"
                          aria-label={isRTL ? (liked ? "إزالة من المفضلة" : "أضف للمفضلة") : (liked ? "Remove" : "Save")}
                          aria-pressed={liked}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); wishlist.toggle(c.wishId, "category_card"); }}
                          className="absolute top-2.5 end-2.5 h-9 w-9 rounded-full bg-background/85 backdrop-blur grid place-items-center text-gold-deep border border-gold-soft active:scale-90 transition"
                        >
                          <Heart className="h-[15px] w-[15px]" strokeWidth={1.6} fill={liked ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <span className="mt-3 text-[15px] text-foreground/85 font-medium tracking-tight text-center">{c.label}</span>
                    </a>
                  </ImpressionCell>
                );
              })}
            </div>

            <div className="mt-10 flex justify-center">
              <Link to="/search" className="h-[52px] px-10 rounded-full bg-background border border-border text-gold-deep text-[12px] tracking-luxury font-medium grid place-items-center active:scale-[0.97] transition">
                {t.shopAll}
              </Link>
            </div>
          </section>
        </main>
      </div>

    </div>
  );
}
