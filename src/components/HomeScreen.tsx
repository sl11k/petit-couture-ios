import { useState } from "react";
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
import { categories } from "@/data/categories";

type AgeKey = "baby" | "girl" | "boy";
type NavKey = "menu" | "home" | "account" | "search" | "bag";

const announcements = [
  "Buy Now, Pay Later with Tamara",
  "Shop and pay in Saudi Riyal (SAR)",
  "Add your Saudi National Address for faster delivery",
];

export function HomeScreen() {
  const [age, setAge] = useState<AgeKey>("girl");
  const [nav, setNav] = useState<NavKey>("home");
  const [annIdx, setAnnIdx] = useState(0);

  // Rotate announcement every 4s
  useState(() => {
    const id = setInterval(() => setAnnIdx((i) => (i + 1) % announcements.length), 4000);
    return () => clearInterval(id);
  });

  return (
    /* iPhone-style frame, on a soft canvas */
    <div className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
        {/* iOS status bar (visual) */}
        <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold text-foreground tracking-tight">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-[2px] border border-foreground/80" />
            <span className="text-[11px]">100%</span>
          </div>
        </div>

        {/* Header */}
        <header className="px-6 pt-2 pb-4 flex items-center justify-between">
          <button
            aria-label="Menu"
            className="h-10 w-10 -ml-2 grid place-items-center text-foreground/70 active:scale-95 transition"
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.4} />
          </button>

          {/* Brand mark */}
          <div className="flex flex-col items-center select-none">
            <span className="font-serif text-[26px] leading-none text-foreground tracking-[0.04em]">
              Mais<span className="text-gold">on</span>nét
            </span>
            <span className="mt-1 text-[9px] tracking-luxury text-muted-foreground">
              ENFANTS · EST. 2018
            </span>
          </div>

          <button
            aria-label="Wishlist"
            className="h-10 w-10 -mr-2 grid place-items-center rounded-full border border-gold-soft text-gold-deep active:scale-95 transition"
          >
            <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </header>

        {/* Announcement bar */}
        <div className="relative bg-cream-warm">
          <div className="h-[52px] flex items-center justify-center px-6 text-[13.5px] text-foreground/80 tracking-soft">
            <span key={annIdx} className="animate-in fade-in duration-500 text-center">
              {announcements[annIdx]}
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
                alt="Spring campaign — luxury kids editorial"
                className="w-full h-[440px] object-cover"
                width={1280}
                height={1280}
              />
              {/* soft overlay for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-transparent" />

              <div className="absolute inset-0 flex flex-col items-center justify-end pb-7 px-6 text-center">
                <span className="text-[10.5px] tracking-luxury text-foreground/75">
                  FOR A LIMITED TIME ONLY
                </span>
                <h1 className="mt-2 font-serif text-[64px] leading-[0.95] text-foreground">
                  15% Off
                </h1>
                <p className="mt-1 font-serif italic text-[26px] text-foreground/85">
                  Everything
                </p>
                <p className="mt-2 text-[10.5px] text-foreground/60 tracking-soft max-w-[240px]">
                  Selected new-season pieces. Auto-applied at checkout.
                </p>
                <button
                  className="mt-5 h-[52px] px-10 rounded-full bg-background text-foreground text-[14px] font-medium tracking-soft shadow-soft active:scale-[0.97] transition"
                >
                  Shop Now
                </button>
              </div>
            </div>
          </section>

          {/* Age chips */}
          <section className="px-5 mt-7">
            <div className="grid grid-cols-3 gap-3">
              {(["baby", "girl", "boy"] as AgeKey[]).map((k) => {
                const active = age === k;
                const label = k === "baby" ? "Baby" : k === "girl" ? "Girl" : "Boy";
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
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Most Popular */}
          <section className="mt-12 px-5">
            <div className="text-center">
              <span className="text-[10.5px] tracking-luxury text-gold-deep">
                — CURATED EDIT —
              </span>
              <h2 className="font-serif text-[34px] leading-tight text-foreground mt-1.5">
                Most Popular
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-7">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="group flex flex-col items-center text-left active:scale-[0.99] transition"
                >
                  <div className="w-full overflow-hidden rounded-[22px] bg-cream-warm aspect-[1.35/1]">
                    <img
                      src={c.img}
                      alt={c.name}
                      loading="lazy"
                      width={768}
                      height={576}
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.04] group-active:opacity-90"
                    />
                  </div>
                  <span className="mt-3 text-[15px] text-foreground/85 font-medium tracking-tight">
                    {c.name}
                  </span>
                </Link>
              ))}
            </div>

            {/* Shop all */}
            <div className="mt-10 flex justify-center">
              <button className="h-[52px] px-10 rounded-full bg-background border border-border text-gold-deep text-[12px] tracking-luxury font-medium active:scale-[0.97] transition">
                SHOP ALL
              </button>
            </div>

            {/* Editorial footer line */}
            <p className="mt-10 text-center text-[11px] text-muted-foreground tracking-soft">
              Maison · Riyadh · Dubai · Paris
            </p>
          </section>
        </main>

        {/* Floating chat */}
        <button
          aria-label="Customer support"
          className="absolute right-5 bottom-[108px] h-[60px] w-[60px] rounded-full bg-gold text-background grid place-items-center shadow-gold active:scale-95 transition"
        >
          <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.6} />
        </button>

        {/* Bottom nav */}
        <nav className="absolute bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border">
          <div className="px-3 pt-2 pb-6">
            <div className="grid grid-cols-5">
              {(
                [
                  { k: "menu", label: "Menu", Icon: Menu },
                  { k: "home", label: "Home", Icon: HomeIcon },
                  { k: "account", label: "Account", Icon: User },
                  { k: "search", label: "Search", Icon: Search },
                  { k: "bag", label: "Bag", Icon: ShoppingBag },
                ] as { k: NavKey; label: string; Icon: typeof Menu }[]
              ).map(({ k, label, Icon }) => {
                const active = nav === k;
                return (
                  <button
                    key={k}
                    onClick={() => setNav(k)}
                    className="relative h-[58px] flex flex-col items-center justify-center gap-1 active:scale-95 transition"
                  >
                    {active && (
                      <span className="absolute inset-x-3 inset-y-1 rounded-full bg-cream-warm" />
                    )}
                    <Icon
                      className={[
                        "relative h-[20px] w-[20px]",
                        active ? "text-gold-deep" : "text-gold",
                      ].join(" ")}
                      strokeWidth={active ? 1.8 : 1.5}
                    />
                    <span
                      className={[
                        "relative text-[11px] tracking-soft",
                        active ? "text-gold-deep font-medium" : "text-gold-deep/80",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* iOS home indicator */}
            <div className="mx-auto mt-1 h-[5px] w-[120px] rounded-full bg-foreground/80" />
          </div>
        </nav>
      </div>
    </div>
  );
}
