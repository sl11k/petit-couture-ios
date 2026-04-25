import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart, Share2, ShoppingBag, Truck, RotateCcw } from "lucide-react";
import { getProductForCategory, categories } from "@/data/categories";
import { useLanguage } from "@/i18n/LanguageContext";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const cat = categories.find((c) => c.slug === params.slug);
    const title = cat ? `${cat.name} — Maisonnét` : "Maisonnét";
    const description = cat
      ? `Discover our ${cat.name.toLowerCase()} edit — luxury children's fashion curated by Maisonnét.`
      : "Luxury children's fashion boutique.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProductDetails,
});

function ProductDetails() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const product = getProductForCategory(slug);

  const [activeImg, setActiveImg] = useState(0);
  const [size, setSize] = useState(product.sizes[2]);
  const [color, setColor] = useState(product.colors[0].name);
  const [wished, setWished] = useState(false);

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
            aria-label="Back"
            onClick={() => router.history.back()}
            className="h-10 w-10 -ml-2 grid place-items-center rounded-full text-foreground/80 active:scale-95 transition"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {product.category.toUpperCase()}
          </span>
          <button
            aria-label="Share"
            className="h-10 w-10 -mr-2 grid place-items-center rounded-full text-foreground/70 active:scale-95 transition"
          >
            <Share2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </header>

        <main className="pb-[140px]">
          {/* Gallery */}
          <section className="px-5">
            <div className="relative overflow-hidden rounded-[28px] bg-pastel-peach aspect-[4/5]">
              <img
                src={product.images[activeImg]}
                alt={product.name}
                className="w-full h-full object-cover"
                width={1024}
                height={1280}
              />
              <button
                aria-label="Add to wishlist"
                onClick={() => setWished((v) => !v)}
                className="absolute top-4 right-4 h-11 w-11 rounded-full bg-background/90 backdrop-blur grid place-items-center border border-gold-soft text-gold-deep active:scale-95 transition"
              >
                <Heart
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.5}
                  fill={wished ? "currentColor" : "none"}
                />
              </button>
            </div>

            {/* Thumbnails */}
            <div className="mt-4 flex gap-3">
              {product.images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setActiveImg(i)}
                  className={[
                    "h-[68px] w-[56px] overflow-hidden rounded-[14px] border transition",
                    i === activeImg
                      ? "border-gold ring-1 ring-gold/40"
                      : "border-border opacity-80",
                  ].join(" ")}
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </section>

          {/* Title & price */}
          <section className="px-5 mt-7">
            <span className="text-[10.5px] tracking-luxury text-gold-deep">
              {product.brand.toUpperCase()}
            </span>
            <h1 className="font-serif text-[30px] leading-tight text-foreground mt-1.5">
              {product.name}
            </h1>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[20px] text-foreground tracking-tight">
                {product.price.toLocaleString()} {product.currency}
              </span>
              <span className="text-[12px] text-muted-foreground tracking-soft">
                or 4 × {Math.round(product.price / 4)} {product.currency} with Tamara
              </span>
            </div>
          </section>

          {/* Color */}
          <section className="px-5 mt-7">
            <div className="flex items-center justify-between">
              <span className="text-[12px] tracking-luxury text-muted-foreground">COLOR</span>
              <span className="text-[13px] text-foreground/80">{color}</span>
            </div>
            <div className="mt-3 flex gap-3">
              {product.colors.map((c) => {
                const active = c.name === color;
                return (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.name)}
                    aria-label={c.name}
                    className={[
                      "h-10 w-10 rounded-full grid place-items-center transition active:scale-95",
                      active ? "ring-1 ring-gold ring-offset-2 ring-offset-background" : "",
                    ].join(" ")}
                  >
                    <span
                      className="h-8 w-8 rounded-full border border-border"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Size */}
          <section className="px-5 mt-7">
            <div className="flex items-center justify-between">
              <span className="text-[12px] tracking-luxury text-muted-foreground">SIZE</span>
              <button className="text-[12px] text-gold-deep tracking-soft underline-offset-4 hover:underline">
                Size guide
              </button>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {product.sizes.map((s) => {
                const active = s === size;
                return (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={[
                      "h-12 rounded-full text-[13px] tracking-soft border transition active:scale-[0.97]",
                      active
                        ? "bg-gold-soft border-gold text-gold-deep font-medium"
                        : "bg-background border-border text-muted-foreground",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Description */}
          <section className="px-5 mt-8">
            <h2 className="font-serif text-[20px] text-foreground">Description</h2>
            <p className="mt-2 text-[14px] leading-[1.65] text-foreground/75">
              {product.description}
            </p>
            <ul className="mt-4 space-y-1.5">
              {product.details.map((d) => (
                <li
                  key={d}
                  className="text-[13.5px] text-foreground/70 flex items-start gap-2"
                >
                  <span className="mt-2 h-1 w-1 rounded-full bg-gold shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </section>

          {/* Shipping */}
          <section className="px-5 mt-7">
            <div className="rounded-[20px] border border-border bg-cream-warm/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Truck className="h-[18px] w-[18px] text-gold-deep" strokeWidth={1.5} />
                <span className="text-[13px] text-foreground/80">
                  Complimentary delivery on orders over 500 SAR
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center gap-3">
                <RotateCcw className="h-[18px] w-[18px] text-gold-deep" strokeWidth={1.5} />
                <span className="text-[13px] text-foreground/80">
                  Free returns within 14 days
                </span>
              </div>
            </div>
          </section>

          <p className="mt-10 text-center text-[11px] text-muted-foreground tracking-soft">
            Maison · Riyadh · Dubai · Paris
          </p>
          <div className="mt-4 text-center">
            <Link
              to="/"
              className="text-[12px] tracking-luxury text-gold-deep"
            >
              ← BACK TO BOUTIQUE
            </Link>
          </div>
        </main>

        {/* Sticky bottom CTA */}
        <div className="absolute bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border">
          <div className="px-5 pt-3 pb-6 flex items-center gap-3">
            <button
              aria-label="Add to wishlist"
              onClick={() => setWished((v) => !v)}
              className="h-[56px] w-[56px] rounded-full border border-gold-soft text-gold-deep grid place-items-center active:scale-95 transition"
            >
              <Heart
                className="h-[20px] w-[20px]"
                strokeWidth={1.5}
                fill={wished ? "currentColor" : "none"}
              />
            </button>
            <button className="flex-1 h-[56px] rounded-full bg-foreground text-background text-[14px] font-medium tracking-soft active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-soft">
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.6} />
              Add to Bag · {product.price.toLocaleString()} {product.currency}
            </button>
          </div>
          <div className="mx-auto mb-2 h-[5px] w-[120px] rounded-full bg-foreground/80" />
        </div>
      </div>
    </div>
  );
}
