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
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function pick(ar: boolean, valAr?: string, valEn?: string) {
  return (ar ? valAr : valEn) ?? valEn ?? valAr ?? "";
}

// ----- Inline edit context -----
type EditCtx = {
  updateSection: (id: string, updater: (s: Section) => Section, opts?: { label?: string; key?: string }) => void;
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
          if (el.tagName === "A" && (a.name === "href" || a.name === "target" || a.name === "rel")) continue;
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
  value, onCommit, as: Tag = "span", className, multiline, placeholder, coalesceKey, label,
}: {
  value: string;
  onCommit: (next: string) => void;
  as?: any;
  className?: string;
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
          if (k === "b") { e.preventDefault(); exec("bold"); return; }
          if (k === "i") { e.preventDefault(); exec("italic"); return; }
          if (k === "u") { e.preventDefault(); exec("underline"); return; }
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
          if (e.shiftKey && k === "x") { e.preventDefault(); exec("removeFormat"); return; }
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
  s, field, as, className, multiline, placeholder,
}: {
  s: Section;
  field: string; // base name; suffixed with _ar/_en based on lang
  as?: any;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const ctx = useContext(EditContext);
  const ar = ctx?.ar ?? false;
  const full = `${field}_${ar ? "ar" : "en"}`;
  const value = ((s as any).content?.[full] ?? "") as string;
  const Tag = as ?? "span";
  if (!ctx) {
    if (!value) return null;
    if (isHTMLish(value)) return <Tag className={cn(className, "[&_a]:underline [&_a]:text-primary")} dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(value) }} />;
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
          (sec) => ({ ...sec, content: { ...(sec as any).content, [full]: next } } as Section),
          { label: `تعديل ${field}`, key: `inline:${s.id}:${full}` },
        )
      }
    />
  );
}

/** Editable text on an arbitrary path with a custom commit fn. */
function EditCustom({
  s, value, commit, as, className, multiline, placeholder, ckey,
}: {
  s: Section;
  value: string;
  commit: (next: string) => Section;
  as?: any;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  ckey: string;
}) {
  const ctx = useContext(EditContext);
  const Tag = as ?? "span";
  if (!ctx) {
    if (!value) return null;
    if (isHTMLish(value)) return <Tag className={cn(className, "[&_a]:underline [&_a]:text-primary")} dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(value) }} />;
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <EditableText
      as={Tag}
      className={className}
      value={value}
      multiline={multiline}
      placeholder={placeholder}
      coalesceKey={ckey}
      onCommit={(next) =>
        ctx.updateSection(s.id, () => commit(next), { label: "تعديل نص", key: ckey })
      }
    />
  );
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

function RenderHero({ s }: { s: HeroSection }) {
  const bgImage = s.settings?.backgroundImage || s.content.image?.url;
  const overlay = s.settings?.overlay ?? 0;
  const align = s.content.alignment ?? "center";
  const ctx = useContext(EditContext);
  const ar = ctx?.ar ?? false;
  return (
    <section className="relative overflow-hidden" style={sectionWrapStyle(s)}>
      {bgImage && (
        <div className="absolute inset-0 -z-10">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          {overlay > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />}
        </div>
      )}
      <div className={cn("mx-auto max-w-5xl px-4 py-20", `text-${align}`)}>
        <EditT s={s} field="eyebrow" as="p" className="text-xs uppercase tracking-widest opacity-70 mb-3" placeholder="Eyebrow" />
        <EditT s={s} field="title" as="h1" className="text-4xl md:text-6xl font-semibold tracking-tight" placeholder="العنوان" />
        <EditT s={s} field="subtitle" as="p" multiline className="mt-4 text-base md:text-lg opacity-80 max-w-2xl mx-auto" placeholder="العنوان الفرعي" />
        <div className={cn("flex flex-wrap gap-3 mt-6", align === "center" && "justify-center", align === "right" && "justify-end")}>
          <ButtonsRow buttons={s.content.buttons} ar={ar} />
        </div>
      </div>
    </section>
  );
}

function RenderTextBlock({ s }: { s: TextBlockSection }) {
  const align = (s.content as any).alignment ?? "left";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-3xl px-4 py-12", `text-${align}`)}>
        <EditT s={s} field="title" as="h2" className="text-2xl md:text-3xl font-semibold mb-4" placeholder="العنوان" />
        <EditT s={s} field="body" as="div" multiline className="whitespace-pre-wrap text-foreground/90 leading-relaxed" placeholder="اكتب النص هنا…" />
      </div>
    </section>
  );
}

function RenderImageText({ s }: { s: ImageTextSection }) {
  const side = s.content.imageSide ?? "left";
  const ctx = useContext(EditContext);
  const ar = ctx?.ar ?? false;
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-2 gap-8 items-center", side === "right" && "md:[&>div:first-child]:order-2")}>
        <div>
          {s.content.image?.url && <img src={s.content.image.url} alt={s.content.image.alt || ""} className="w-full rounded-2xl object-cover" />}
        </div>
        <div>
          <EditT s={s} field="title" as="h2" className="text-2xl md:text-3xl font-semibold mb-3" placeholder="العنوان" />
          <EditT s={s} field="body" as="p" multiline className="whitespace-pre-wrap text-foreground/80 leading-relaxed" placeholder="النص" />
          {s.content.button && <ButtonsRow buttons={[s.content.button]} ar={ar} />}
        </div>
      </div>
    </section>
  );
}

function RenderFeatureGrid({ s }: { s: FeatureGridSection }) {
  const cols = s.content.columns ?? 3;
  const colsCls = cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  const ctx = useContext(EditContext);
  const ar = ctx?.ar ?? false;
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EditT s={s} field="title" as="h2" className="text-2xl md:text-3xl font-semibold text-center mb-2" placeholder="عنوان القسم" />
        <EditT s={s} field="subtitle" as="p" className="text-center opacity-70 mb-10" placeholder="وصف قصير" />
        <div className={cn("grid gap-6", colsCls)}>
          {s.content.cards.map((c) => {
            const titleField = ar ? "title_ar" : "title_en";
            const descField = ar ? "description_ar" : "description_en";
            return (
              <div key={c.id} className="rounded-2xl border border-border p-6 bg-card">
                <EditCustom
                  s={s} as="h3" className="text-lg font-semibold mb-2" placeholder="عنوان البطاقة"
                  value={(c as any)[titleField] ?? ""}
                  ckey={`card:${s.id}:${c.id}:${titleField}`}
                  commit={(next) => ({ ...s, content: { ...s.content, cards: s.content.cards.map((x) => x.id === c.id ? { ...x, [titleField]: next } as any : x) } })}
                />
                <EditCustom
                  s={s} as="p" className="text-sm opacity-75" multiline placeholder="وصف البطاقة"
                  value={(c as any)[descField] ?? ""}
                  ckey={`card:${s.id}:${c.id}:${descField}`}
                  commit={(next) => ({ ...s, content: { ...s.content, cards: s.content.cards.map((x) => x.id === c.id ? { ...x, [descField]: next } as any : x) } })}
                />
                {c.link && <a href={c.link} className="inline-block mt-3 text-sm underline">{ar ? "اعرف أكثر" : "Learn more"}</a>}
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
  const ar = ctx?.ar ?? false;
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EditT s={s} field="title" as="h2" className="text-2xl md:text-3xl font-semibold mb-6 text-center" placeholder="الأسئلة الشائعة" />
        <div className="space-y-2">
          {s.content.items.map((it) => {
            const open = openId === it.id;
            const qf = ar ? "question_ar" : "question_en";
            const af = ar ? "answer_ar" : "answer_en";
            return (
              <div key={it.id} className="border border-border rounded-lg overflow-hidden">
                <div className="w-full flex items-center justify-between p-4 text-start font-medium hover:bg-muted/40">
                  <EditCustom
                    s={s} as="span" placeholder="السؤال"
                    value={(it as any)[qf] ?? ""}
                    ckey={`faq:${s.id}:${it.id}:${qf}`}
                    commit={(next) => ({ ...s, content: { ...s.content, items: s.content.items.map((x) => x.id === it.id ? { ...x, [qf]: next } as any : x) } })}
                  />
                  <button onClick={() => setOpenId(open ? null : it.id)} className="ms-3 shrink-0" aria-label="toggle">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                  </button>
                </div>
                {open && (
                  <div className="px-4 pb-4 text-sm opacity-80">
                    <EditCustom
                      s={s} as="div" multiline className="whitespace-pre-wrap" placeholder="الإجابة"
                      value={(it as any)[af] ?? ""}
                      ckey={`faq:${s.id}:${it.id}:${af}`}
                      commit={(next) => ({ ...s, content: { ...s.content, items: s.content.items.map((x) => x.id === it.id ? { ...x, [af]: next } as any : x) } })}
                    />
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
  const ar = ctx?.ar ?? false;
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EditT s={s} field="title" as="h2" className="text-2xl md:text-3xl font-semibold mb-8 text-center" placeholder="آراء العملاء" />
        <div className="grid gap-6 md:grid-cols-3">
          {s.content.items.map((it) => {
            const qf = ar ? "quote_ar" : "quote_en";
            const rf = ar ? "role_ar" : "role_en";
            return (
              <figure key={it.id} className="rounded-2xl bg-card border border-border p-6">
                <EditCustom
                  s={s} as="blockquote" className="text-foreground/90" multiline placeholder="الاقتباس"
                  value={(it as any)[qf] ?? ""}
                  ckey={`tm:${s.id}:${it.id}:${qf}`}
                  commit={(next) => ({ ...s, content: { ...s.content, items: s.content.items.map((x) => x.id === it.id ? { ...x, [qf]: next } as any : x) } })}
                />
                <figcaption className="mt-4 flex items-center gap-3">
                  {it.avatar && <img src={it.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />}
                  <div>
                    <EditCustom
                      s={s} as="div" className="font-medium text-sm" placeholder="الاسم"
                      value={it.name ?? ""}
                      ckey={`tm:${s.id}:${it.id}:name`}
                      commit={(next) => ({ ...s, content: { ...s.content, items: s.content.items.map((x) => x.id === it.id ? { ...x, name: next } as any : x) } })}
                    />
                    <EditCustom
                      s={s} as="div" className="text-xs opacity-60" placeholder="الدور"
                      value={(it as any)[rf] ?? ""}
                      ckey={`tm:${s.id}:${it.id}:${rf}`}
                      commit={(next) => ({ ...s, content: { ...s.content, items: s.content.items.map((x) => x.id === it.id ? { ...x, [rf]: next } as any : x) } })}
                    />
                  </div>
                </figcaption>
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
  const ar = ctx?.ar ?? false;
  return (
    <section style={sectionWrapStyle(s)}>
      <div className={cn("mx-auto max-w-4xl px-4 py-16", `text-${align}`)}>
        <EditT s={s} field="title" as="h2" className="text-3xl md:text-4xl font-semibold" placeholder="عنوان الدعوة" />
        <EditT s={s} field="subtitle" as="p" multiline className="mt-3 opacity-80" placeholder="نص توضيحي" />
        <div className={cn("flex flex-wrap gap-3 mt-6", align === "center" && "justify-center", align === "right" && "justify-end")}>
          <ButtonsRow buttons={s.content.buttons} ar={ar} />
        </div>
      </div>
    </section>
  );
}

function RenderGallery({ s }: { s: GallerySection }) {
  const cols = s.content.columns ?? 3;
  const colsCls = cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EditT s={s} field="title" as="h2" className="text-2xl md:text-3xl font-semibold mb-6 text-center" placeholder="معرض الصور" />
        <div className={cn("grid gap-3", colsCls)}>
          {s.content.images.map((im, i) => (
            <img key={i} src={im.url} alt={im.alt || ""} className="w-full aspect-square object-cover rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

function RenderStats({ s }: { s: StatsSection }) {
  const ctx = useContext(EditContext);
  const ar = ctx?.ar ?? false;
  return (
    <section style={sectionWrapStyle(s)}>
      <div className="mx-auto max-w-5xl px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {s.content.items.map((it) => {
          const lf = ar ? "label_ar" : "label_en";
          return (
            <div key={it.id}>
              <EditCustom
                s={s} as="div" className="text-3xl md:text-4xl font-semibold" placeholder="0"
                value={it.value ?? ""}
                ckey={`stat:${s.id}:${it.id}:value`}
                commit={(next) => ({ ...s, content: { ...s.content, items: s.content.items.map((x) => x.id === it.id ? { ...x, value: next } as any : x) } })}
              />
              <EditCustom
                s={s} as="div" className="text-sm opacity-70 mt-1" placeholder="التسمية"
                value={(it as any)[lf] ?? ""}
                ckey={`stat:${s.id}:${it.id}:${lf}`}
                commit={(next) => ({ ...s, content: { ...s.content, items: s.content.items.map((x) => x.id === it.id ? { ...x, [lf]: next } as any : x) } })}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RenderSection({ s }: { s: Section }) {
  switch (s.type) {
    case "legacy_home":
      return <HomeScreen />;
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
    case "stats":
      return <RenderStats s={s} />;
    default:
      return null;
  }
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
  onSectionUpdate?: (id: string, updater: (s: Section) => Section, opts?: { label?: string; key?: string }) => void;
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
  if (!onSectionUpdate) return inner;
  return (
    <EditContext.Provider value={{ updateSection: onSectionUpdate, ar }}>
      {inner}
    </EditContext.Provider>
  );
}
