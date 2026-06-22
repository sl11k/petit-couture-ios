import type { CSSProperties } from "react";
import type { ButtonConfig, ThemeConfig, ThemeSection } from "./types";

const placeholders = [
  "Cloud romper",
  "Celebration dress",
  "Little leather shoes",
  "Soft knit set",
  "Keepsake gift",
  "Sunday cardigan",
  "Bow handbag",
  "Classic coat",
];
function ThemeButton({ value, primary }: { value: ButtonConfig; primary: string }) {
  const pad =
    value.size === "small" ? "8px 14px" : value.size === "large" ? "15px 28px" : "11px 20px";
  const bg =
    value.variant === "solid"
      ? value.backgroundColor || primary
      : value.variant === "glass"
        ? "rgba(255,255,255,.28)"
        : "transparent";
  const style: CSSProperties = {
    display: value.fullWidth ? "flex" : "inline-flex",
    width: value.fullWidth ? "100%" : "auto",
    justifyContent: "center",
    padding: pad,
    borderRadius: value.borderRadius,
    color: value.textColor,
    background: bg,
    border:
      value.variant === "ghost" ? "none" : `${value.borderWidth}px solid ${value.borderColor}`,
    boxShadow: value.shadow ? "0 8px 24px rgba(30,30,30,.14)" : "none",
  };
  return (
    <a href={value.url || "/"} style={style} onClick={(e) => e.stopPropagation()}>
      {value.text}
    </a>
  );
}

function Cards({
  section,
  config,
  categories = false,
}: {
  section: ThemeSection;
  config: ThemeConfig;
  categories?: boolean;
}) {
  const count = Math.min(section.settings.itemCount, 8);
  return (
    <div
      className="theme-card-grid"
      style={{ gridTemplateColumns: `repeat(${section.settings.columns}, minmax(0,1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <article className="theme-demo-card" key={i}>
          <div className="theme-demo-image">
            {categories
              ? ["Dresses", "Newborn", "Gifts", "Shoes", "Bags", "New in", "Sets", "Sale"][i]
              : "✦"}
          </div>
          <h3>
            {categories
              ? ["Dresses", "Newborn", "Gifts", "Shoes", "Bags", "New in", "Sets", "Sale"][i]
              : placeholders[i]}
          </h3>
          {!categories && <p>{`${85 + i * 20} SAR`}</p>}
        </article>
      ))}
    </div>
  );
}

function RenderSection({ section, config }: { section: ThemeSection; config: ThemeConfig }) {
  const s = section.settings;
  const common: CSSProperties = { backgroundColor: s.backgroundColor, color: s.textColor };
  if (section.type === "hero" || section.type === "banner" || section.type === "collection")
    return (
      <section
        className={`theme-section theme-${section.type}`}
        style={{
          ...common,
          backgroundImage: s.imageUrl
            ? `linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),url(${s.imageUrl})`
            : undefined,
        }}
      >
        <div className="theme-hero-copy">
          <small>{s.subtitle}</small>
          <h1>{s.title}</h1>
          <p>{s.description}</p>
          <ThemeButton value={s.button} primary={config.global.primaryColor} />
        </div>
      </section>
    );
  if (section.type === "product_grid" || section.type === "featured_products")
    return (
      <section className="theme-section" style={common}>
        <header>
          <small>{s.subtitle}</small>
          <h2>{s.title}</h2>
          <p>{s.description}</p>
        </header>
        <Cards section={section} config={config} />
      </section>
    );
  if (section.type === "categories")
    return (
      <section className="theme-section" style={common}>
        <header>
          <small>{s.subtitle}</small>
          <h2>{s.title}</h2>
        </header>
        <Cards section={section} config={config} categories />
      </section>
    );
  if (section.type === "image")
    return (
      <section className="theme-section theme-image-section" style={common}>
        {s.imageUrl ? (
          <img src={s.imageUrl} alt={s.title} />
        ) : (
          <div className="theme-image-empty">Add an image URL</div>
        )}
        <div>
          <small>{s.subtitle}</small>
          <h2>{s.title}</h2>
          <p>{s.description}</p>
        </div>
      </section>
    );
  return (
    <section className={`theme-section theme-${section.type}`} style={common}>
      <div className="theme-centered">
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
}: {
  config: ThemeConfig;
  preview?: boolean;
}) {
  return (
    <div
      className={`theme-storefront ${preview ? "theme-preview" : ""}`}
      style={{ background: config.global.backgroundColor, color: config.global.textColor }}
    >
      {config.sections
        .filter((s) => s.enabled)
        .map((s) => (
          <RenderSection key={s.id} section={s} config={config} />
        ))}
      {config.sections.every((s) => !s.enabled) && (
        <div className="theme-empty">No visible sections. Enable or add one in the editor.</div>
      )}
    </div>
  );
}
