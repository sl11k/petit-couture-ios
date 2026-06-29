import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
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
  BeforeAfterSection,
  VideoSection,
  CountdownSection,
  NewsletterSection,
  StatsSection,
  ReviewsSection,
  ButtonContent,
  ButtonSection,
  BannerSection,
  ProductGridSection,
  DividerSection,
  SpacerSection,
  HtmlSection,
  ImageContent,
  ImageAspectRatio,
  TextStyleSettings,
} from "../schemas/pageSchema";
import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryProductIds } from "@/lib/productCategories";

function pick(ar: boolean, valAr?: string, valEn?: string) {
  return (ar ? valAr : valEn) ?? valEn ?? valAr ?? "";
}

function styleFontFamily(font?: TextStyleSettings["fontFamily"]): string | undefined {
  return font === "serif"
    ? "Cormorant Garamond, Georgia, serif"
    : font === "sans"
      ? "Inter, ui-sans-serif, system-ui, sans-serif"
      : font === "mono"
        ? "ui-monospace, SFMono-Regular, Menlo, monospace"
        : font === "damas"
          ? '"TS Damas Slab", "Damas", "Noto Naskh Arabic", serif'
          : font === "tek-arabic"
            ? '"TEK Arabic", "Tajawal", "IBM Plex Sans Arabic", sans-serif'
            : undefined;
}

function textStyle(style?: TextStyleSettings): React.CSSProperties | undefined {
  if (!style) return undefined;
  return {
    color: style.color,
    opacity: style.opacity,
    fontSize: style.fontSize,
    fontFamily: styleFontFamily(style.fontFamily),
    fontWeight: style.fontWeight,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    marginTop: style.marginTop,
  };
}

function verticalClass(position?: "top" | "center" | "bottom") {
  return position === "top"
    ? "justify-start"
    : position === "bottom"
      ? "justify-end"
      : "justify-center";
}

function verticalItemsClass(position?: "top" | "center" | "bottom") {
  return position === "top" ? "items-start" : position === "bottom" ? "items-end" : "items-center";
}

function captionPlacementClasses(style?: TextStyleSettings) {
  if (!style?.overlayMode) return "mt-3";
  const pos = style.verticalPosition ?? "bottom";
  return cn(
    "absolute inset-x-0 z-10 flex px-4 py-3 text-white",
    verticalItemsClass(pos),
    pos === "top" && "top-0 bottom-auto",
    pos === "center" && "top-0 bottom-0",
    pos === "bottom" && "bottom-0 top-auto",
  );
}

function aspectClass(ratio?: ImageAspectRatio): string {
  return ratio === "1/1"
    ? "aspect-square"
    : ratio === "3/4"
      ? "aspect-[3/4]"
      : ratio === "16/9"
        ? "aspect-video"
        : "aspect-[4/3]";
}

function mobileGridStyle(columns?: 1 | 2 | 3): React.CSSProperties {
  return { gridTemplateColumns: `repeat(${columns ?? 1}, minmax(0, 1fr))` };
}

// ----- Inline edit context -----
type EditCtx = {
  updateSection: (
    id: string,
    updater: (s: Section) => Section,
    opts?: { label?: string; key?: string },
  ) => void;
  ar: boolean;
};
const EditContext = createContext<EditCtx | null>(null);

// Tiny HTML sanitizer: keeps only inline formatting tags + safe links.
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "A", "SPAN"]);
function sanitizeInlineHTML(html: string): string {
  if (typeof window === "undefined") return html;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          // unwrap: replace with its text/children
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          node.removeChild(el);
          continue;
        }
        // Strip all attributes except href/target on <a>
        for (const a of Array.from(el.attributes)) {
          if (el.tagName === "A" && (a.name === "href" || a.name === "target" || a.name === "rel"))
            continue;
          el.removeAttribute(a.name);
        }
        if (el.tagName === "A") {
          const href = el.getAttribute("href") || "";
          if (/^\s*javascript:/i.test(href)) el.removeAttribute("href");
          if (el.getAttribute("target") === "_blank") el.setAttribute("rel", "noopener noreferrer");
        }
        walk(el);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    }
  };
  walk(wrap);
  return wrap.innerHTML;
}

function isHTMLish(s: string): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(s);
}

function EditableText({
  value,
  onCommit,
  as: Tag = "span",
  className,
  style,
  multiline,
  placeholder,
  coalesceKey,
  label,
}: {
  value: string;
  onCommit: (next: string) => void;
  as?: any;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
  coalesceKey?: string;
  label?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Sync external value into DOM without disrupting caret while typing
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return; // don't overwrite while focused
    if (el.innerHTML !== value) el.innerHTML = value ?? "";
  }, [value]);
  const ctx = useContext(EditContext);
  void label;
  void coalesceKey;
  void ctx;

  const exec = (cmd: string, arg?: string) => {
    // contentEditable execCommand still works for B/I/U/createLink/unlink.
    document.execCommand(cmd, false, arg);
  };

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder ?? ""}
      dir="auto"
      style={style}
      className={cn(
        className,
        "outline-none focus:outline-dashed focus:outline-2 focus:outline-primary/60 focus:outline-offset-2 rounded transition cursor-text",
        "hover:bg-primary/5 hover:outline hover:outline-1 hover:outline-primary/30 hover:outline-offset-2",
        "[&_a]:underline [&_a]:text-primary",
        !value && "before:content-[attr(data-placeholder)] before:opacity-40 empty:before:inline",
      )}
      onClick={(e: any) => e.stopPropagation()}
      onMouseDown={(e: any) => e.stopPropagation()}
      onPaste={(e: any) => {
        e.preventDefault();
        const html = (e.clipboardData || (window as any).clipboardData).getData("text/html");
        const text = (e.clipboardData || (window as any).clipboardData).getData("text/plain");
        if (html) {
          const clean = sanitizeInlineHTML(html);
          document.execCommand("insertHTML", false, clean);
        } else {
          document.execCommand("insertText", false, text);
        }
      }}
      onKeyDown={(e: any) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey) {
          const k = e.key.toLowerCase();
          if (k === "b") {
            e.preventDefault();
            exec("bold");
            return;
          }
          if (k === "i") {
            e.preventDefault();
            exec("italic");
            return;
          }
          if (k === "u") {
            e.preventDefault();
            exec("underline");
            return;
          }
          if (k === "k") {
            e.preventDefault();
            const sel = window.getSelection();
            const selected = sel?.toString();
            if (!selected) return;
            const existing = (sel?.anchorNode?.parentElement as HTMLAnchorElement)?.href || "";
            const url = window.prompt("الرابط (اتركه فارغاً لإزالة)", existing);
            if (url === null) return;
            if (url === "") exec("unlink");
            else exec("createLink", url);
            return;
          }
          if (e.shiftKey && k === "x") {
            e.preventDefault();
            exec("removeFormat");
            return;
          }
        }
        if (e.key === "Enter" && !e.shiftKey && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") {
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onBlur={(e: any) => {
        const raw = (e.currentTarget as HTMLElement).innerHTML;
        const clean = sanitizeInlineHTML(raw);
        // Normalize: collapse to plain text if no formatting is present
        const next = isHTMLish(clean) ? clean : (e.currentTarget as HTMLElement).innerText;
        if (next !== value) onCommit(next);
      }}
    />
  );
}

/** Inline-editable text bound to a top-level localized field on s.content */
function EditT({
  s,
  field,
  as,
  className,
  multiline,
  placeholder,
}: {
  s: Section;
  field: string; // base name; suffixed with _ar/_en based on lang
  as?: any;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  const full = `${field}_${ar ? "ar" : "en"}`;
  const value = ((s as any).content?.[full] ?? "") as string;
  const Tag = as ?? "span";
  if (!ctx) {
    if (!value) return null;
    if (isHTMLish(value))
      return (
        <Tag
          className={cn(className, "[&_a]:underline [&_a]:text-primary")}
          dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(value) }}
        />
      );
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <EditableText
      as={Tag}
      className={className}
      value={value}
      multiline={multiline}
      placeholder={placeholder ?? full}
      coalesceKey={`inline:${s.id}:${full}`}
      onCommit={(next) =>
        ctx.updateSection(
          s.id,
          (sec) => ({ ...sec, content: { ...(sec as any).content, [full]: next } }) as Section,
          { label: `تعديل ${field}`, key: `inline:${s.id}:${full}` },
        )
      }
    />
  );
}

/** Editable text on an arbitrary path with a custom commit fn that receives the LIVE section. */
function EditCustom({
  s,
  value,
  commit,
  as,
  className,
  style,
  multiline,
  placeholder,
  ckey,
}: {
  s: Section;
  value: string;
  commit: (next: string, cur: Section) => Section;
  as?: any;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
  ckey: string;
}) {
  const ctx = useContext(EditContext);
  const Tag = as ?? "span";
  if (!ctx) {
    if (!value) return null;
    if (isHTMLish(value))
      return (
        <Tag
          className={cn(className, "[&_a]:underline [&_a]:text-primary")}
          style={style}
          dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(value) }}
        />
      );
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  return (
    <EditableText
      as={Tag}
      className={className}
      style={style}
      value={value}
      multiline={multiline}
      placeholder={placeholder}
      coalesceKey={ckey}
      onCommit={(next) =>
        ctx.updateSection(s.id, (cur) => commit(next, cur), { label: "تعديل نص", key: ckey })
      }
    />
  );
}

function sectionWrapStyle(s: Section): React.CSSProperties {
  const settings: any = s.settings ?? {};
  const typography = settings.typography ?? {};
  const fontFamily =
    typography.fontFamily === "serif"
      ? "Cormorant Garamond, Georgia, serif"
      : typography.fontFamily === "sans"
        ? "Inter, ui-sans-serif, system-ui, sans-serif"
        : typography.fontFamily === "mono"
          ? "ui-monospace, SFMono-Regular, Menlo, monospace"
          : typography.fontFamily === "damas"
            ? '"TS Damas Slab", "Damas", "Noto Naskh Arabic", serif'
            : typography.fontFamily === "tek-arabic"
              ? '"TEK Arabic", "Tajawal", "IBM Plex Sans Arabic", sans-serif'
              : undefined;
  const bgUrl: string | undefined =
    typeof settings.backgroundImage === "string"
      ? settings.backgroundImage
      : settings.backgroundImage?.url;
  return {
    paddingTop: settings.spacing?.paddingTop,
    paddingBottom: settings.spacing?.paddingBottom,
    backgroundColor: settings.backgroundColor,
    backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
    backgroundSize: bgUrl ? "cover" : undefined,
    backgroundPosition: bgUrl ? "center" : undefined,
    backgroundRepeat: bgUrl ? "no-repeat" : undefined,
    color: typography.color,
    fontSize: typography.fontSize,
    fontFamily,
    fontWeight: typography.fontWeight,
    textAlign: typography.textAlign,
    lineHeight: typography.lineHeight,
    letterSpacing: typography.letterSpacing,
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
          <a
            key={i}
            href={b.url || "#"}
            target={b.newTab ? "_blank" : undefined}
            rel={b.newTab ? "noreferrer" : undefined}
            className={cls}
            data-no-translate
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}

function RenderHero({ s }: { s: HeroSection }) {
  const bgImage = s.settings?.backgroundImage || s.content.image?.url;
  const overlay = s.settings?.overlay ?? 0;
  const align = s.content.alignment ?? "center";
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  return (
    <section className="relative overflow-hidden" style={sectionWrapStyle(s)}>
      {bgImage && (
        <div className="absolute inset-0 -z-10">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          {overlay > 0 && (
            <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
          )}
        </div>
      )}
      <div className={cn("mx-auto max-w-5xl px-4 py-20", `text-${align}`)}>
        <EditT
          s={s}
          field="eyebrow"
          as="p"
          className="text-xs uppercase tracking-widest opacity-70 mb-3"
          placeholder="Eyebrow"
        />
        <EditT
          s={s}
          field="title"
          as="h1"
          className="text-4xl md:text-6xl font-semibold tracking-tight"
          placeholder="العنوان"
        />
        <EditT
          s={s}
          field="subtitle"
          as="p"
          multiline
          className="mt-4 text-base md:text-lg opacity-80 max-w-2xl mx-auto"
          placeholder="العنوان الفرعي"
        />
        <div
          className={cn(
            "flex flex-wrap gap-3 mt-6",
            align === "center" && "justify-center",
            align === "right" && "justify-end",
          )}
        >
          <ButtonsRow buttons={s.content.buttons} ar={ar} />
        </div>
      </div>
    </section>
  );
}

function RenderTextBlock({ s }: { s: TextBlockSection }) {
  const align = (s.content as any).alignment ?? "left";
  const bgImage = s.content.image?.url;
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  if (s.content.layout === "split")
    return (
      <section style={sectionWrapStyle(s)}>
        <div className="mx-auto grid min-h-[560px] max-w-7xl items-stretch md:grid-cols-2">
          <div className={cn("flex flex-col justify-center px-6 py-16 md:px-12", `text-${align}`)}>
            <EditT
              s={s}
              field="eyebrow"
              as="p"
              className="mb-3 text-xs uppercase tracking-widest opacity-70"
              placeholder="Eyebrow"
            />
            <EditT
              s={s}
              field="title"
              as="h1"
              className="text-4xl font-semibold tracking-tight md:text-6xl"
              placeholder="العنوان"
            />
            <EditT
              s={s}
              field="subtitle"
              as="p"
              multiline
              className="mt-4 text-lg opacity-80"
              placeholder="العنوان الفرعي"
            />
            <div
              className={cn(
                "mt-6 flex flex-wrap gap-3",
                align === "center" && "justify-center",
                align === "right" && "justify-end",
              )}
            >
              <ButtonsRow buttons={s.content.buttons} ar={ar} />
            </div>
          </div>
          <div className="min-h-[360px] bg-muted">
            {bgImage ? (
              <img
                src={bgImage}
                alt={s.content.image?.alt || ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground">
                {ar ? "أضف صورة" : "Add image"}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-3xl px-4 py-12", `text-${align}`)}>
        <EditT
          s={s}
          field="title"
          as="h2"
          className="text-2xl md:text-3xl font-semibold mb-4"
          placeholder="العنوان"
        />
        <EditT
          s={s}
          field="body"
          as="div"
          multiline
          className="whitespace-pre-wrap text-foreground/90 leading-relaxed"
          placeholder="اكتب النص هنا…"
        />
        <ButtonsRow buttons={s.content.buttons} ar={ar} />
      </div>
    </section>
  );
}

function RenderImageText({ s }: { s: ImageTextSection }) {
  const side = s.content.imageSide ?? "left";
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  return (
    <section style={sectionWrapStyle(s)}>
      <div
        className={cn(
          "mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-2 gap-8 items-center",
          side === "right" && "md:[&>div:first-child]:order-2",
        )}
      >
        <div>
          {s.content.image?.url &&
            (s.content.image.link ? (
              <a
                href={s.content.image.link}
                target={s.content.image.newTab ? "_blank" : undefined}
                rel={s.content.image.newTab ? "noreferrer" : undefined}
              >
                <img
                  src={s.content.image.url}
                  alt={s.content.image.alt || ""}
                  className="w-full rounded-2xl object-cover"
                />
              </a>
            ) : (
              <img
                src={s.content.image.url}
                alt={s.content.image.alt || ""}
                className="w-full rounded-2xl object-cover"
              />
            ))}
          {pick(ar, s.content.image?.caption_ar, s.content.image?.caption_en) && (
            <p className="mt-2 text-xs opacity-60">
              {pick(ar, s.content.image?.caption_ar, s.content.image?.caption_en)}
            </p>
          )}
        </div>
        <div>
          <EditT
            s={s}
            field="title"
            as="h2"
            className="text-2xl md:text-3xl font-semibold mb-3"
            placeholder="العنوان"
          />
          <EditT
            s={s}
            field="body"
            as="p"
            multiline
            className="whitespace-pre-wrap text-foreground/80 leading-relaxed"
            placeholder="النص"
          />
          {s.content.button && <ButtonsRow buttons={[s.content.button]} ar={ar} />}
        </div>
      </div>
    </section>
  );
}

function RenderFeatureGrid({ s }: { s: FeatureGridSection }) {
  const cols = s.content.columns ?? 3;
  const mobileCols = s.content.mobileColumns ?? 1;
  const colsCls =
    cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EditT
          s={s}
          field="title"
          as="h2"
          className="text-2xl md:text-3xl font-semibold text-center mb-2"
          placeholder="عنوان القسم"
        />
        <EditT
          s={s}
          field="subtitle"
          as="p"
          className="text-center opacity-70 mb-10"
          placeholder="وصف قصير"
        />
        <div
          className={cn("grid gap-6", colsCls)}
          data-mobile-columns={mobileCols}
          style={mobileGridStyle(mobileCols)}
        >
          {s.content.cards.map((c) => {
            const titleField = ar ? "title_ar" : "title_en";
            const descField = ar ? "description_ar" : "description_en";
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-border p-4 sm:p-6 bg-card min-w-0"
              >
                {c.icon && <div className="mb-3 text-3xl">{c.icon}</div>}
                {c.image?.url && (
                  <div
                    className={cn(
                      "relative mb-4 overflow-hidden rounded-xl",
                      aspectClass(s.content.imageAspectRatio),
                    )}
                  >
                    {c.image.link ? (
                      <a
                        href={c.image.link}
                        target={c.image.newTab ? "_blank" : undefined}
                        rel={c.image.newTab ? "noreferrer" : undefined}
                        className="block h-full w-full"
                      >
                        <img
                          src={c.image.url}
                          alt={c.image.alt || ""}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <img
                        src={c.image.url}
                        alt={c.image.alt || ""}
                        className="h-full w-full object-cover"
                      />
                    )}
                    {pick(ar, c.image?.caption_ar, c.image?.caption_en) && (
                      <p
                        className={cn(
                          "text-xs break-words",
                          s.content.captionStyle?.overlayMode
                            ? captionPlacementClasses(s.content.captionStyle)
                            : "mt-2 opacity-60",
                        )}
                        style={textStyle(s.content.captionStyle)}
                      >
                        {pick(ar, c.image?.caption_ar, c.image?.caption_en)}
                      </p>
                    )}
                  </div>
                )}
                <EditCustom
                  s={s}
                  as="h3"
                  className="text-lg font-semibold mb-2 break-words"
                  style={textStyle(s.content.titleStyle)}
                  placeholder="عنوان البطاقة"
                  value={(c as any)[titleField] ?? ""}
                  ckey={`card:${s.id}:${c.id}:${titleField}`}
                  commit={(next, cur: any) => ({
                    ...cur,
                    content: {
                      ...cur.content,
                      cards: cur.content.cards.map((x: any) =>
                        x.id === c.id ? ({ ...x, [titleField]: next } as any) : x,
                      ),
                    },
                  })}
                />
                <EditCustom
                  s={s}
                  as="p"
                  className="text-sm opacity-75 break-words"
                  style={textStyle(s.content.descriptionStyle)}
                  multiline
                  placeholder="وصف البطاقة"
                  value={(c as any)[descField] ?? ""}
                  ckey={`card:${s.id}:${c.id}:${descField}`}
                  commit={(next, cur: any) => ({
                    ...cur,
                    content: {
                      ...cur.content,
                      cards: cur.content.cards.map((x: any) =>
                        x.id === c.id ? ({ ...x, [descField]: next } as any) : x,
                      ),
                    },
                  })}
                />
                {c.link && (
                  <a href={c.link} className="inline-block mt-3 text-sm underline">
                    {ar ? "اعرف أكثر" : "Learn more"}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RenderFaq({ s }: { s: FaqSection }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EditT
          s={s}
          field="title"
          as="h2"
          className="text-2xl md:text-3xl font-semibold mb-6 text-center"
          placeholder="الأسئلة الشائعة"
        />
        <div className="space-y-2">
          {s.content.items.map((it) => {
            const open = openId === it.id;
            const qf = ar ? "question_ar" : "question_en";
            const af = ar ? "answer_ar" : "answer_en";
            return (
              <div key={it.id} className="border border-border rounded-lg overflow-hidden">
                <div className="w-full flex items-center justify-between p-4 text-start font-medium hover:bg-muted/40">
                  <EditCustom
                    s={s}
                    as="span"
                    placeholder="السؤال"
                    value={(it as any)[qf] ?? ""}
                    ckey={`faq:${s.id}:${it.id}:${qf}`}
                    commit={(next, cur: any) => ({
                      ...cur,
                      content: {
                        ...cur.content,
                        items: cur.content.items.map((x: any) =>
                          x.id === it.id ? ({ ...x, [qf]: next } as any) : x,
                        ),
                      },
                    })}
                  />
                  <button
                    onClick={() => setOpenId(open ? null : it.id)}
                    className="ms-3 shrink-0"
                    aria-label="toggle"
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                    />
                  </button>
                </div>
                {open && (
                  <div className="px-4 pb-4 text-sm opacity-80">
                    <EditCustom
                      s={s}
                      as="div"
                      multiline
                      className="whitespace-pre-wrap"
                      placeholder="الإجابة"
                      value={(it as any)[af] ?? ""}
                      ckey={`faq:${s.id}:${it.id}:${af}`}
                      commit={(next, cur: any) => ({
                        ...cur,
                        content: {
                          ...cur.content,
                          items: cur.content.items.map((x: any) =>
                            x.id === it.id ? ({ ...x, [af]: next } as any) : x,
                          ),
                        },
                      })}
                    />
                    {it.link && (
                      <a href={it.link} className="mt-3 inline-block underline">
                        {ar ? "اعرف أكثر" : "Learn more"}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RenderTestimonials({ s }: { s: TestimonialsSection }) {
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EditT
          s={s}
          field="title"
          as="h2"
          className="text-2xl md:text-3xl font-semibold mb-8 text-center"
          placeholder="آراء العملاء"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {s.content.items.map((it) => {
            const qf = ar ? "quote_ar" : "quote_en";
            const rf = ar ? "role_ar" : "role_en";
            return (
              <figure key={it.id} className="rounded-2xl bg-card border border-border p-6">
                <EditCustom
                  s={s}
                  as="blockquote"
                  className="text-foreground/90"
                  multiline
                  placeholder="الاقتباس"
                  value={(it as any)[qf] ?? ""}
                  ckey={`tm:${s.id}:${it.id}:${qf}`}
                  commit={(next, cur: any) => ({
                    ...cur,
                    content: {
                      ...cur.content,
                      items: cur.content.items.map((x: any) =>
                        x.id === it.id ? ({ ...x, [qf]: next } as any) : x,
                      ),
                    },
                  })}
                />
                <figcaption className="mt-4 flex items-center gap-3">
                  {it.avatar && (
                    <img src={it.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  )}
                  <div>
                    <EditCustom
                      s={s}
                      as="div"
                      className="font-medium text-sm"
                      placeholder="الاسم"
                      value={it.name ?? ""}
                      ckey={`tm:${s.id}:${it.id}:name`}
                      commit={(next, cur: any) => ({
                        ...cur,
                        content: {
                          ...cur.content,
                          items: cur.content.items.map((x: any) =>
                            x.id === it.id ? ({ ...x, name: next } as any) : x,
                          ),
                        },
                      })}
                    />
                    <EditCustom
                      s={s}
                      as="div"
                      className="text-xs opacity-60"
                      placeholder="الدور"
                      value={(it as any)[rf] ?? ""}
                      ckey={`tm:${s.id}:${it.id}:${rf}`}
                      commit={(next, cur: any) => ({
                        ...cur,
                        content: {
                          ...cur.content,
                          items: cur.content.items.map((x: any) =>
                            x.id === it.id ? ({ ...x, [rf]: next } as any) : x,
                          ),
                        },
                      })}
                    />
                  </div>
                </figcaption>
                {it.link && (
                  <a href={it.link} className="mt-4 inline-block text-sm underline">
                    {ar ? "عرض القصة" : "View story"}
                  </a>
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RenderCta({ s }: { s: CtaSection }) {
  const align = s.content.alignment ?? "center";
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-4xl px-4 py-16", `text-${align}`)}>
        <EditT
          s={s}
          field="title"
          as="h2"
          className="text-3xl md:text-4xl font-semibold"
          placeholder="عنوان الدعوة"
        />
        <EditT
          s={s}
          field="subtitle"
          as="p"
          multiline
          className="mt-3 opacity-80"
          placeholder="نص توضيحي"
        />
        <div
          className={cn(
            "flex flex-wrap gap-3 mt-6",
            align === "center" && "justify-center",
            align === "right" && "justify-end",
          )}
        >
          <ButtonsRow buttons={s.content.buttons} ar={ar} />
        </div>
      </div>
    </section>
  );
}

function RenderGallery({ s }: { s: GallerySection }) {
  const cols = s.content.columns ?? 3;
  const mobileCols = s.content.mobileColumns ?? 1;
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const colsCls =
    cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EditT
          s={s}
          field="title"
          as="h2"
          className="text-2xl md:text-3xl font-semibold mb-6 text-center"
          placeholder="معرض الصور"
        />
        <div
          className={cn("grid gap-3", colsCls)}
          data-mobile-columns={mobileCols}
          style={mobileGridStyle(mobileCols)}
        >
          {s.content.images.map((im, i) => {
            const media = (
              <figure className="relative min-w-0 overflow-hidden rounded-xl">
                <img
                  src={im.url}
                  alt={im.alt || ""}
                  className={cn(
                    "w-full object-cover rounded-xl",
                    aspectClass(s.content.imageAspectRatio ?? "1/1"),
                  )}
                />
                {pick(ar, im.caption_ar, im.caption_en) && (
                  <figcaption
                    className={cn(
                      "text-xs break-words",
                      s.content.captionStyle?.overlayMode
                        ? captionPlacementClasses(s.content.captionStyle)
                        : "mt-2 opacity-60",
                    )}
                    style={textStyle(s.content.captionStyle)}
                  >
                    {pick(ar, im.caption_ar, im.caption_en)}
                  </figcaption>
                )}
              </figure>
            );
            return im.link ? (
              <a
                key={i}
                href={im.link}
                target={im.newTab ? "_blank" : undefined}
                rel={im.newTab ? "noreferrer" : undefined}
              >
                {media}
              </a>
            ) : (
              <div key={i}>{media}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RenderBeforeAfter({ s }: { s: BeforeAfterSection }) {
  const { lang } = useLanguage();
  const [split, setSplit] = useState(50);
  const ar = lang === "ar";
  const c = s.content;
  const title = pick(ar, c.title_ar, c.title_en);
  const beforeLabel = pick(ar, c.beforeLabel_ar, c.beforeLabel_en) || (ar ? "قبل" : "Before");
  const afterLabel = pick(ar, c.afterLabel_ar, c.afterLabel_en) || (ar ? "بعد" : "After");
  const imageStyle = { height: c.imageHeight ?? 520 };
  const image = (value: ImageContent | undefined, label: string) =>
    value?.url ? (
      <img src={value.url} alt={value.alt || label} className="h-full w-full object-cover" />
    ) : (
      <div className="h-full w-full grid place-items-center bg-muted text-muted-foreground text-sm">
        {label}
      </div>
    );
  return (
    <section style={sectionStyle(s)} className="px-4 py-12">
      <div className="mx-auto max-w-6xl">
        {title && <h2 className="mb-7 text-center text-3xl font-semibold">{title}</h2>}
        {c.layout === "side_by_side" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="relative overflow-hidden rounded-2xl" style={imageStyle}>
              {image(c.beforeImage, beforeLabel)}
              <figcaption className="absolute bottom-3 start-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                {beforeLabel}
              </figcaption>
            </figure>
            <figure className="relative overflow-hidden rounded-2xl" style={imageStyle}>
              {image(c.afterImage, afterLabel)}
              <figcaption className="absolute bottom-3 start-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                {afterLabel}
              </figcaption>
            </figure>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-muted" style={imageStyle}>
            <div className="absolute inset-0">{image(c.afterImage, afterLabel)}</div>
            <div
              className="absolute inset-y-0 start-0 overflow-hidden"
              style={{ width: `${split}%` }}
            >
              <div className="h-full" style={{ width: `${10000 / Math.max(split, 1)}%` }}>
                {image(c.beforeImage, beforeLabel)}
              </div>
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
              style={{ insetInlineStart: `${split}%` }}
            />
            <input
              aria-label="Before and after comparison"
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(event) => setSplit(Number(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
            <span className="absolute bottom-3 start-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
              {beforeLabel}
            </span>
            <span className="absolute bottom-3 end-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
              {afterLabel}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function RenderVideo({ s }: { s: VideoSection }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const c = s.content;
  return (
    <section style={sectionWrapStyle(s)} className="px-4 py-12">
      <div className="mx-auto max-w-6xl text-center">
        {pick(ar, c.title_ar, c.title_en) && (
          <h2 className="mb-6 text-3xl font-semibold">{pick(ar, c.title_ar, c.title_en)}</h2>
        )}
        {c.videoUrl ? (
          <video
            src={c.videoUrl}
            poster={c.poster?.url}
            autoPlay={c.autoplay}
            muted={c.muted}
            loop={c.loop}
            controls={c.controls !== false}
            playsInline
            className="mx-auto w-full rounded-2xl bg-black object-cover"
            style={{ aspectRatio: c.aspectRatio ?? "16/9" }}
          />
        ) : (
          <div
            className="grid w-full place-items-center rounded-2xl bg-muted text-muted-foreground"
            style={{ aspectRatio: c.aspectRatio ?? "16/9" }}
          >
            {ar ? "أضف ملف الفيديو من الإعدادات" : "Add a video in settings"}
          </div>
        )}
        {pick(ar, c.caption_ar, c.caption_en) && (
          <p className="mt-3 text-sm opacity-70">{pick(ar, c.caption_ar, c.caption_en)}</p>
        )}
        {c.link && (
          <a href={c.link} className="mt-4 inline-block underline">
            {ar ? "فتح الرابط" : "Open link"}
          </a>
        )}
      </div>
    </section>
  );
}

function RenderCountdown({ s }: { s: CountdownSection }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const target = s.content.targetDate ? new Date(s.content.targetDate).getTime() : now;
  const remaining = Math.max(0, target - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining / 3600000) % 24);
  const minutes = Math.floor((remaining / 60000) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  const units = [
    [days, ar ? "يوم" : "Days"],
    [hours, ar ? "ساعة" : "Hours"],
    [minutes, ar ? "دقيقة" : "Minutes"],
    [seconds, ar ? "ثانية" : "Seconds"],
  ];
  const bg = s.content.backgroundImage?.url;
  return (
    <section
      style={{
        ...sectionWrapStyle(s),
        backgroundImage: bg ? `linear-gradient(#0008,#0008),url(${bg})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className={cn("px-4 py-16 text-center", bg && "text-white")}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-semibold">
          {pick(ar, s.content.title_ar, s.content.title_en)}
        </h2>
        <p className="mt-2 opacity-75">{pick(ar, s.content.subtitle_ar, s.content.subtitle_en)}</p>
        {remaining > 0 ? (
          <div className="mx-auto my-8 grid max-w-2xl grid-cols-4 gap-3">
            {units.map(([value, label]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-current/20 bg-background/10 p-4 backdrop-blur"
              >
                <strong className="block text-3xl md:text-5xl">
                  {String(value).padStart(2, "0")}
                </strong>
                <span className="text-xs opacity-70">{label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="my-8 text-2xl font-semibold">
            {pick(ar, s.content.expiredText_ar, s.content.expiredText_en)}
          </p>
        )}
        <ButtonsRow buttons={s.content.button ? [s.content.button] : []} ar={ar} />
      </div>
    </section>
  );
}

function RenderNewsletter({ s }: { s: NewsletterSection }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError(ar ? "أدخل بريداً إلكترونياً صحيحاً" : "Enter a valid email");
      setBusy(false);
      return;
    }
    const { error: dbError } = await supabase.from("contact_submissions").insert({
      name: "Newsletter subscriber",
      email: normalized,
      subject: "Newsletter subscription",
      message: `Newsletter subscription from section ${s.id}`,
    });
    if (!dbError && s.content.actionUrl) {
      try {
        await fetch(s.content.actionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalized, source: "storefront-newsletter" }),
        });
      } catch {
        /* The database copy remains saved. */
      }
    }
    setBusy(false);
    if (dbError) setError(ar ? "تعذر الاشتراك، حاول مرة أخرى" : "Could not subscribe. Try again.");
    else {
      setDone(true);
      setEmail("");
    }
  };
  const bg = s.content.backgroundImage?.url;
  return (
    <section
      style={{
        ...sectionWrapStyle(s),
        backgroundImage: bg ? `linear-gradient(#0007,#0007),url(${bg})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className={cn("px-4 py-16 text-center", bg && "text-white")}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-semibold">
          {pick(ar, s.content.title_ar, s.content.title_en)}
        </h2>
        <p className="mt-3 opacity-75">{pick(ar, s.content.subtitle_ar, s.content.subtitle_en)}</p>
        {done ? (
          <p className="mt-6 font-medium">
            {pick(ar, s.content.successText_ar, s.content.successText_en)}
          </p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-6 flex max-w-xl gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={pick(ar, s.content.placeholder_ar, s.content.placeholder_en)}
              className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-foreground"
            />
            <button
              disabled={busy}
              className="rounded-xl bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
            >
              {busy ? "…" : pick(ar, s.content.buttonLabel_ar, s.content.buttonLabel_en)}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {s.content.privacyUrl && (
          <a href={s.content.privacyUrl} className="mt-3 inline-block text-xs underline opacity-70">
            {ar ? "سياسة الخصوصية" : "Privacy policy"}
          </a>
        )}
      </div>
    </section>
  );
}

function RenderStats({ s }: { s: StatsSection }) {
  const ctx = useContext(EditContext);
  const { lang } = useLanguage();
  const ar = ctx?.ar ?? lang === "ar";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-5xl px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {s.content.items.map((it) => {
          const lf = ar ? "label_ar" : "label_en";
          return (
            <div key={it.id} className="relative">
              <EditCustom
                s={s}
                as="div"
                className="text-3xl md:text-4xl font-semibold"
                placeholder="0"
                value={it.value ?? ""}
                ckey={`stat:${s.id}:${it.id}:value`}
                commit={(next, cur: any) => ({
                  ...cur,
                  content: {
                    ...cur.content,
                    items: cur.content.items.map((x: any) =>
                      x.id === it.id ? ({ ...x, value: next } as any) : x,
                    ),
                  },
                })}
              />
              {it.link && (
                <a
                  href={it.link}
                  aria-label={String((it as any)[lf] ?? it.value ?? "")}
                  className="absolute inset-0"
                />
              )}
              <EditCustom
                s={s}
                as="div"
                className="text-sm opacity-70 mt-1"
                placeholder="التسمية"
                value={(it as any)[lf] ?? ""}
                ckey={`stat:${s.id}:${it.id}:${lf}`}
                commit={(next, cur: any) => ({
                  ...cur,
                  content: {
                    ...cur.content,
                    items: cur.content.items.map((x: any) =>
                      x.id === it.id ? ({ ...x, [lf]: next } as any) : x,
                    ),
                  },
                })}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

type LiveReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  customer_name: string | null;
  created_at: string;
};

function RenderReviews({ s }: { s: ReviewsSection }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [items, setItems] = useState<LiveReview[]>([]);
  const [loading, setLoading] = useState(true);
  const limit = Math.max(1, Math.min(24, s.content.limit ?? 6));
  const minRating = Math.max(1, Math.min(5, s.content.minRating ?? 1));
  const columns = s.content.columns ?? 3;

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("reviews")
        .select("id,rating,title,body,customer_name,created_at")
        .eq("status", "approved")
        .gte("rating", minRating)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!cancel) {
        setItems((data as LiveReview[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [limit, minRating]);

  const title = pick(ar, s.content.title_ar, s.content.title_en);
  const colCls =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{title}</h2>}
        {loading ? (
          <div className="text-center text-sm text-muted-foreground">
            {ar ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            {ar ? "لا توجد تقييمات بعد." : "No reviews yet."}
          </div>
        ) : (
          <div className={cn("grid grid-cols-1 gap-4", colCls)}>
            {items.map((r) => (
              <article key={r.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-0.5 mb-2" aria-label={`${r.rating}/5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < r.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
                {r.title && <h3 className="font-semibold mb-1">{r.title}</h3>}
                {r.body && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-4">{r.body}</p>
                )}
                <div className="text-xs text-muted-foreground">
                  — {r.customer_name || (ar ? "عميل" : "Customer")}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function buttonClasses(
  variant: string | undefined,
  size: string | undefined,
  shape: string | undefined,
  fullWidth?: boolean,
) {
  const v =
    variant === "secondary"
      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      : variant === "ghost"
        ? "bg-transparent text-foreground hover:bg-muted"
        : "bg-primary text-primary-foreground hover:bg-primary/90";
  const sz =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : size === "lg"
        ? "px-6 py-3 text-base"
        : size === "xl"
          ? "px-8 py-4 text-lg"
          : "px-4 py-2 text-sm";
  const sh = shape === "pill" ? "rounded-full" : shape === "square" ? "rounded-none" : "rounded-md";
  return cn(
    "inline-flex items-center justify-center font-medium transition shadow-sm",
    v,
    sz,
    sh,
    fullWidth && "w-full",
  );
}

function RenderButton({ s }: { s: ButtonSection }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const c = s.content;
  const b = c.button;
  if (!b) return null;
  const label = pick(ar, b.label_ar, b.label_en);
  if (!label) return null;
  const align =
    c.alignment === "left" ? "text-start" : c.alignment === "right" ? "text-end" : "text-center";
  return (
    <section style={sectionStyle(s)} className={align + " px-4"}>
      <a
        href={b.url || "#"}
        target={b.newTab ? "_blank" : undefined}
        rel={b.newTab ? "noopener noreferrer" : undefined}
        className={buttonClasses(b.variant, c.size, c.shape, c.fullWidth)}
      >
        {label}
      </a>
    </section>
  );
}

function RenderBanner({ s }: { s: BannerSection }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const c = s.content;
  const h =
    c.height === "sm"
      ? "h-48"
      : c.height === "lg"
        ? "h-96"
        : c.height === "xl"
          ? "h-[32rem]"
          : "h-72";
  const align =
    c.alignment === "left"
      ? "items-start text-start"
      : c.alignment === "right"
        ? "items-end text-end"
        : "items-center text-center";
  const vertical = verticalClass(c.verticalAlignment ?? "center");
  const shape =
    c.shape === "pill" ? "rounded-full" : c.shape === "square" ? "rounded-none" : "rounded-2xl";
  const overlay = c.overlay ?? 0.35;
  const img = c.image?.url;
  const title = pick(ar, c.title_ar, c.title_en);
  const subtitle = pick(ar, c.subtitle_ar, c.subtitle_en);
  const b = c.button;
  const btnLabel = b ? pick(ar, b.label_ar, b.label_en) : "";
  return (
    <section style={sectionStyle(s)} className="px-4">
      <div
        className={cn(
          "relative w-full overflow-hidden flex flex-col mx-auto max-w-6xl",
          h,
          shape,
          align,
          vertical,
        )}
        style={{
          backgroundImage: img ? `url(${img})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: c.textColor || "#fff",
        }}
      >
        {img && (
          <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
        )}
        <div className="relative p-8 max-w-3xl">
          {title && (
            <h2 className="text-3xl md:text-4xl font-bold mb-2" style={textStyle(c.titleStyle)}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-base md:text-lg opacity-90 mb-4" style={textStyle(c.subtitleStyle)}>
              {subtitle}
            </p>
          )}
          {b && btnLabel && (
            <a
              href={b.url || "#"}
              target={b.newTab ? "_blank" : undefined}
              rel={b.newTab ? "noopener noreferrer" : undefined}
              className={buttonClasses(b.variant, "lg", "rounded")}
            >
              {btnLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function RenderProductGrid({ s }: { s: ProductGridSection }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const c = s.content;
  const [items, setItems] = useState<
    Array<{
      id: string;
      slug: string;
      name: string;
      image: string | null;
      price: number | null;
      currency: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, x: 0, scroll: 0, moved: false });

  const keyDeps = useMemo(
    () =>
      JSON.stringify({ src: c.source, cat: c.categorySlug, slugs: c.productSlugs, lim: c.limit }),
    [c.source, c.categorySlug, c.productSlugs, c.limit],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const lim = Math.max(1, Math.min(48, c.limit ?? 8));
      let q = supabase
        .from("products")
        .select("id, slug, name_ar, name_en, image_url, price, currency, status, is_active")
        .eq("status", "active")
        .eq("is_active", true)
        .limit(lim);
      if (c.source === "manual") {
        if (!c.productSlugs?.length) {
          if (!cancelled) {
            setItems([]);
            setLoading(false);
          }
          return;
        }
        q = q.in("slug", c.productSlugs);
      } else if (c.source === "category" && c.categorySlug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", c.categorySlug)
          .maybeSingle();
        if (!cat?.id) {
          if (!cancelled) {
            setItems([]);
            setLoading(false);
          }
          return;
        }
        const ids = await getCategoryProductIds(cat.id, lim);
        if (ids.length === 0) {
          if (!cancelled) {
            setItems([]);
            setLoading(false);
          }
          return;
        }
        q = supabase
          .from("products")
          .select("id, slug, name_ar, name_en, image_url, price, currency, status, is_active")
          .eq("status", "active")
          .eq("is_active", true)
          .in("id", ids)
          .limit(lim);
      } else if (c.source === "category") {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      } else if (c.source === "best_sellers") {
        q = q.order("sales_count", { ascending: false });
      } else if (c.source === "sale") {
        q = q.not("compare_at_price", "is", null).order("created_at", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
      }
      const { data } = await q;
      if (cancelled) return;
      const mapped = (data ?? []).map((r: any) => ({
        id: r.id,
        slug: r.slug,
        name: (ar ? r.name_ar : r.name_en) || r.name_en || r.name_ar || "",
        image: r.image_url,
        price: r.price,
        currency: r.currency,
      }));
      if (c.source === "manual" && c.productSlugs) {
        const order = new Map(c.productSlugs.map((slug, index) => [slug, index]));
        mapped.sort(
          (a, b) =>
            (order.get(a.slug) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(b.slug) ?? Number.MAX_SAFE_INTEGER),
        );
      }
      setItems(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [keyDeps, ar]);

  const cols = c.columns ?? 4;
  const mobileCols = c.mobileColumns ?? 2;
  const colCls =
    cols === 2
      ? "grid-cols-2"
      : cols === 3
        ? "grid-cols-2 md:grid-cols-3"
        : cols === 5
          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  const cardRound = c.cardShape === "square" ? "rounded-none" : "rounded-xl";
  const title = pick(ar, c.title_ar, c.title_en);
  const carouselWidth =
    c.carouselCardSize === "compact"
      ? "w-[155px] sm:w-[185px]"
      : c.carouselCardSize === "large"
        ? "w-[260px] sm:w-[310px]"
        : "w-[205px] sm:w-[235px]";
  const renderCard = (p: (typeof items)[number], carousel = false) => (
    <Link
      key={p.id}
      to="/product/$slug"
      params={{ slug: p.slug }}
      data-live-navigation="product"
      draggable={false}
      onClick={(event) => {
        if (dragRef.current.moved) {
          event.preventDefault();
          dragRef.current.moved = false;
        }
      }}
      className={cn(
        "block overflow-hidden border border-border bg-card hover:shadow-md transition",
        cardRound,
        carousel && `shrink-0 snap-start select-none ${carouselWidth}`,
      )}
    >
      {p.image ? (
        <img
          src={p.image}
          alt={p.name}
          draggable={false}
          loading="lazy"
          className={cn("w-full object-cover", aspectClass(c.imageAspectRatio ?? "1/1"))}
        />
      ) : (
        <div className={cn("bg-muted", aspectClass(c.imageAspectRatio ?? "1/1"))} />
      )}
      <div className="p-2.5 min-w-0">
        <div
          className="text-sm font-medium line-clamp-2 break-words"
          style={textStyle(c.productNameStyle)}
        >
          {p.name}
        </div>
        {c.showPrice !== false && p.price != null && (
          <div
            className="text-sm text-primary font-semibold mt-1 break-words"
            style={textStyle(c.productPriceStyle)}
          >
            {p.price} {p.currency || "SAR"}
          </div>
        )}
      </div>
    </Link>
  );
  const scrollCarousel = (direction: -1 | 1) =>
    trackRef.current?.scrollBy({
      left: direction * (ar ? -1 : 1) * trackRef.current.clientWidth * 0.82,
      behavior: "smooth",
    });
  return (
    <section style={sectionStyle(s)} className="px-4 py-6" data-no-translate>
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>}
        {loading ? (
          <div
            className={cn("grid gap-3", colCls)}
            data-mobile-columns={mobileCols}
            style={mobileGridStyle(mobileCols)}
          >
            {Array.from({ length: cols }).map((_, i) => (
              <div key={i} className={cn("aspect-square bg-muted animate-pulse", cardRound)} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            {ar ? "لا توجد منتجات" : "No products"}
          </p>
        ) : c.layout === "carousel" ? (
          <div className="relative">
            <div
              ref={trackRef}
              dir={ar ? "rtl" : "ltr"}
              className="flex touch-pan-y cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onPointerDown={(event) => {
                if (event.pointerType === "mouse" && event.button !== 0) return;
                const el = event.currentTarget;
                dragRef.current = {
                  active: true,
                  x: event.clientX,
                  scroll: el.scrollLeft,
                  moved: false,
                };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag.active) return;
                const delta = event.clientX - drag.x;
                if (Math.abs(delta) > 5) {
                  if (!drag.moved) {
                    drag.moved = true;
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      // Pointer capture can fail if the pointer is already released.
                    }
                  }
                  event.currentTarget.scrollLeft = drag.scroll - delta;
                }
              }}
              onPointerUp={(event) => {
                dragRef.current.active = false;
                try {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                } catch {
                  // Safe to ignore when the browser has already released capture.
                }
              }}
              onPointerCancel={() => {
                dragRef.current.active = false;
              }}
            >
              {items.map((product) => renderCard(product, true))}
            </div>
            {c.showNavigation !== false && items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollCarousel(-1)}
                  aria-label={ar ? "السابق" : "Previous"}
                  className="absolute start-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur"
                >
                  {ar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel(1)}
                  aria-label={ar ? "التالي" : "Next"}
                  className="absolute end-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur"
                >
                  {ar ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              </>
            )}
          </div>
        ) : (
          <div
            className={cn("grid gap-3", colCls)}
            data-mobile-columns={mobileCols}
            style={mobileGridStyle(mobileCols)}
          >
            {items.map((product) => renderCard(product))}
          </div>
        )}
      </div>
    </section>
  );
}

function RenderDivider({ s }: { s: DividerSection }) {
  const c = s.content;
  return (
    <section style={sectionStyle(s)} className="px-4 py-2 flex justify-center">
      <div
        style={{
          width: `${c.width ?? 100}%`,
          borderTopWidth: `${c.thickness ?? 1}px`,
          borderTopStyle: (c.style ?? "solid") as any,
          borderTopColor: c.color ?? "#e5e7eb",
        }}
      />
    </section>
  );
}

function RenderSpacer({ s }: { s: SpacerSection }) {
  return <div style={{ height: `${s.content.height ?? 40}px`, ...sectionStyle(s) }} />;
}

function RenderHtml({ s }: { s: HtmlSection }) {
  return (
    <section
      style={sectionStyle(s)}
      className="px-4"
      dangerouslySetInnerHTML={{ __html: s.content.html ?? "" }}
    />
  );
}

function sectionStyle(s: Section): React.CSSProperties {
  const typography = s.settings?.typography ?? {};
  const fontFamily =
    typography.fontFamily === "serif"
      ? "Cormorant Garamond, Georgia, serif"
      : typography.fontFamily === "sans"
        ? "Inter, ui-sans-serif, system-ui, sans-serif"
        : typography.fontFamily === "mono"
          ? "ui-monospace, SFMono-Regular, Menlo, monospace"
          : typography.fontFamily === "damas"
            ? '"TS Damas Slab", "Damas", "Noto Naskh Arabic", serif'
            : typography.fontFamily === "tek-arabic"
              ? '"TEK Arabic", "Tajawal", "IBM Plex Sans Arabic", sans-serif'
              : undefined;
  return {
    paddingTop: s.settings?.spacing?.paddingTop,
    paddingBottom: s.settings?.spacing?.paddingBottom,
    backgroundColor: s.settings?.backgroundColor,
    color: typography.color,
    fontSize: typography.fontSize,
    fontFamily,
    fontWeight: typography.fontWeight,
    textAlign: typography.textAlign,
    lineHeight: typography.lineHeight,
    letterSpacing: typography.letterSpacing,
  };
}

function RenderSection({ s }: { s: Section }) {
  const el = (() => {
    switch (s.type) {
      case "legacy_home":
        return null;
      case "hero":
        return <RenderHero s={s} />;
      case "text_block":
        return <RenderTextBlock s={s} />;
      case "image_text":
        return <RenderImageText s={s} />;
      case "feature_grid":
        return <RenderFeatureGrid s={s} />;
      case "faq":
        return <RenderFaq s={s} />;
      case "testimonials":
        return <RenderTestimonials s={s} />;
      case "cta":
        return <RenderCta s={s} />;
      case "gallery":
        return <RenderGallery s={s} />;
      case "before_after":
        return <RenderBeforeAfter s={s} />;
      case "video":
        return <RenderVideo s={s} />;
      case "countdown":
        return <RenderCountdown s={s} />;
      case "newsletter":
        return <RenderNewsletter s={s} />;
      case "stats":
        return <RenderStats s={s} />;
      case "reviews":
        return <RenderReviews s={s} />;
      case "button":
        return <RenderButton s={s} />;
      case "banner":
        return <RenderBanner s={s} />;
      case "product_grid":
        return <RenderProductGrid s={s} />;
      case "divider":
        return <RenderDivider s={s} />;
      case "spacer":
        return <RenderSpacer s={s} />;
      case "html":
        return <RenderHtml s={s} />;
      default:
        return null;
    }
  })();
  if (!el) return null;
  return cloneElement(el, { "data-live-id": `section-${s.id}` });
}

function isVisible(s: Section, device: "desktop" | "tablet" | "mobile"): boolean {
  const v = s.settings?.visibility;
  if (!v) return true;
  return v[device] !== false;
}

// CSS-class based visibility so it also works on the public (non-preview) site.
function visibilityClass(s: Section): string {
  const v = s.settings?.visibility;
  if (!v) return "";
  const parts: string[] = [];
  if (v.mobile === false) parts.push("max-md:hidden");
  if (v.tablet === false) parts.push("max-lg:md:hidden");
  if (v.desktop === false) parts.push("lg:hidden");
  return parts.join(" ");
}

export type PageRendererProps = {
  content: PageContent;
  device?: "desktop" | "tablet" | "mobile";
  /** Inline-edit handler. When provided, all texts become contentEditable. */
  onSectionUpdate?: (
    id: string,
    updater: (s: Section) => Section,
    opts?: { label?: string; key?: string },
  ) => void;
};

export function PageRenderer({ content, device, onSectionUpdate }: PageRendererProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const sections = content?.sections ?? [];
  const inner = (
    <>
      {sections.map((s) => {
        if (device && !isVisible(s, device)) return null;
        const cls = visibilityClass(s);
        if (!cls) return <RenderSection key={s.id} s={s} />;
        return (
          <div key={s.id} className={cls}>
            <RenderSection s={s} />
          </div>
        );
      })}
    </>
  );
  if (!onSectionUpdate)
    return (
      <div className="contents" data-no-translate>
        {inner}
      </div>
    );
  return (
    <EditContext.Provider value={{ updateSection: onSectionUpdate, ar }}>
      <div className="contents" data-no-translate>
        {inner}
      </div>
    </EditContext.Provider>
  );
}
