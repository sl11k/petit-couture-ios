import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  Search,
  Heart,
  ShoppingBag,
  User,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useBag } from "@/state/BagContext";
import { useWishlist } from "@/state/WishlistContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * MobileHeader — هيدر مدمج للجوال:
 *  - زر رجوع (اختياري) أو شعار
 *  - عنوان الصفحة
 *  - زر بحث + سلة (مع badge)
 *  - يلتصق بالأعلى ويترك مساحة آمنة لـ notch
 *  - يختفي على lg+ (DesktopHeader يتولى الباقي)
 */
export function MobileHeader({
  title,
  showBack = false,
  rightSlot,
  className,
}: {
  title?: string;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const bag = useBag();
  const { isRTL } = useLanguage();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const bagCount = bag.items?.reduce?.((n, i) => n + (i.quantity ?? 1), 0) ?? 0;

  return (
    <header
      className={cn(
        "lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border",
        "pt-[env(safe-area-inset-top)]",
        className,
      )}
    >
      <div className="h-14 px-3 flex items-center gap-2">
        {showBack ? (
          <button
            type="button"
            onClick={() => navigate({ to: ".." as any }).catch(() => history.back())}
            aria-label={isRTL ? "رجوع" : "Back"}
            className="h-11 w-11 -ms-2 grid place-items-center rounded-full hover:bg-accent active:bg-accent/70"
          >
            <BackIcon className="h-5 w-5" />
          </button>
        ) : (
          <Link
            to="/"
            aria-label="Home"
            className="font-serif text-lg tracking-luxury text-foreground"
          >
            ATELIER
          </Link>
        )}

        <h1 className="flex-1 text-center text-sm font-medium truncate px-2">
          {title}
        </h1>

        {rightSlot ?? (
          <div className="flex items-center gap-1">
            <Link
              to="/search"
              aria-label="Search"
              className="h-11 w-11 grid place-items-center rounded-full hover:bg-accent active:bg-accent/70"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              to="/bag"
              aria-label="Bag"
              className="relative h-11 w-11 -me-2 grid place-items-center rounded-full hover:bg-accent active:bg-accent/70"
            >
              <ShoppingBag className="h-5 w-5" />
              {bagCount > 0 && (
                <span className="absolute top-1 end-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
                  {bagCount > 99 ? "99+" : bagCount}
                </span>
              )}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * MobileBottomNav — تنقّل سفلي ثابت للجوال
 *  - 5 أزرار رئيسية، كلٌ بمنطقة لمس ≥48px
 *  - يحترم safe-area-inset-bottom (iPhone home indicator)
 *  - يختفي تلقائيًا على lg+
 *  - يختفي في صفحات Checkout لتقليل التشتيت
 */
const HIDE_ON: string[] = [
  "/checkout",
  "/login",
  "/admin",
  "/order-confirmation",
];

export function MobileBottomNav() {
  const location = useLocation();
  const bag = useBag();
  const wishlist = useWishlist();
  const path = location.pathname;

  if (HIDE_ON.some((p) => path.startsWith(p))) return null;

  const bagCount = bag.items?.reduce?.((n, i) => n + (i.quantity ?? 1), 0) ?? 0;
  const wlCount = wishlist.items?.length ?? 0;

  const items = [
    { to: "/", icon: Home, label: "الرئيسية", exact: true },
    { to: "/search", icon: Search, label: "البحث" },
    { to: "/wishlist", icon: Heart, label: "المفضلة", count: wlCount },
    { to: "/bag", icon: ShoppingBag, label: "السلة", count: bagCount },
    { to: "/account", icon: User, label: "حسابي" },
  ] as const;

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  return (
    <>
      {/* Spacer to prevent content overlap */}
      <div className="lg:hidden h-[calc(64px+env(safe-area-inset-bottom))]" aria-hidden />
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-5 h-16">
          {items.map(({ to, icon: Icon, label, count, exact }) => {
            const active = isActive(to, exact);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "h-full w-full flex flex-col items-center justify-center gap-0.5 relative",
                    "transition-colors active:bg-accent/60",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {!!count && count > 0 && (
                      <span className="absolute -top-1.5 -end-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] leading-none">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/**
 * MobileSearchBar — صف بحث بارز يُعرض أعلى الشاشات الرئيسية
 * (مختلف عن SearchBar في الهيدر الذي قد يكون مخفيًا).
 */
export function MobileSearchBar({
  placeholder = "ابحث عن منتج، قسم، علامة…",
}: {
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim())
          navigate({ to: "/search", search: { q: q.trim() } as any });
      }}
      className="lg:hidden px-3 py-2 bg-background"
    >
      <label className="flex items-center gap-2 h-11 px-3 rounded-full bg-muted">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="search"
          enterKeyHint="search"
          placeholder={placeholder}
          className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
          aria-label="بحث"
        />
      </label>
    </form>
  );
}
