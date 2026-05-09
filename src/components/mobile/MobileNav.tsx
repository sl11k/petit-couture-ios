import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  Search,
  ShoppingBag,
  User,
  ArrowLeft,
  ArrowRight,
  Menu as MenuIcon,
  Baby,
  Sparkles,
  ShoppingBasket,
  Gift,
  Crown,
} from "lucide-react";
import { useBag } from "@/state/BagContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

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
  const bagCount = bag.items?.reduce?.((n, i) => n + (i.qty ?? 1), 0) ?? 0;

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
  const { isRTL } = useLanguage();
  const ar = isRTL;
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);

  if (HIDE_ON.some((p) => path.startsWith(p))) return null;

  const bagCount = bag.items?.reduce?.((n, i) => n + (i.qty ?? 1), 0) ?? 0;

  type Item = {
    to: string;
    icon: typeof Home;
    label: string;
    exact?: boolean;
    count?: number;
  };
  const items: Item[] = [
    { to: "/", icon: Home, label: ar ? "الرئيسية" : "Home", exact: true },
    { to: "/search", icon: Search, label: ar ? "البحث" : "Search" },
    { to: "/bag", icon: ShoppingBag, label: ar ? "السلة" : "Bag", count: bagCount },
    { to: "/account", icon: User, label: ar ? "حسابي" : "Account" },
  ];
  const menuLabel = ar ? "القائمة" : "Menu";

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  return (
    <>
      <div className="lg:hidden h-[calc(64px+env(safe-area-inset-bottom))]" aria-hidden />
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side={ar ? "right" : "left"} className="w-[88vw] sm:w-[420px] overflow-y-auto p-0 z-[60]">
            <SheetHeader className="px-5 pt-6 pb-3 border-b">
              <SheetTitle className={cn("font-serif text-2xl text-primary", ar ? "text-right" : "text-left")}>
                {menuLabel}
              </SheetTitle>
            </SheetHeader>
            <CategoryMenu onNavigate={() => setMenuOpen(false)} ar={ar} />
          </SheetContent>
        </Sheet>
        <ul className="grid grid-cols-5 h-16">
          {/* Menu button (opens sheet) */}
          <li>
            <button
              type="button"
              aria-label={menuLabel}
              onClick={() => setMenuOpen(true)}
              className="h-full w-full flex flex-col items-center justify-center gap-0.5 text-primary transition-colors active:bg-accent/60"
            >
              <MenuIcon className="h-5 w-5" strokeWidth={1.8} />
              <span className="text-[10px] leading-none">{menuLabel}</span>
            </button>
          </li>

          {items.map(({ to, icon: Icon, label, count, exact }) => {
            const active = isActive(to, exact);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    "h-full w-full flex flex-col items-center justify-center gap-0.5 relative",
                    "transition-colors active:bg-accent/60 text-primary",
                    active ? "font-semibold" : "",
                  )}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                    {!!count && count > 0 && (
                      <span className="absolute -top-1.5 -end-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] leading-none">{label}</span>
                  {active && (
                    <span aria-hidden className="absolute top-0 inset-x-6 h-[2px] rounded-full bg-primary" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Category menu groups shown inside the Menu sheet */
function CategoryMenu({ onNavigate }: { onNavigate: () => void }) {
  const groups: {
    title: string;
    icon: typeof Baby;
    items: { label: string; to: string; params?: any }[];
  }[] = [
    {
      title: "التسوق حسب العمر",
      icon: Baby,
      items: [
        { label: "حديثي الولادة (0-12 شهر)", to: "/category/$slug", params: { slug: "babysuits" } },
        { label: "أطفال (1-3 سنوات)", to: "/category/$slug", params: { slug: "outfit-sets" } },
        { label: "أطفال (4-7 سنوات)", to: "/category/$slug", params: { slug: "dresses" } },
        { label: "أطفال (8-12 سنة)", to: "/category/$slug", params: { slug: "tops" } },
      ],
    },
    {
      title: "التسوق حسب الفئة",
      icon: ShoppingBasket,
      items: [
        { label: "بنات", to: "/category/$slug", params: { slug: "dresses" } },
        { label: "أولاد", to: "/category/$slug", params: { slug: "outfit-sets" } },
        { label: "رضّع", to: "/category/$slug", params: { slug: "babysuits" } },
      ],
    },
    {
      title: "التصنيفات",
      icon: Crown,
      items: [
        { label: "الفساتين", to: "/category/$slug", params: { slug: "dresses" } },
        { label: "الأحذية", to: "/category/$slug", params: { slug: "shoes" } },
        { label: "الحقائب", to: "/category/$slug", params: { slug: "bags" } },
        { label: "ملابس السباحة", to: "/category/$slug", params: { slug: "swimwear" } },
        { label: "الأطقم", to: "/category/$slug", params: { slug: "outfit-sets" } },
      ],
    },
    {
      title: "مميّز",
      icon: Sparkles,
      items: [
        { label: "الأكثر مبيعاً", to: "/category/$slug", params: { slug: "best-sellers" } },
        { label: "الجديد", to: "/category/$slug", params: { slug: "new-in" } },
      ],
    },
    {
      title: "الهدايا",
      icon: Gift,
      items: [
        { label: "هدايا للرضّع", to: "/category/$slug", params: { slug: "gifts" } },
        { label: "هدايا فاخرة", to: "/category/$slug", params: { slug: "gifts" } },
      ],
    },
  ];

  return (
    <div className="px-2 pb-8">
      {groups.map((g) => {
        const Icon = g.icon;
        return (
          <section key={g.title} className="py-3">
            <div className="flex items-center gap-2 px-3 py-2 text-primary">
              <Icon className="h-4 w-4" />
              <h3 className="text-[13px] font-semibold tracking-wide">{g.title}</h3>
            </div>
            <ul className="mt-1">
              {g.items.map((it) => (
                <li key={it.label}>
                  <SheetClose asChild>
                    <Link
                      to={it.to as any}
                      params={it.params}
                      onClick={onNavigate}
                      className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-accent/60 active:bg-accent text-[14px] text-foreground"
                    >
                      <span>{it.label}</span>
                      <ArrowLeft className="h-4 w-4 text-primary/60" />
                    </Link>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
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
