import { useLanguage } from "@/i18n/LanguageContext";
import { HomeScreen } from "@/components/HomeScreen";
import type {
  Section,
  PageContent,
  HeroSection,
  TextBlockSection,
  ImageTextSection,
  FeatureGridSection,
  FaqSection,
  TestimonialsSection,
  CtaSection,
  GallerySection,
  StatsSection,
  ButtonContent,
} from "../schemas/pageSchema";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function pick(ar: boolean, valAr?: string, valEn?: string) {
  return (ar ? valAr : valEn) ?? valEn ?? valAr ?? "";
}

function sectionWrapStyle(s: Section): React.CSSProperties {
  const settings: any = s.settings ?? {};
  return {
    paddingTop: settings.spacing?.paddingTop,
    paddingBottom: settings.spacing?.paddingBottom,
    backgroundColor: settings.backgroundColor,
  };
}

function ButtonsRow({ buttons, ar }: { buttons?: ButtonContent[]; ar: boolean }) {
  if (!buttons?.length) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-6 justify-inherit">
      {buttons.map((b, i) => {
        const label = pick(ar, b.label_ar, b.label_en);
        if (!label) return null;
        const variant = b.variant ?? "primary";
        const cls = cn(
          "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium transition",
          variant === "primary" && "bg-foreground text-background hover:opacity-90",
          variant === "secondary" && "bg-muted text-foreground hover:bg-muted/80",
          variant === "ghost" && "text-foreground hover:bg-muted",
        );
        return (
          <a key={i} href={b.url || "#"} target={b.newTab ? "_blank" : undefined} rel={b.newTab ? "noreferrer" : undefined} className={cls}>
            {label}
          </a>
        );
      })}
    </div>
  );
}

function RenderHero({ s, ar }: { s: HeroSection; ar: boolean }) {
  const bgImage = s.settings?.backgroundImage || s.content.image?.url;
  const overlay = s.settings?.overlay ?? 0;
  const align = s.content.alignment ?? "center";
  return (
    <section className="relative overflow-hidden" style={sectionWrapStyle(s)}>
      {bgImage && (
        <div className="absolute inset-0 -z-10">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          {overlay > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />}
        </div>
      )}
      <div className={cn("mx-auto max-w-5xl px-4 py-20", `text-${align}`)}>
        {pick(ar, s.content.eyebrow_ar, s.content.eyebrow_en) && (
          <p className="text-xs uppercase tracking-widest opacity-70 mb-3">
            {pick(ar, s.content.eyebrow_ar, s.content.eyebrow_en)}
          </p>
        )}
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
          {pick(ar, s.content.title_ar, s.content.title_en)}
        </h1>
        {pick(ar, s.content.subtitle_ar, s.content.subtitle_en) && (
          <p className="mt-4 text-base md:text-lg opacity-80 max-w-2xl mx-auto">
            {pick(ar, s.content.subtitle_ar, s.content.subtitle_en)}
          </p>
        )}
        <div className={cn("flex flex-wrap gap-3 mt-6", align === "center" && "justify-center", align === "right" && "justify-end")}>
          <ButtonsRow buttons={s.content.buttons} ar={ar} />
        </div>
      </div>
    </section>
  );
}

function RenderTextBlock({ s, ar }: { s: TextBlockSection; ar: boolean }) {
  const align = s.content.alignment ?? "left";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-3xl px-4 py-12", `text-${align}`)}>
        {pick(ar, s.content.title_ar, s.content.title_en) && (
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">{pick(ar, s.content.title_ar, s.content.title_en)}</h2>
        )}
        <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
          {pick(ar, s.content.body_ar, s.content.body_en)}
        </div>
      </div>
    </section>
  );
}

function RenderImageText({ s, ar }: { s: ImageTextSection; ar: boolean }) {
  const side = s.content.imageSide ?? "left";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-2 gap-8 items-center", side === "right" && "md:[&>div:first-child]:order-2")}>
        <div>
          {s.content.image?.url && <img src={s.content.image.url} alt={s.content.image.alt || ""} className="w-full rounded-2xl object-cover" />}
        </div>
        <div>
          {pick(ar, s.content.title_ar, s.content.title_en) && (
            <h2 className="text-2xl md:text-3xl font-semibold mb-3">{pick(ar, s.content.title_ar, s.content.title_en)}</h2>
          )}
          <p className="whitespace-pre-wrap text-foreground/80 leading-relaxed">{pick(ar, s.content.body_ar, s.content.body_en)}</p>
          {s.content.button && <ButtonsRow buttons={[s.content.button]} ar={ar} />}
        </div>
      </div>
    </section>
  );
}

function RenderFeatureGrid({ s, ar }: { s: FeatureGridSection; ar: boolean }) {
  const cols = s.content.columns ?? 3;
  const colsCls = cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {pick(ar, s.content.title_ar, s.content.title_en) && (
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-2">{pick(ar, s.content.title_ar, s.content.title_en)}</h2>
        )}
        {pick(ar, s.content.subtitle_ar, s.content.subtitle_en) && (
          <p className="text-center opacity-70 mb-10">{pick(ar, s.content.subtitle_ar, s.content.subtitle_en)}</p>
        )}
        <div className={cn("grid gap-6", colsCls)}>
          {s.content.cards.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border p-6 bg-card">
              <h3 className="text-lg font-semibold mb-2">{pick(ar, c.title_ar, c.title_en)}</h3>
              <p className="text-sm opacity-75">{pick(ar, c.description_ar, c.description_en)}</p>
              {c.link && <a href={c.link} className="inline-block mt-3 text-sm underline">{ar ? "اعرف أكثر" : "Learn more"}</a>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RenderFaq({ s, ar }: { s: FaqSection; ar: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {pick(ar, s.content.title_ar, s.content.title_en) && (
          <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center">{pick(ar, s.content.title_ar, s.content.title_en)}</h2>
        )}
        <div className="space-y-2">
          {s.content.items.map((it) => {
            const open = openId === it.id;
            return (
              <div key={it.id} className="border border-border rounded-lg overflow-hidden">
                <button onClick={() => setOpenId(open ? null : it.id)} className="w-full flex items-center justify-between p-4 text-start font-medium hover:bg-muted/40">
                  <span>{pick(ar, it.question_ar, it.question_en)}</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                </button>
                {open && <div className="px-4 pb-4 text-sm opacity-80 whitespace-pre-wrap">{pick(ar, it.answer_ar, it.answer_en)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RenderTestimonials({ s, ar }: { s: TestimonialsSection; ar: boolean }) {
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {pick(ar, s.content.title_ar, s.content.title_en) && (
          <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-center">{pick(ar, s.content.title_ar, s.content.title_en)}</h2>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          {s.content.items.map((it) => (
            <figure key={it.id} className="rounded-2xl bg-card border border-border p-6">
              <blockquote className="text-foreground/90">"{pick(ar, it.quote_ar, it.quote_en)}"</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                {it.avatar && <img src={it.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <div>
                  <div className="font-medium text-sm">{it.name}</div>
                  <div className="text-xs opacity-60">{pick(ar, it.role_ar, it.role_en)}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function RenderCta({ s, ar }: { s: CtaSection; ar: boolean }) {
  const align = s.content.alignment ?? "center";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-4xl px-4 py-16", `text-${align}`)}>
        <h2 className="text-3xl md:text-4xl font-semibold">{pick(ar, s.content.title_ar, s.content.title_en)}</h2>
        {pick(ar, s.content.subtitle_ar, s.content.subtitle_en) && (
          <p className="mt-3 opacity-80">{pick(ar, s.content.subtitle_ar, s.content.subtitle_en)}</p>
        )}
        <div className={cn("flex flex-wrap gap-3 mt-6", align === "center" && "justify-center", align === "right" && "justify-end")}>
          <ButtonsRow buttons={s.content.buttons} ar={ar} />
        </div>
      </div>
    </section>
  );
}

function RenderGallery({ s, ar }: { s: GallerySection; ar: boolean }) {
  const cols = s.content.columns ?? 3;
  const colsCls = cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {pick(ar, s.content.title_ar, s.content.title_en) && (
          <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center">{pick(ar, s.content.title_ar, s.content.title_en)}</h2>
        )}
        <div className={cn("grid gap-3", colsCls)}>
          {s.content.images.map((im, i) => (
            <img key={i} src={im.url} alt={im.alt || ""} className="w-full aspect-square object-cover rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

function RenderStats({ s, ar }: { s: StatsSection; ar: boolean }) {
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-5xl px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {s.content.items.map((it) => (
          <div key={it.id}>
            <div className="text-3xl md:text-4xl font-semibold">{it.value}</div>
            <div className="text-sm opacity-70 mt-1">{pick(ar, it.label_ar, it.label_en)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RenderSection({ s, ar }: { s: Section; ar: boolean }) {
  switch (s.type) {
    case "legacy_home":
      return <HomeScreen />;
    case "hero":
      return <RenderHero s={s} ar={ar} />;
    case "text_block":
      return <RenderTextBlock s={s} ar={ar} />;
    case "image_text":
      return <RenderImageText s={s} ar={ar} />;
    case "feature_grid":
      return <RenderFeatureGrid s={s} ar={ar} />;
    case "faq":
      return <RenderFaq s={s} ar={ar} />;
    case "testimonials":
      return <RenderTestimonials s={s} ar={ar} />;
    case "cta":
      return <RenderCta s={s} ar={ar} />;
    case "gallery":
      return <RenderGallery s={s} ar={ar} />;
    case "stats":
      return <RenderStats s={s} ar={ar} />;
    default:
      return null;
  }
}

function isVisible(s: Section, device: "desktop" | "tablet" | "mobile"): boolean {
  const v = s.settings?.visibility;
  if (!v) return true;
  return v[device] !== false;
}

export type PageRendererProps = {
  content: PageContent;
  device?: "desktop" | "tablet" | "mobile";
};

export function PageRenderer({ content, device }: PageRendererProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const sections = content?.sections ?? [];
  return (
    <>
      {sections.map((s) => {
        if (device && !isVisible(s, device)) return null;
        return <RenderSection key={s.id} s={s} ar={ar} />;
      })}
    </>
  );
}
