import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { useBag } from "@/state/BagContext";
import { categories } from "@/data/categories";
import { supabase } from "@/integrations/supabase/client";
import { useDbCategories } from "@/hooks/useDbCategories";
import { BrandLogo } from "@/components/Logo";
import { CurrencySelector } from "@/components/CurrencySelector";

/**
 * Wide luxury header shown only on desktop (lg+). The mobile experience keeps
 * its existing in-frame header and bottom nav untouched. Marked `data-desktop-header`
 * so the global CSS rule in styles.css can hide it below the lg breakpoint
 * even when child routes don't conditionally render it.
 */
export function DesktopHeader() {
  const { t, lang, toggle, isRTL } = useLanguage();
  const wishlist = useWishlist();
  const bag = useBag();
  const location = useLocation();
  // Counts come from localStorage and are client-only — defer to avoid SSR hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wishCount = mounted ? wishlist.count : 0;
  const bagCount = mounted ? bag.count : 0;

  // Featured nav: a curated subset of categories to keep the bar elegant.
  const featured = categories.slice(0, 7);
  const dbCats = useDbCategories();
  const [navItems, setNavItems] = useState<Array<{slug:string; name_ar:string; name_en:string; href:string}>>([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("header_nav_items")
          .select("label_ar, label_en, href, is_active, display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (Array.isArray(data) && data.length) {
          const rows = data.map((r: any) => ({
            slug: (r.href as string).replace(/^\//, "").replace(/^category\//, "") || "home",
            name_ar: r.label_ar || r.label_en || "",
            name_en: r.label_en || r.label_ar || "",
            href: r.href as string,
          }));
          setNavItems(rows);
        }
      } catch (e) { console.error("[DesktopHeader] nav fetch failed", e); }
    })();
  }, []);
  const dynamicFeatured = navItems.length > 0
    ? navItems
    : dbCats.length > 0
      ? dbCats.slice(0, 8).map((c) => ({ slug: c.slug, name_ar: c.name_ar, name_en: c.name_en, href: `/category/${c.slug}` }))
      : featured.map((c) => ({ slug: c.slug, name_ar: c.name, name_en: c.name, href: `/category/${c.slug}` }));

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <header
      data-desktop-header
      className="hidden lg:block sticky top-0 z-40 bg-background/92 backdrop-blur-md border-b border-border"
    >
      {/* Announcement strip */}
      <div className="bg-cream-warm border-b border-gold-soft/60">
        <div className="mx-auto max-w-[1480px] px-10 h-9 flex items-center justify-between text-[11px] tracking-soft text-foreground/75">
          <span className="tracking-luxury text-gold-deep">{t.brandTagline}</span>
          <span>{t.announcements[0]}</span>
          <div className="flex items-center gap-4">
            <CurrencySelector />
            <button
              type="button"
              onClick={toggle}
              className="tracking-luxury text-foreground/75 hover:text-foreground transition"
              aria-label={isRTL ? "تبديل اللغة" : "Toggle language"}
            >
              {lang === "en" ? "عربي" : "EN"}
            </button>
          </div>
        </div>
      </div>

      {/* Brand row */}
      <div className="mx-auto max-w-[1480px] px-10 h-[78px] grid grid-cols-3 items-center">
        <div className="flex items-center gap-3">
          <Link
            to="/search"
            aria-label={isRTL ? "بحث" : "Search"}
            className="h-10 w-10 grid place-items-center rounded-xl text-foreground/75 hover:text-foreground hover:bg-cream-warm transition"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </Link>
        </div>

        <Link to="/" className="flex flex-col items-center select-none group" aria-label="Le Petit Paradis">
          <BrandLogo height={48} className="group-hover:opacity-90 transition" />
          <span className="mt-1 text-[9px] tracking-luxury text-muted-foreground">
            {isRTL ? "بوتيك أطفال فاخر" : "LUXURY KIDS BOUTIQUE"}
          </span>
        </Link>

        <div className={["flex items-center gap-1", isRTL ? "justify-start" : "justify-end"].join(" ")}>
          <Link
            to="/account"
            aria-label={isRTL ? "الحساب" : "Account"}
            className={[
              "h-10 w-10 grid place-items-center rounded-xl transition",
              isActive("/account")
                ? "text-gold-deep bg-cream-warm"
                : "text-foreground/75 hover:text-foreground hover:bg-cream-warm",
            ].join(" ")}
          >
            <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </Link>
          <Link
            to="/wishlist"
            aria-label={isRTL ? "المفضلة" : "Wishlist"}
            className={[
              "relative h-10 w-10 grid place-items-center rounded-xl transition",
              isActive("/wishlist")
                ? "text-gold-deep bg-cream-warm"
                : "text-foreground/75 hover:text-foreground hover:bg-cream-warm",
            ].join(" ")}
          >
            <Heart
              className="h-[18px] w-[18px]"
              strokeWidth={1.5}
              fill={wishCount > 0 ? "currentColor" : "none"}
            />
            {wishCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-gold text-background text-[9.5px] font-medium grid place-items-center">
                {wishCount > 99 ? "99+" : wishCount}
              </span>
            )}
          </Link>
          <Link
            to="/bag"
            aria-label={isRTL ? "الحقيبة" : "Bag"}
            className={[
              "relative h-10 w-10 grid place-items-center rounded-xl transition",
              isActive("/bag")
                ? "text-gold-deep bg-cream-warm"
                : "text-foreground/75 hover:text-foreground hover:bg-cream-warm",
            ].join(" ")}
          >
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {bagCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-gold text-background text-[9.5px] font-medium grid place-items-center">
                {bagCount > 99 ? "99+" : bagCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Category nav */}
      <nav className="border-t border-border/60">
        <div className="mx-auto max-w-[1480px] px-10 h-12 flex items-center justify-center gap-1">
          {dynamicFeatured.map((c) => {
            const active = location.pathname === `/category/${c.slug}`;
            return (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={[
                  "px-4 h-9 inline-flex items-center rounded-xl text-[11.5px] tracking-luxury transition",
                  active
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:text-foreground hover:bg-cream-warm",
                ].join(" ")}
              >
                {lang === "en"
                  ? (t.categories[c.slug] ?? c.name_en).toUpperCase()
                  : (t.categories[c.slug] ?? c.name_ar)}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
