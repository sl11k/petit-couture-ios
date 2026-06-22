import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ButtonConfig, ThemeConfig, ThemeSection } from "./types";

type Product = {
  slug: string;
  name_ar: string | null;
  name_en: string | null;
  price: number;
  currency: string;
  image_url: string | null;
};

const lines = (value: string) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

function ThemeButton({ value, primary }: { value: ButtonConfig; primary: string }) {
  const pad =
    value.size === "small" ? "8px 14px" : value.size === "large" ? "15px 28px" : "11px 20px";
  const style: CSSProperties = {
    display: value.fullWidth ? "flex" : "inline-flex",
    width: value.fullWidth ? "100%" : "auto",
    justifyContent: "center",
    padding: pad,
    borderRadius: value.borderRadius,
    color: value.textColor,
    background:
      value.variant === "solid"
        ? value.backgroundColor || primary
        : value.variant === "glass"
          ? "rgba(255,255,255,.24)"
          : "transparent",
    border:
      value.variant === "ghost" ? "none" : `${value.borderWidth}px solid ${value.borderColor}`,
    boxShadow: value.shadow ? "0 10px 30px rgba(30,30,30,.14)" : "none",
  };
  return (
    <a href={value.url || "/"} style={style} onClick={(e) => e.stopPropagation()}>
      {value.text}
    </a>
  );
}

function SectionHeader({
  section,
  hideDescription = false,
}: {
  section: ThemeSection;
  hideDescription?: boolean;
}) {
  const s = section.settings;
  return (
    <header style={{ textAlign: s.alignment }}>
      {s.badge && <span className="theme-badge">{s.badge}</span>}
      {s.subtitle && <small>{s.subtitle}</small>}
      <h2>{s.title}</h2>
      {!hideDescription && s.description && <p>{s.description}</p>}
    </header>
  );
}

function ProductCards({ section, products, ar }: { section: ThemeSection; products: Product[]; ar: boolean }) {
  const s = section.settings;
  const visible = products.slice(0, s.itemCount);
  return (
    <div
      className="theme-card-grid"
      style={{ gridTemplateColumns: `repeat(${s.columns},minmax(0,1fr))`, gap: s.gap }}
    >
      {visible.map((p) => (
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="theme-demo-card"
          key={p.slug}
        >
          <div className="theme-product-image">
            {p.image_url ? (
              <img src={p.image_url} alt={(ar ? p.name_ar : p.name_en) || p.name_en || p.name_ar || "Product"} />
            ) : (
              <span>✦</span>
            )}
          </div>
          <h3>{(ar ? p.name_ar : p.name_en) || p.name_en || p.name_ar || p.slug}</h3>
          {s.showPrice && (
            <p>
              {p.price} {p.currency || "SAR"}
            </p>
          )}
        </Link>
      ))}
      {!visible.length &&
        Array.from({ length: Math.min(s.itemCount, 8) }, (_, i) => (
          <article className="theme-demo-card" key={i}>
            <div className="theme-demo-image">✦</div>
            <h3>Product {i + 1}</h3>
            <p>— SAR</p>
          </article>
        ))}
    </div>
  );
}

function RenderSection({
  section,
  config,
  products,
  ar,
}: {
  section: ThemeSection;
  config: ThemeConfig;
  products: Product[];
  ar: boolean;
}) {
  const s = section.settings;
  const common: CSSProperties = {
    backgroundColor: s.backgroundColor,
    color: s.textColor,
    paddingTop: s.paddingY,
    paddingBottom: s.paddingY,
    minHeight: s.minHeight || undefined,
    maxWidth: s.layout === "boxed" ? s.maxWidth : undefined,
    marginInline: s.layout === "boxed" ? "auto" : undefined,
    borderRadius: s.layout === "boxed" ? s.borderRadius : undefined,
  };
  const hero = ["hero", "banner", "collection", "slideshow"].includes(section.type);

  if (section.type === "announcement" || section.type === "marquee")
    return (
      <section className={`theme-section theme-${section.type}`} style={common}>
        <div className={section.type === "marquee" ? "theme-marquee-track" : "theme-centered"}>
          {section.type === "marquee" ? `${s.title}  ✦  ${s.title}  ✦  ${s.title}` : s.title}
        </div>
      </section>
    );
  if (section.type === "spacer")
    return <div style={{ height: s.paddingY, background: s.backgroundColor }} aria-hidden />;
  if (section.type === "divider")
    return (
      <div
        className="theme-divider"
        style={{ background: s.backgroundColor, paddingBlock: s.paddingY / 2 }}
      >
        <hr style={{ borderColor: s.accentColor, maxWidth: s.maxWidth }} />
      </div>
    );
  if (hero)
    return (
      <section
        className={`theme-section theme-${section.type}`}
        style={{
          ...common,
          backgroundImage: s.imageUrl
            ? `linear-gradient(rgba(0,0,0,${s.overlayOpacity / 100}),rgba(0,0,0,${s.overlayOpacity / 100})),url(${s.imageUrl})`
            : undefined,
        }}
      >
        <div className="theme-hero-copy" style={{ textAlign: s.alignment }}>
          {s.badge && <span className="theme-badge">{s.badge}</span>}
          <small>{s.subtitle}</small>
          <h1>{s.title}</h1>
          <p>{s.description}</p>
          <ThemeButton value={s.button} primary={config.global.primaryColor} />
        </div>
      </section>
    );
  if (["product_grid", "featured_products"].includes(section.type))
    return (
      <section className="theme-section" style={common}>
        <SectionHeader section={section} />
        <ProductCards section={section} products={products} ar={ar} />
      </section>
    );
  if (section.type === "categories") {
    const cats = lines(s.itemsText).length
      ? lines(s.itemsText)
      : ["Dresses", "Newborn", "Gifts", "Shoes", "Bags", "New in"];
    return (
      <section className="theme-section" style={common}>
        <SectionHeader section={section} />
        <div
          className="theme-card-grid"
          style={{ gridTemplateColumns: `repeat(${s.columns},minmax(0,1fr))`, gap: s.gap }}
        >
          {cats.slice(0, s.itemCount).map((x) => (
            <article className="theme-demo-card" key={x}>
              <div className="theme-demo-image">{x}</div>
              <h3>{x}</h3>
            </article>
          ))}
        </div>
      </section>
    );
  }
  if (section.type === "image" || section.type === "image_text")
    return (
      <section
        className={`theme-section theme-image-section image-${s.imagePosition}`}
        style={common}
      >
        {s.imageUrl ? (
          <img src={s.imageUrl} alt={s.title} style={{ borderRadius: s.borderRadius }} />
        ) : (
          <div className="theme-image-empty">Add an image</div>
        )}
        <div style={{ textAlign: s.alignment }}>
          <small>{s.subtitle}</small>
          <h2>{s.title}</h2>
          <p>{s.description}</p>
          {section.type === "image_text" && (
            <ThemeButton value={s.button} primary={config.global.primaryColor} />
          )}
        </div>
      </section>
    );
  if (section.type === "video")
    return (
      <section className="theme-section" style={common}>
        <SectionHeader section={section} />
        {s.videoUrl ? (
          <video
            className="theme-video"
            src={s.videoUrl}
            controls
            autoPlay={s.autoplay}
            muted
            playsInline
          />
        ) : (
          <div className="theme-media-empty">Add a video URL</div>
        )}
      </section>
    );
  if (["gallery", "instagram"].includes(section.type)) {
    const images = lines(s.itemsText).filter((x) => /^https?:\/\//.test(x));
    return (
      <section className="theme-section" style={common}>
        <SectionHeader section={section} />
        <div
          className="theme-gallery"
          style={{ gridTemplateColumns: `repeat(${s.columns},minmax(0,1fr))`, gap: s.gap }}
        >
          {images.length
            ? images.map((url) => (
                <img src={url} alt="" key={url} style={{ borderRadius: s.borderRadius }} />
              ))
            : Array.from({ length: s.itemCount }, (_, i) => (
                <div className="theme-demo-image" key={i}>
                  Image {i + 1}
                </div>
              ))}
        </div>
      </section>
    );
  }
  if (["features", "stats", "testimonials", "reviews", "logo_cloud"].includes(section.type))
    return (
      <section className={`theme-section theme-${section.type}`} style={common}>
        <SectionHeader section={section} hideDescription />
        <div
          className="theme-rich-grid"
          style={{ gridTemplateColumns: `repeat(${s.columns},minmax(0,1fr))`, gap: s.gap }}
        >
          {lines(s.itemsText)
            .slice(0, s.itemCount)
            .map((item, i) => {
              const [a, b] = item.split(/\|| — /);
              return (
                <article key={`${item}-${i}`} style={{ borderRadius: s.borderRadius }}>
                  <strong>{a}</strong>
                  {b && <p>{b}</p>}
                </article>
              );
            })}
        </div>
      </section>
    );
  if (section.type === "faq")
    return (
      <section className="theme-section" style={common}>
        <SectionHeader section={section} />
        <div className="theme-faq">
          {lines(s.itemsText).map((item, i) => {
            const [q, a] = item.split("|");
            return (
              <details key={i}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            );
          })}
        </div>
      </section>
    );
  if (section.type === "newsletter")
    return (
      <section className="theme-section theme-newsletter" style={common}>
        <SectionHeader section={section} />
        <form onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="Email address" />
          <button style={{ background: s.accentColor }}>Join</button>
        </form>
      </section>
    );
  if (section.type === "countdown")
    return (
      <section className="theme-section theme-countdown" style={common}>
        <SectionHeader section={section} />
        <div className="theme-countdown-box">
          <b>00</b>
          <span>Days</span>
          <b>00</b>
          <span>Hours</span>
          <b>00</b>
          <span>Minutes</span>
        </div>
      </section>
    );
  return (
    <section className={`theme-section theme-${section.type}`} style={common}>
      <div className="theme-centered" style={{ textAlign: s.alignment }}>
        <small>{s.subtitle}</small>
        <h2>{s.title}</h2>
        <p>{s.description}</p>
        {section.type === "cta" && (
          <ThemeButton value={s.button} primary={config.global.primaryColor} />
        )}
      </div>
    </section>
  );
}

export function ThemeRenderer({
  config,
  preview = false,
  selectedSectionId,
  onSelectSection,
}: {
  config: ThemeConfig;
  preview?: boolean;
  selectedSectionId?: string | null;
  onSelectSection?: (id: string) => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    let active = true;
    supabase
      .from("products")
      .select("slug,name_ar,name_en,price,currency,image_url")
      .eq("is_active", true)
      .limit(12)
      .then(({ data }) => {
        if (active) setProducts((data || []) as Product[]);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div
      className={`theme-storefront ${preview ? "theme-preview" : ""}`}
      style={{ background: config.global.backgroundColor, color: config.global.textColor }}
    >
      {config.sections
        .filter((s) => s.enabled)
        .map((s) =>
          onSelectSection ? (
            <div
              key={s.id}
              className={`theme-editable-section ${selectedSectionId === s.id ? "selected" : ""}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectSection(s.id);
              }}
            >
              <RenderSection section={s} config={config} products={products} ar={ar} />
            </div>
          ) : (
            <RenderSection key={s.id} section={s} config={config} products={products} ar={ar} />
          ),
        )}
      {config.sections.every((s) => !s.enabled) && (
        <div className="theme-empty">No visible sections. Add one from the library.</div>
      )}
    </div>
  );
}
