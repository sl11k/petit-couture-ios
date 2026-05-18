import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { buildMeta } from "@/lib/seo";
import { ChevronLeft, ChevronRight, Heart, Share2, Sparkles, Trash2, UserCircle2, Undo2, ArrowUpDown, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { useAuth } from "@/state/AuthContext";
import { categories, getProductForCategory } from "@/data/categories";
import { useDbProductsBySlugs } from "@/hooks/useDbProducts";
import { usePriceFormatter } from "@/state/CurrencyContext";
import { trackEvent, type WishlistSortKey } from "@/lib/analytics";
import { clearLastImport, readLastImport } from "@/lib/lastImport";
import { ShareSheet, type ShareSheetPayload } from "@/components/ShareSheet";
import hero from "@/assets/hero-campaign.jpg";

const SORT_STORAGE_KEY = "maisonnet:wishlist:sort:v1";
const SORT_KEYS: readonly WishlistSortKey[] = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
] as const;

function readStoredSort(): WishlistSortKey {
  if (typeof window === "undefined") return "newest";
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (raw && (SORT_KEYS as readonly string[]).includes(raw)) {
      return raw as WishlistSortKey;
    }
  } catch {
    /* ignore */
  }
  return "newest";
}

function buildShareUrl(ids: string[]): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://maisonnet.app";
  const params = new URLSearchParams({ ids: ids.join(",") });
  return `${origin}/wishlist/share?${params.toString()}`;
}

export const Route = createFileRoute("/wishlist")({
  head: () =>
    buildMeta({
      title: "قائمة الرغبات — Le Petit Paradis",
      description:
        "قطعك المحفوظة من Le Petit Paradis — راجعها، أزل ما لا تحتاجه، وأكمل تسوقك بسهولة.",
      path: "/wishlist",
      noindex: true,
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
};

function WishlistPage() {
  const router = useRouter();
  const { t, lang, isRTL } = useLanguage();
  const wishlist = useWishlist();
  const { user, ready } = useAuth();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const [sharePayload, setSharePayload] = useState<ShareSheetPayload | null>(null);

  // Capture once-per-visit list of IDs that arrived via /wishlist/share, so the
  // user can roll back the import in a single tap. Reading clears the slot —
  // the affordance never reappears on back/forward navigation.
  const [importedIds, setImportedIds] = useState<string[]>([]);
  useEffect(() => {
    const last = readLastImport();
    if (last && last.ids.length > 0) {
      setImportedIds(last.ids);
      clearLastImport();
    }
  }, []);

  const onUndoImport = useCallback(() => {
    const ids = importedIds;
    if (ids.length === 0) return;
    for (const id of ids) wishlist.remove(id, "shared_link");
    setImportedIds([]);
    const message = isRTL
      ? ids.length === 1
        ? "تم حذف العنصر المستورد"
        : `تم حذف ${ids.length} عناصر مستوردة`
      : ids.length === 1
        ? "Removed 1 imported piece"
        : `Removed ${ids.length} imported pieces`;
    toast(message, {
      icon: <Undo2 className="h-4 w-4" strokeWidth={1.7} />,
      position: isRTL ? "top-left" : "top-right",
      duration: 2200,
    });
  }, [importedIds, wishlist, isRTL]);

  const shareItem = useCallback(
    (id: string, name: string) => {
      trackEvent({
        name: "wishlist_share",
        ts: Date.now(),
        scope: "item",
        itemCount: 1,
        source: "wishlist_screen",
      });
      setSharePayload({
        url: buildShareUrl([id]),
        title: name,
        message: isRTL
          ? `أحببتُ هذه القطعة من لو بوتي باراديس: ${name}`
          : `I'm loving this piece from Le Petit Paradis: ${name}`,
      });
    },
    [isRTL],
  );

  const shareAll = useCallback(() => {
    trackEvent({
      name: "wishlist_share",
      ts: Date.now(),
      scope: "all",
      itemCount: wishlist.items.length,
      source: "wishlist_screen",
    });
    setSharePayload({
      url: buildShareUrl(wishlist.items),
      title: t.wishlist.shareTitle,
      message: t.wishlist.shareText,
    });
  }, [wishlist.items, t.wishlist, isRTL]);

  const wishlistSlugs = useMemo(
    () =>
      wishlist.items
        .filter((id) => id.startsWith("product:") || id.startsWith("category:"))
        .map((id) => id.split(":")[1]),
    [wishlist.items],
  );
  const { bySlug: wishlistProductsBySlug } = useDbProductsBySlugs(wishlistSlugs);

  const resolved = useMemo<ResolvedItem[]>(() => {
    return wishlist.items
      .map((id): ResolvedItem | null => {
        if (id.startsWith("product:")) {
          const slug = id.slice("product:".length);
          if (!slug) return null;
          const dbProduct = wishlistProductsBySlug[slug];
          const cat = categories.find((c) => c.slug === slug);
          const product = dbProduct ?? (cat ? getProductForCategory(slug) : null);
          if (product) {
            return {
              id,
              kind: "product",
              slug,
              name: product.name,
              brand: product.brand,
              image: product.images[0] ?? cat?.img ?? "",
              price: product.price,
              currency: product.currency,
            };
          }
          // DB lookup pending or product missing — render minimal placeholder.
          return {
            id,
            kind: "product",
            slug,
            name: slug,
            brand: null,
            image: "",
            price: null,
            currency: "SAR",
          };
        }
        if (id.startsWith("category:")) {
          const slug = id.slice("category:".length);
          const cat = categories.find((c) => c.slug === slug);
          if (!cat) return null;
          const product = getProductForCategory(slug);
          return {
            id,
            kind: "category",
            slug,
            name: product.name,
            brand: product.brand,
            image: product.images[0] ?? cat.img,
            price: product.price,
            currency: product.currency,
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
          };
        }
        return null;
      })
      .filter((x): x is ResolvedItem => x !== null);
  }, [wishlist.items, t.hero, wishlistProductsBySlug]);

  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");
  const fmtPrice = usePriceFormatter();

  // ─── Sort ────────────────────────────────────────────────────────────────
  // Persist the chosen sort across visits. The wishlist's underlying `items`
  // array preserves insertion order, so we treat that as "oldest first" and
  // derive every other ordering from it.
  const [sortKey, setSortKey] = useState<WishlistSortKey>(() => readStoredSort());
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortKey);
    } catch {
      /* ignore */
    }
  }, [sortKey]);

  // Close the sort menu on outside click / Escape.
  useEffect(() => {
    if (!sortMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!sortMenuRef.current) return;
      if (!sortMenuRef.current.contains(e.target as Node)) setSortMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortMenuOpen]);

  const sortLabels: Record<WishlistSortKey, string> = {
    newest: t.wishlist.sortNewest,
    oldest: t.wishlist.sortOldest,
    price_asc: t.wishlist.sortPriceAsc,
    price_desc: t.wishlist.sortPriceDesc,
    name_asc: t.wishlist.sortNameAsc,
  };

  const sortedResolved = useMemo<ResolvedItem[]>(() => {
    const arr = [...resolved];
    const collator = new Intl.Collator(lang === "ar" ? "ar" : "en", {
      sensitivity: "base",
    });
    switch (sortKey) {
      case "newest":
        return arr.reverse();
      case "oldest":
        return arr;
      case "price_asc":
        return arr.sort((a, b) => {
          if (a.price === null && b.price === null) return 0;
          if (a.price === null) return 1; // nulls last
          if (b.price === null) return -1;
          return a.price - b.price;
        });
      case "price_desc":
        return arr.sort((a, b) => {
          if (a.price === null && b.price === null) return 0;
          if (a.price === null) return 1;
          if (b.price === null) return -1;
          return b.price - a.price;
        });
      case "name_asc":
        return arr.sort((a, b) => collator.compare(a.name, b.name));
      default:
        return arr;
    }
  }, [resolved, sortKey, lang]);

  const onSelectSort = useCallback(
    (next: WishlistSortKey) => {
      setSortMenuOpen(false);
      if (next === sortKey) return;
      const previous = sortKey;
      setSortKey(next);
      trackEvent({
        name: "wishlist_sort_change",
        ts: Date.now(),
        sort: next,
        previousSort: previous,
        itemCount: resolved.length,
        source: "wishlist_screen",
      });
    },
    [sortKey, resolved.length],
  );

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
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
            <div className="-me-2 flex items-center gap-1">
              <button
                onClick={shareAll}
                aria-label={t.wishlist.shareAll}
                className="h-10 w-10 grid place-items-center rounded-full text-gold-deep active:scale-95 transition"
              >
                <Share2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => {
                  const snapshot = [...wishlist.items];
                  if (snapshot.length === 0) return;
                  toast(isRTL ? "مسح جميع العناصر؟" : "Clear all items?", {
                    description: isRTL
                      ? "سيتم إزالة كل ما في قائمة الرغبات."
                      : "Everything in your wishlist will be removed.",
                    icon: <Trash2 className="h-4 w-4" strokeWidth={1.7} />,
                    position: isRTL ? "top-left" : "top-right",
                    duration: 5000,
                    action: {
                      label: isRTL ? "مسح" : "Clear",
                      onClick: () => wishlist.clear("wishlist_screen"),
                    },
                    cancel: {
                      label: isRTL ? "إلغاء" : "Cancel",
                      onClick: () => { void snapshot; },
                    },
                  });
                }}
                className="h-10 px-3 grid place-items-center rounded-full text-[10.5px] tracking-luxury text-gold-deep active:scale-95 transition"
              >
                {lang === "en" ? t.wishlist.clearAll.toUpperCase() : t.wishlist.clearAll}
              </button>
            </div>
          ) : (
            <span className="h-10 w-10" />
          )}
        </header>

        <main className="pb-12">
          {importedIds.length > 0 && (
            <div className="mx-5 mt-1 mb-4 flex items-center gap-3 rounded-[18px] border border-gold-soft bg-gold-soft/40 px-4 py-3">
              <span className="h-9 w-9 grid place-items-center rounded-full bg-background border border-gold-soft text-gold-deep shrink-0">
                <Heart className="h-[16px] w-[16px]" strokeWidth={1.6} fill="currentColor" />
              </span>
              <span className={["min-w-0 flex-1 leading-tight", isRTL ? "text-right" : "text-left"].join(" ")}>
                <span className="block text-[10.5px] tracking-luxury text-gold-deep">
                  {isRTL ? "مستورد للتو" : "JUST IMPORTED"}
                </span>
                <span className="block text-[12.5px] text-foreground/80 tracking-soft truncate">
                  {isRTL
                    ? importedIds.length === 1
                      ? "تمت إضافة قطعة واحدة من رابط مشترك"
                      : `تمت إضافة ${importedIds.length} قطع من رابط مشترك`
                    : importedIds.length === 1
                      ? "1 piece added from a shared link"
                      : `${importedIds.length} pieces added from a shared link`}
                </span>
              </span>
              <button
                type="button"
                onClick={onUndoImport}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-[10.5px] tracking-luxury active:scale-95 transition"
              >
                <Undo2 className="h-[11px] w-[11px]" strokeWidth={1.8} />
                {isRTL ? "تراجع" : "UNDO"}
              </button>
            </div>
          )}
          {ready && !user && wishlist.count > 0 && (
            <Link
              to="/account"
              className="mx-5 mt-1 mb-4 flex items-center gap-3 rounded-[18px] border border-gold-soft bg-cream-warm/60 px-4 py-3 active:scale-[0.99] transition"
            >
              <span className="h-9 w-9 grid place-items-center rounded-full bg-background border border-gold-soft text-gold-deep shrink-0">
                <UserCircle2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </span>
              <span className={["min-w-0 flex-1 leading-tight", isRTL ? "text-right" : "text-left"].join(" ")}>
                <span className="block text-[10.5px] tracking-luxury text-gold-deep">
                  {isRTL ? t.account.syncBannerTitle : t.account.syncBannerTitle.toUpperCase()}
                </span>
                <span className="block text-[12.5px] text-foreground/80 tracking-soft truncate">
                  {t.account.syncBannerBody}
                </span>
              </span>
              <span className="shrink-0 inline-flex items-center h-8 px-3 rounded-full bg-foreground text-background text-[10.5px] tracking-luxury">
                {isRTL ? t.account.syncBannerCta : t.account.syncBannerCta.toUpperCase()}
              </span>
            </Link>
          )}
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
                <div className={["mt-1 flex items-center justify-between gap-3", isRTL ? "flex-row-reverse" : ""].join(" ")}>
                  <p className="text-[12px] tracking-luxury text-gold-deep">
                    {fmt(resolved.length)}{" "}
                    {resolved.length === 1 ? t.wishlist.item : t.wishlist.items}
                  </p>
                  {resolved.length > 1 && (
                    <div ref={sortMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setSortMenuOpen((v) => !v)}
                        aria-haspopup="listbox"
                        aria-expanded={sortMenuOpen}
                        aria-label={t.wishlist.sortBy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background text-[11px] tracking-soft text-foreground/80 active:scale-[0.97] transition"
                      >
                        <ArrowUpDown className="h-[12px] w-[12px]" strokeWidth={1.6} />
                        <span className="text-[10.5px] tracking-luxury text-gold-deep">
                          {lang === "en" ? t.wishlist.sortBy.toUpperCase() : t.wishlist.sortBy}
                        </span>
                        <span aria-hidden className="text-foreground/40">·</span>
                        <span>{sortLabels[sortKey]}</span>
                      </button>
                      {sortMenuOpen && (
                        <ul
                          role="listbox"
                          aria-label={t.wishlist.sortBy}
                          className={[
                            "absolute z-20 mt-2 min-w-[220px] rounded-[18px] border border-border bg-background shadow-soft py-1.5",
                            isRTL ? "start-0" : "end-0",
                          ].join(" ")}
                        >
                          {SORT_KEYS.map((k) => {
                            const selected = k === sortKey;
                            return (
                              <li key={k}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => onSelectSort(k)}
                                  className={[
                                    "w-full flex items-center gap-2 px-4 py-2.5 text-[13px] tracking-soft transition",
                                    isRTL ? "text-right flex-row-reverse" : "text-left",
                                    selected ? "text-foreground" : "text-foreground/75 hover:text-foreground",
                                  ].join(" ")}
                                >
                                  <span className="flex-1 truncate">{sortLabels[k]}</span>
                                  {selected ? (
                                    <Check className="h-[14px] w-[14px] text-gold-deep shrink-0" strokeWidth={1.8} />
                                  ) : (
                                    <span className="h-[14px] w-[14px] shrink-0" />
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="px-5 mt-6 space-y-4">
                {sortedResolved.map((it) => {
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
                            {fmtPrice(it.price)}
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
                            aria-label={t.wishlist.share}
                            onClick={() => shareItem(it.id, it.name)}
                            className="h-9 w-9 rounded-full border border-border text-muted-foreground hover:text-foreground active:scale-95 transition grid place-items-center"
                          >
                            <Share2 className="h-[13px] w-[13px]" strokeWidth={1.6} />
                          </button>
                          <button
                            aria-label={ariaLabel}
                            onClick={() => wishlist.remove(it.id, "wishlist_screen")}
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
      <ShareSheet
        open={sharePayload !== null}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
}
