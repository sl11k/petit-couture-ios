import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Search, ShoppingBag, User, ChevronDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { useBag } from "@/state/BagContext";

import { supabase } from "@/integrations/supabase/client";
import { useDbCategoryTree } from "@/hooks/useDbCategories";
import { BrandLogo } from "@/components/Logo";
import { CurrencySelector } from "@/components/CurrencySelector";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { useDbAnnouncements } from "@/hooks/useDbAnnouncements";

/**
 * Wide luxury header shown only on desktop (lg+).
 */
export function DesktopHeader() {
  const { t, lang, toggle, isRTL } = useLanguage();
  const wishlist = useWishlist();
  const bag = useBag();
  const location = useLocation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wishCount = mounted ? wishlist.count : 0;
  const bagCount = mounted ? bag.count : 0;

  const tree = useDbCategoryTree();
  const [navItems, setNavItems] = useState<
    Array<{
      slug: string;
      name_ar: string;
      name_en: string;
      href: string;
      category_id?: string | null;
    }>
  >([]);
  const [navLoaded, setNavLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("header_nav_items")
          .select("label_ar, label_en, href, category_id, is_active, display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (Array.isArray(data) && data.length) {
          const rows = data.map((r: any) => ({
            slug:
              ((r.href as string | null) || r.category_id || "home")
                .replace?.(/^\//, "")
                .replace?.(/^category\//, "") || "home",
            name_ar: r.label_ar || r.label_en || "",
            name_en: r.label_en || r.label_ar || "",
            href: (r.href as string | null) || "",
            category_id: r.category_id ?? null,
          }));
          if (active) setNavItems(rows);
        }
      } catch (e) {
        console.error("[DesktopHeader] nav fetch failed", e);
      } finally {
        if (active) setNavLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // Age groups for "Shop by Age" dropdown — slugs map to existing categories.
  const ageGroups: Array<{ ar: string; en: string; slug: string }> = [
    { ar: "حديثي الولادة (0-12 شهر)", en: "Newborn (0-12 m)", slug: "babysuits" },
    { ar: "أطفال (1-3 سنوات)", en: "Toddlers (1-3 y)", slug: "outfit-sets" },
    { ar: "أطفال (4-7 سنوات)", en: "Kids (4-7 y)", slug: "dresses" },
    { ar: "أطفال (8-12 سنة)", en: "Kids (8-12 y)", slug: "tops" },
  ];

  const announcementMessages = useDbAnnouncements(t.announcements, lang as "ar" | "en");
  const hasCustomNav = navItems.length > 0;
  const showFallbackNav = navLoaded && !hasCustomNav;

  return (
    <header
      data-desktop-header
      data-live-id="site-header"
      className="hidden lg:block sticky top-0 z-40 bg-background/92 backdrop-blur-md border-b border-border"
    >
      {/* Announcement strip */}
      <div className="bg-cream-warm border-b border-gold-soft/60">
        <div className="mx-auto max-w-[1480px] px-10 h-9 flex items-center justify-between text-[11px] tracking-soft text-foreground/75 gap-6">
          <span className="tracking-luxury text-gold-deep whitespace-nowrap">{t.brandTagline}</span>
          <AnnouncementBar messages={announcementMessages} className="flex-1 min-w-0" />
          <div className="flex items-center gap-4 whitespace-nowrap">
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

        <Link
          to="/"
          className="flex flex-col items-center select-none group"
          aria-label="Le Petit Paradis"
        >
          <BrandLogo height={48} className="group-hover:opacity-90 transition" />
          <span className="mt-1 text-[9px] tracking-luxury text-muted-foreground">
            {isRTL ? "بوتيك أطفال فاخر" : "LUXURY KIDS BOUTIQUE"}
          </span>
        </Link>

        <div
          className={["flex items-center gap-1", isRTL ? "justify-start" : "justify-end"].join(" ")}
        >
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
          {/* Shop by Age — hover dropdown */}
          {showFallbackNav && (
            <HoverDropdown
              liveId="header-shop-by-age"
              label={isRTL ? "تسوّق حسب العمر" : "SHOP BY AGE"}
              items={ageGroups.map((g) => ({
                slug: g.slug,
                label: isRTL ? g.ar : g.en,
              }))}
            />
          )}

          {/* Custom header_nav_items override, if any */}
          {navItems.map((c) => {
            const linkedCategory =
              (c.category_id ? tree.find((node) => node.id === c.category_id) : null) ??
              tree.find((node) => c.href === `/category/${node.slug}`);
            const href = c.href || (linkedCategory ? `/category/${linkedCategory.slug}` : "/");
            const active = location.pathname === href;
            if (linkedCategory?.children?.length) {
              return (
                <HoverDropdown
                  key={href}
                  liveId={`header-nav-${c.slug}`}
                  label={lang === "en" ? c.name_en.toUpperCase() : c.name_ar}
                  parentHref={href}
                  items={linkedCategory.children.map((ch) => ({
                    slug: ch.slug,
                    label: isRTL ? ch.name_ar : ch.name_en,
                  }))}
                />
              );
            }
            return (
              <Link
                key={href}
                data-live-id={`header-nav-${c.slug}`}
                to={href as any}
                className={[
                  "px-4 h-9 inline-flex items-center rounded-xl text-[11.5px] tracking-luxury transition",
                  active
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:text-foreground hover:bg-cream-warm",
                ].join(" ")}
              >
                {lang === "en" ? c.name_en.toUpperCase() : c.name_ar}
              </Link>
            );
          })}

          {/* Top-level DB categories. If a category has children, render as dropdown. */}
          {showFallbackNav &&
            tree.slice(0, 8).map((c) => {
              const label =
                lang === "en"
                  ? (t.categories[c.slug] ?? c.name_en).toUpperCase()
                  : (t.categories[c.slug] ?? c.name_ar);
              if (c.children.length > 0) {
                return (
                  <HoverDropdown
                    key={c.slug}
                    liveId={`header-category-${c.slug}`}
                    label={label}
                    parentHref={`/category/${c.slug}`}
                    items={c.children.map((ch) => ({
                      slug: ch.slug,
                      label: isRTL ? ch.name_ar : ch.name_en,
                    }))}
                  />
                );
              }
              const active = location.pathname === `/category/${c.slug}`;
              return (
                <Link
                  key={c.slug}
                  data-live-id={`header-category-${c.slug}`}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className={[
                    "px-4 h-9 inline-flex items-center rounded-xl text-[11.5px] tracking-luxury transition",
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/70 hover:text-foreground hover:bg-cream-warm",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
        </div>
      </nav>
    </header>
  );
}

/**
 * Lightweight hover dropdown — opens on mouseenter/focus, closes on leave/blur.
 * Uses native focus-within for keyboard accessibility.
 */
function HoverDropdown({
  label,
  items,
  columns = 1,
  parentHref,
  liveId,
}: {
  label: string;
  items: Array<{ slug: string; label: string }>;
  columns?: 1 | 2;
  /** If provided, the trigger label itself navigates to this URL (the parent category). */
  parentHref?: string;
  liveId?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) {
    return null;
  }
  return (
    <div
      data-live-id={liveId}
      data-live-region={liveId}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {parentHref ? (
        <Link
          to={parentHref as any}
          aria-haspopup="menu"
          aria-expanded={open}
          className="px-4 h-9 inline-flex items-center gap-1 rounded-xl text-[11.5px] tracking-luxury text-foreground/70 hover:text-foreground hover:bg-cream-warm transition"
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Link>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          className="px-4 h-9 inline-flex items-center gap-1 rounded-xl text-[11.5px] tracking-luxury text-foreground/70 hover:text-foreground hover:bg-cream-warm transition"
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      )}
      {open && (
        <div
          role="menu"
          className="absolute top-full start-0 mt-1 min-w-[260px] bg-background border border-border rounded-xl shadow-xl p-2 z-50"
          style={{ gridTemplateColumns: columns === 2 ? "1fr 1fr" : "1fr", display: "grid" }}
        >
          {items.map((it) => (
            <Link
              key={it.slug}
              to="/category/$slug"
              params={{ slug: it.slug }}
              role="menuitem"
              className="px-3 py-2 rounded-lg text-[12px] text-foreground/80 hover:bg-cream-warm hover:text-foreground transition whitespace-nowrap"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
