import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Save,
  Upload,
  X,
  Link as LinkIcon,
  History as HistoryIcon,
  Palette,
  Languages,
  RotateCcw,
  CheckCircle2,
  GripVertical,
  LayoutTemplate,
  Monitor,
  Tablet,
  Smartphone,
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { HistoryPanel } from "./HistoryPanel";
import { StylePopover, type StyleValue } from "./StylePopover";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLiveEdit } from "./LiveEditContext";
import {
  computeSelector,
  resolveSelector,
  applyOverrideToEl,
  loadOverrides,
  persistDraft,
  publishDraft,
  resetDraftToPublished,
  keyOf,
  GLOBAL_FOOTER_PATH,
  GLOBAL_HEADER_PATH,
  type DraftMap,
  type OverrideProp,
} from "./overrides";
import "./live-editor.css";
import { usePageEditor } from "@/page-builder/hooks/usePageEditor";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { SectionEditor } from "@/page-builder/components/SectionEditor";
import { createDefaultSection } from "@/page-builder/utils/pageDefaults";
import type { SectionType } from "@/page-builder/schemas/pageSchema";

type StudioBlock = { id: string; type: SectionType; ar: string; en: string; category: string };
const BLOCK_TEMPLATES: StudioBlock[] = [
  ["hero", "واجهة فاخرة", "Luxury hero", "campaign"],
  ["hero", "واجهة منقسمة", "Split hero", "campaign"],
  ["hero", "إطلاق مجموعة", "Collection launch", "campaign"],
  ["banner", "بنر تخفيضات", "Sale banner", "campaign"],
  ["banner", "بنر صورة كامل", "Full image banner", "campaign"],
  ["banner", "بنر مناسبة", "Occasion banner", "campaign"],
  ["product_grid", "وصل حديثًا", "New arrivals", "commerce"],
  ["product_grid", "الأكثر مبيعًا", "Best sellers", "commerce"],
  ["product_grid", "مختاراتنا", "Curated products", "commerce"],
  ["product_grid", "منتجات التخفيض", "Sale products", "commerce"],
  ["image_text", "قصة العلامة", "Brand story", "content"],
  ["image_text", "صورة مع نص", "Image with text", "content"],
  ["image_text", "رسالة المؤسس", "Founder note", "content"],
  ["text_block", "عنوان قسم", "Section heading", "content"],
  ["text_block", "محتوى غني", "Rich text", "content"],
  ["gallery", "معرض صور", "Photo gallery", "media"],
  ["gallery", "لوك بوك", "Lookbook", "media"],
  ["gallery", "صور العملاء", "Customer photos", "media"],
  ["feature_grid", "مزايا المتجر", "Store benefits", "commerce"],
  ["feature_grid", "أيقونات الخدمات", "Service icons", "content"],
  ["stats", "أرقام وإحصائيات", "Stats & numbers", "social"],
  ["testimonials", "آراء العملاء", "Testimonials", "social"],
  ["testimonials", "قصص العملاء", "Customer stories", "social"],
  ["reviews", "تقييمات حقيقية", "Live reviews", "social"],
  ["faq", "أسئلة شائعة", "FAQ", "engagement"],
  ["faq", "دليل المقاسات", "Size guide", "engagement"],
  ["cta", "دعوة للتسوق", "Shop callout", "engagement"],
  ["cta", "واتساب كونسيرج", "WhatsApp concierge", "engagement"],
  ["cta", "حجز موعد", "Book appointment", "engagement"],
  ["button", "زر تسوق", "Shop button", "engagement"],
  ["button", "زر تواصل", "Contact button", "engagement"],
  ["divider", "فاصل أنيق", "Elegant divider", "layout"],
  ["spacer", "مسافة مرنة", "Flexible spacer", "layout"],
  ["html", "HTML مخصص", "Custom HTML", "advanced"],
  ["video", "واجهة فيديو", "Video hero", "campaign"],
  ["banner", "شريط شحن مجاني", "Free shipping strip", "campaign"],
  ["countdown", "عد تنازلي للإطلاق", "Launch countdown", "campaign"],
  ["product_grid", "تسوقي حسب العمر", "Shop by age", "commerce"],
  ["product_grid", "هدايا مختارة", "Gift guide", "commerce"],
  ["feature_grid", "لماذا تختارنا", "Why choose us", "content"],
  ["feature_grid", "شارات الثقة", "Trust badges", "social"],
  ["image_text", "تحرير المجلة", "Editorial feature", "content"],
  ["image_text", "خلف الكواليس", "Behind the scenes", "content"],
  ["gallery", "شبكة إنستغرام", "Instagram grid", "media"],
  ["before_after", "صور قبل وبعد", "Before & after", "media"],
  ["testimonials", "اقتباس مميز", "Featured quote", "social"],
  ["stats", "عداد الثقة", "Trust counter", "social"],
  ["faq", "الشحن والاسترجاع", "Shipping & returns", "engagement"],
  ["newsletter", "الاشتراك بالنشرة", "Newsletter signup", "engagement"],
  ["html", "تطبيق خارجي", "Embedded app", "advanced"],
].map(([type, ar, en, category], index) => ({
  id: `${type}-${index}`,
  type: type as SectionType,
  ar,
  en,
  category,
}));

const EDITABLE_TAGS = new Set([
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "P",
  "SPAN",
  "A",
  "BUTTON",
  "LI",
  "LABEL",
  "STRONG",
  "EM",
  "SMALL",
  "FIGCAPTION",
  "BLOCKQUOTE",
]);

function isLeafText(el: Element): boolean {
  if (!EDITABLE_TAGS.has(el.tagName)) return false;
  // Leaf = only text or inline children, no block descendants
  for (const child of Array.from(el.children)) {
    if (!["SPAN", "STRONG", "EM", "SMALL", "B", "I", "U"].includes(child.tagName)) return false;
  }
  const txt = el.textContent?.trim() ?? "";
  return txt.length > 0;
}

/**
 * Wraps existing rendered children. When LiveEdit is on, walks the DOM and makes
 * text leaves contentEditable, images clickable, and persists changes to live_overrides.
 */
export function SiteInlineEditor({
  children,
  pagePath,
}: {
  children: ReactNode;
  pagePath: string;
}) {
  const { stop, pageId } = useLiveEdit();
  const { lang, toggle: toggleLanguage } = useLanguage();
  const pageEditor = usePageEditor(pageId ?? undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DraftMap>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState<{
    el: HTMLElement;
    kind: "text" | "image" | "link";
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [regions, setRegions] = useState<Array<{ label: string; el: HTMLElement }>>([]);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [blockQuery, setBlockQuery] = useState("");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [draggedSection, setDraggedSection] = useState<number | null>(null);
  const draftRef = useRef<DraftMap>({});
  const loadedOverridesRef = useRef<Awaited<ReturnType<typeof loadOverrides>>>([]);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    setPortalTarget(rootRef.current?.querySelector<HTMLElement>("#main-content") ?? null);
  }, []);

  const addedSections = pageEditor.content.sections.filter(
    (section) => section.type !== "legacy_home",
  );
  const selectedAddedSection = addedSections.find(
    (section) => section.id === pageEditor.selectedSectionId,
  );
  const visibleBlocks = useMemo(() => {
    const needle = blockQuery.trim().toLowerCase();
    return BLOCK_TEMPLATES.filter(
      (block) =>
        !needle || `${block.ar} ${block.en} ${block.category}`.toLowerCase().includes(needle),
    );
  }, [blockQuery]);

  const scopeForSelector = (selector: string) => {
    const root = rootRef.current;
    const target = root ? resolveSelector(root, selector) : null;
    if (target?.closest("footer")) return GLOBAL_FOOTER_PATH;
    if (target?.closest("[data-desktop-header]")) return GLOBAL_HEADER_PATH;
    // Everything outside the page's main content is shared storefront chrome
    // (mobile navigation, floating support, banners, and similar controls).
    // Persist it globally so editing it on one route updates every route.
    if (target && !target.closest("#main-content")) return GLOBAL_HEADER_PATH;
    return pagePath;
  };

  const setField = (selector: string, prop: OverrideProp, value: any) => {
    const currentLang = langRef.current;
    const fieldPagePath = scopeForSelector(selector);
    const next = {
      ...draftRef.current,
      [keyOf(selector, prop, currentLang, fieldPagePath)]: { selector, prop, lang: currentLang, value, pagePath: fieldPagePath },
    };
    draftRef.current = next;
    setDraft(next);
  };

  const setAnchorLink = (anchor: HTMLAnchorElement, rawUrl: string) => {
    const url = rawUrl.trim();
    const selector = computeSelector(rootRef.current!, anchor);
    anchor.setAttribute("href", url);
    setField(selector, "href", url);

    const liveId = anchor.getAttribute("data-live-id");
    const contactText = liveId === "footer-email" && /^mailto:/i.test(url)
      ? url.replace(/^mailto:/i, "").trim()
      : liveId === "footer-phone" && /^tel:/i.test(url)
        ? url.replace(/^tel:/i, "").trim()
        : null;
    if (contactText) {
      anchor.textContent = contactText;
      setField(selector, "text", contactText);
    }
  };

  const captureFocusedText = () => {
    const root = rootRef.current;
    const active = document.activeElement as HTMLElement | null;
    if (!root || !active || !root.contains(active) || active.dataset.lpeKind !== "text") return;
    setField(computeSelector(root, active), "text", active.innerText);
  };

  // Load existing drafts/published into the DOM
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let frame = 0;
    (async () => {
      const overrides = await loadOverrides(pagePath, true);
      if (cancelled) return;
      loadedOverridesRef.current = overrides;
      const root = rootRef.current;
      if (!root) return;
      const applyAll = () => {
        const current = [
          ...loadedOverridesRef.current,
          ...Object.values(draftRef.current).map((item) => ({ ...item, value: item.value })),
        ];
        for (const o of current) {
          if (o.lang && o.lang !== "*" && o.lang !== langRef.current && (o.prop === "text" || o.prop === "html")) continue;
          const el = resolveSelector(root, o.selector);
          // Do not fight the browser while the admin is typing. The value is
          // captured on blur and then becomes the newest in-memory override.
          if (el && el !== document.activeElement) applyOverrideToEl(el, o.prop, o.value);
        }
      };
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(applyAll);
      };
      applyAll();
      observer = new MutationObserver(schedule);
      observer.observe(root, { childList: true, characterData: true, subtree: true });
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pagePath, lang]);

  // Attach editing behavior
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const attach = () => {
      const all = root.querySelectorAll<HTMLElement>("*");
      all.forEach((el) => {
        if (el.closest(".lpe-added-sections")) return;
        if (el.dataset.lpeBound === "1") return;
        if (isLeafText(el)) {
          el.dataset.lpeBound = "1";
          el.dataset.lpeKind = "text";
          el.contentEditable = "true";
          el.spellcheck = false;
          el.addEventListener("focus", onFocusText);
          el.addEventListener("blur", onBlurText);
          el.addEventListener("keydown", onKey);
          el.addEventListener("click", onClickAny);
          // visual hint
          el.style.outline = "1px dashed transparent";
          el.style.outlineOffset = "2px";
          el.addEventListener("mouseenter", () => {
            el.style.outline = "1px dashed hsl(var(--primary))";
          });
          el.addEventListener("mouseleave", () => {
            if (document.activeElement !== el) el.style.outline = "1px dashed transparent";
          });
        } else if (el.tagName === "IMG") {
          el.dataset.lpeBound = "1";
          el.dataset.lpeKind = "image";
          el.style.cursor = "pointer";
          el.addEventListener("click", onClickImage);
        } else if (el.tagName === "A" && !isLeafText(el)) {
          // non-text link wrapper (e.g. image link) — allow editing href
          el.dataset.lpeBound = "1";
          el.dataset.lpeKind = "link";
        }
      });
      const regionEls = Array.from(
        root.querySelectorAll<HTMLElement>(
          "[data-desktop-header], #main-content main > section, #main-content > section, footer",
        ),
      );
      setRegions(
        regionEls.map((el, index) => ({
          el,
          label: el.matches("[data-desktop-header]")
            ? langRef.current === "ar"
              ? "الهيدر"
              : "Header"
            : el.tagName === "FOOTER"
              ? langRef.current === "ar"
                ? "الفوتر"
                : "Footer"
              : `${langRef.current === "ar" ? "قسم" : "Section"} ${index}`,
        })),
      );
    };

    function onFocusText(e: Event) {
      const el = e.currentTarget as HTMLElement;
      setSelected({ el, kind: "text" });
      setStyleOpen(true);
    }
    function onBlurText(e: Event) {
      const el = e.currentTarget as HTMLElement;
      const sel = computeSelector(root!, el);
      const value = el.innerText;
      setField(sel, "text", value);
      // Keep the clickable destination and visible footer contact value in
      // sync. Editing the phone/email must never leave an old tel:/mailto: URL.
      if (el instanceof HTMLAnchorElement) {
        const liveId = el.getAttribute("data-live-id");
        if (liveId === "footer-email") {
          const href = `mailto:${value.trim()}`;
          el.setAttribute("href", href);
          setField(sel, "href", href);
        } else if (liveId === "footer-phone") {
          const href = `tel:${value.trim()}`;
          el.setAttribute("href", href);
          setField(sel, "href", href);
        }
      }
      el.style.outline = "1px dashed transparent";
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        // prevent newlines in headings/buttons
        const tag = (e.currentTarget as HTMLElement).tagName;
        if (tag !== "P" && tag !== "LI") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }
    }
    function onClickAny(e: MouseEvent) {
      // Block link navigation while editing
      const a = (e.target as HTMLElement).closest("a");
      if (a) e.preventDefault();
    }
    function onClickImage(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLImageElement;
      setSelected({ el, kind: "image" });
      setStyleOpen(true);
      const url = window.prompt("رابط الصورة الجديد:", el.src);
      if (url && url !== el.src) {
        const sel = computeSelector(root!, el);
        el.src = url;
        setField(sel, "src", url);
      }
    }

    attach();
    const mo = new MutationObserver(() => attach());
    mo.observe(root, { childList: true, subtree: true });

    // Suppress ALL navigation while editing — capture phase on document,
    // so TanStack Link onClick handlers never fire. Also stop button submits.
    const blockNav = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Allow clicks inside the live-edit toolbar / sheets / dialogs
      if (target.closest("[data-lpe-ui]")) return;
      if (target.closest("[role=dialog]")) return;
      const a = target.closest("a");
      if (a) {
        e.preventDefault();
        e.stopPropagation();
        // Product cards are data-driven preview content rather than editable
        // link fields. Let the admin verify them without leaving and losing
        // the current editor session.
        if (a.getAttribute("data-live-navigation") === "product") {
          window.open((a as HTMLAnchorElement).href, "_blank", "noopener,noreferrer");
          return;
        }
        // If anchor wraps a non-text element (image/icon), open href editor
        if (selected?.kind !== "text") {
          const url = window.prompt("الرابط:", (a as HTMLAnchorElement).href);
          if (url && url !== (a as HTMLAnchorElement).href) {
            setAnchorLink(a as HTMLAnchorElement, url);
          }
        }
        return;
      }
      const btn = target.closest("button");
      if (btn && btn.getAttribute("type") === "submit") {
        e.preventDefault();
        e.stopPropagation();
      }
      // Track the clicked element as "selected" so the Style popover can act on it
      // even when it isn't an editable text leaf (sections, footer rows, headers).
      if (target && root && root.contains(target)) {
        setSelected({ el: target, kind: target.tagName === "IMG" ? "image" : "text" });
        setStyleOpen(true);
      }
    };
    document.addEventListener("click", blockNav, true);

    return () => {
      mo.disconnect();
      document.removeEventListener("click", blockNav, true);
    };
  }, []);

  const onSave = async () => {
    captureFocusedText();
    setSaving(true);
    const { error } = (await persistDraft(pagePath, draftRef.current)) as any;
    await pageEditor.saveDraft();
    setSaving(false);
    if (error) {
      toast.error(lang === "ar" ? "فشل حفظ المسودة" : "Could not save draft");
      return;
    }
    loadedOverridesRef.current = await loadOverrides(pagePath, true);
    draftRef.current = {};
    setDraft({});
    toast.success(lang === "ar" ? "تم حفظ المسودة" : "Draft saved");
  };

  const onPublish = async () => {
    captureFocusedText();
    setPublishing(true);
    const { error } = await publishDraft(pagePath, draftRef.current);
    await pageEditor.publish();
    setPublishing(false);
    if (error) {
      toast.error(lang === "ar" ? "فشل نشر التعديلات" : "Could not publish changes");
      return;
    }
    loadedOverridesRef.current = await loadOverrides(pagePath, true);
    draftRef.current = {};
    setDraft({});
    toast.success(lang === "ar" ? "تم النشر على المتجر" : "Published to storefront");
  };

  const onReset = async () => {
    const message =
      lang === "ar"
        ? "سيتم حذف جميع التعديلات غير المنشورة وإعادة آخر نسخة منشورة. هل أنت متأكد؟"
        : "Discard all unpublished changes and restore the last published version?";
    if (!window.confirm(message)) return;
    setSaving(true);
    const { error } = await resetDraftToPublished(pagePath);
    await pageEditor.resetToPublished();
    setSaving(false);
    if (error) {
      toast.error(
        lang === "ar" ? "تعذرت استعادة النسخة المنشورة" : "Could not restore published version",
      );
      return;
    }
    draftRef.current = {};
    setDraft({});
    const url = new URL(window.location.href);
    url.searchParams.set("edit", "1");
    window.location.replace(url.toString());
  };

  const editLink = () => {
    const el = selected?.el;
    if (!el) return;
    const a = el.closest("a") as HTMLAnchorElement | null;
    if (!a) {
      toast.message("اختر نصاً داخل رابط");
      return;
    }
    const url = window.prompt("الرابط:", a.href);
    if (url) {
      setAnchorLink(a, url);
    }
  };

  useEffect(() => {
    setSelected(null);
    setStyleOpen(false);
  }, [lang]);
  const openStyleEditor = () => {
    if (!selected?.el) {
      toast.message("اختر عنصراً أولاً");
      return;
    }
    setStyleOpen(true);
  };
  const selectedStyleInitial: StyleValue = (() => {
    if (!selected?.el) return {};
    const sel = computeSelector(rootRef.current!, selected.el);
    const key = keyOf(sel, "style", lang, scopeForSelector(sel));
    const saved = draft[key]?.value;
    return (saved && typeof saved === "object" ? saved : {}) as StyleValue;
  })();
  const onStyleChange = (next: StyleValue) => {
    if (!selected?.el) return;
    const sel = computeSelector(rootRef.current!, selected.el);
    setField(sel, "style", next);
  };

  const addBlock = (block: StudioBlock) => {
    // Always reveal the real section inspector after inserting a block.
    // Previously the element-style popover could remain active and hide it.
    setStyleOpen(false);
    setSelected(null);
    const section = createDefaultSection(block.type);
    const content = section.content as Record<string, unknown>;
    if ("title_ar" in content) content.title_ar = block.ar;
    if ("title_en" in content) content.title_en = block.en;
    // Templates are real presets, not labels pointing to the same empty block.
    if (block.en === "Split hero") content.layout = "split";
    if (block.en === "Full image banner") content.height = "xl";
    if (block.en === "Free shipping strip") {
      content.height = "sm";
      content.subtitle_ar = "شحن مجاني للطلبات المؤهلة";
      content.subtitle_en = "Free shipping on eligible orders";
      section.settings = { ...(section.settings ?? {}), backgroundColor: "#111111" };
    }
    if (block.en === "New arrivals") content.source = "newest";
    if (block.en === "Best sellers") content.source = "best_sellers";
    if (block.en === "Sale products") content.source = "sale";
    if (["Curated products", "Gift guide"].includes(block.en)) content.source = "manual";
    if (block.en === "Shop by age") content.source = "category";
    if (block.en === "Lookbook") content.columns = 2;
    if (["Instagram grid", "Customer photos"].includes(block.en)) content.columns = 4;
    if (block.en === "Featured quote" && Array.isArray(content.items)) content.items = content.items.slice(0, 1);
    pageEditor.addSection(section);
    pageEditor.notifyChange(lang === "ar" ? `تمت إضافة ${block.ar}` : `Added ${block.en}`);
    setLibraryOpen(false);
  };

  const removeCurrentRegion = (region: { label: string; el: HTMLElement }) => {
    if (
      !window.confirm(
        lang === "ar"
          ? `إخفاء «${region.label}» من الصفحة؟`
          : `Hide “${region.label}” from the page?`,
      )
    )
      return;
    const selector = computeSelector(rootRef.current!, region.el);
    region.el.style.display = "none";
    setField(selector, "style", { display: "none" });
  };

  const dirtyCount = Object.keys(draft).length;

  return (
    <div className="lpe-studio" data-lpe-ui-shell>
      <div
        ref={rootRef}
        data-live-root
        data-live-editing="true"
        className={`lpe-canvas lpe-device-${device}`}
      >
        {children}
      </div>

      {portalTarget &&
        createPortal(
          <div className="lpe-added-sections">
            {addedSections.map((section) => (
              <div
                key={section.id}
                className={`lpe-added-section ${pageEditor.selectedSectionId === section.id ? "selected" : ""}`}
                onClick={() => {
                  pageEditor.setSelectedSectionId(section.id);
                  setStyleOpen(false);
                }}
              >
                <div data-lpe-ui className="lpe-added-actions">
                  <button onClick={() => pageEditor.duplicateSection(section.id)} title="Duplicate">
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(lang === "ar" ? "حذف القسم؟" : "Delete section?"))
                        pageEditor.removeSection(section.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <PageRenderer
                  content={{ sections: [section] }}
                  device={device}
                  onSectionUpdate={pageEditor.updateSection}
                />
              </div>
            ))}
          </div>,
          portalTarget,
        )}

      {/* Floating toolbar */}
      <div
        data-lpe-ui
        data-testid="live-design-toolbar"
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="lpe-topbar"
      >
        <div className="lpe-brand">
          <small>STOREFRONT</small>
          <b>{lang === "ar" ? "محرر التصميم المرئي" : "Visual storefront editor"}</b>
        </div>
        <span className="lpe-save-state">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          {lang === "ar" ? "تعديل التصميم الحالي" : "Editing current design"}{" "}
          {dirtyCount > 0 ? `· ${dirtyCount}` : ""}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="رابط للنص المحدد"
          onClick={editLink}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="نمط العنصر (لون/خلفية/حجم)"
          onClick={openStyleEditor}
        >
          <Palette className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="سجل التعديلات والمقارنة"
          onClick={() => setHistoryOpen(true)}
        >
          <HistoryIcon className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-white hover:text-white hover:bg-white/10"
          title={lang === "ar" ? "التعديل بالإنجليزية" : "Edit in Arabic"}
          onClick={toggleLanguage}
        >
          <Languages className="h-4 w-4 me-1" /> {lang === "ar" ? "EN" : "عربي"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-white hover:text-white hover:bg-white/10"
          title={lang === "ar" ? "استعادة آخر نسخة منشورة" : "Restore published version"}
          onClick={onReset}
          disabled={saving}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={onSave}
          disabled={saving}
        >
          <Save className="h-3.5 w-3.5 me-1" /> {saving ? "..." : lang === "ar" ? "حفظ" : "Save"}
        </Button>
        <Button
          size="sm"
          className="lpe-publish-button h-9 px-4 font-bold"
          onClick={onPublish}
          disabled={publishing}
        >
          <Upload className="h-3.5 w-3.5 me-1" />{" "}
          {publishing ? "..." : lang === "ar" ? "نشر" : "Publish"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-white hover:text-white hover:bg-white/10"
          title={lang === "ar" ? "خروج" : "Exit"}
          onClick={() => {
            if (
              dirtyCount > 0 &&
              !confirm(
                lang === "ar"
                  ? "هناك تغييرات غير محفوظة. الخروج دون حفظ؟"
                  : "You have unsaved changes. Exit without saving?",
              )
            )
              return;
            stop();
            const url = new URL(window.location.href);
            url.searchParams.delete("edit");
            window.location.replace(url.toString());
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <aside data-lpe-ui className="lpe-sections-panel">
        <div className="lpe-panel-heading">
          <LayoutTemplate size={16} />
          <div>
            <b>{lang === "ar" ? "أقسام الصفحة الحالية" : "Current page sections"}</b>
            <small>
              {lang === "ar" ? "اختر قسمًا أو عنصرًا للتعديل" : "Select a section or element"}
            </small>
          </div>
        </div>
        <div className="lpe-region-list">
          {regions.map((region, index) => (
            <div className="lpe-region-row" key={`${region.label}-${index}`}>
              <button
                className={selected?.el === region.el ? "active" : ""}
                onClick={() => {
                  region.el.scrollIntoView({ behavior: "smooth", block: "center" });
                  setSelected({ el: region.el, kind: "text" });
                  setStyleOpen(true);
                }}
              >
                <GripVertical size={14} />
                <span>{index + 1}</span>
                <b>{region.label}</b>
              </button>
              <button
                className="lpe-delete-region"
                onClick={() => removeCurrentRegion(region)}
                title={lang === "ar" ? "إخفاء القسم" : "Hide section"}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {addedSections.map((section, index) => {
            const realIndex = pageEditor.content.sections.findIndex(
              (item) => item.id === section.id,
            );
            return (
              <div
                className="lpe-region-row lpe-added-row"
                key={section.id}
                draggable
                onDragStart={() => setDraggedSection(realIndex)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedSection !== null) pageEditor.moveSection(draggedSection, realIndex);
                  setDraggedSection(null);
                }}
              >
                <button
                  className={pageEditor.selectedSectionId === section.id ? "active" : ""}
                  onClick={() => {
                    pageEditor.setSelectedSectionId(section.id);
                    setStyleOpen(false);
                  }}
                >
                  <GripVertical size={14} />
                  <span>{regions.length + index + 1}</span>
                  <b>
                    {lang === "ar" ? "قسم مضاف" : "Added section"} · {section.type}
                  </b>
                </button>
                <div className="lpe-row-actions">
                  <button
                    onClick={() => pageEditor.moveSection(realIndex, Math.max(0, realIndex - 1))}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() =>
                      pageEditor.moveSection(
                        realIndex,
                        Math.min(pageEditor.content.sections.length - 1, realIndex + 1),
                      )
                    }
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => pageEditor.duplicateSection(section.id)}>
                    <Copy size={12} />
                  </button>
                  <button onClick={() => pageEditor.removeSection(section.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button className="lpe-library-button" onClick={() => setLibraryOpen(true)}>
          <Plus size={16} />
          {lang === "ar" ? "إضافة قسم من المكتبة" : "Add section from library"}
        </button>
        <div className="lpe-sidebar-tip">
          <b>{lang === "ar" ? "تعديل مباشر" : "Direct editing"}</b>
          <p>
            {lang === "ar"
              ? "اضغط على أي نص لتغييره، أو على أي عنصر لفتح إعداداته التفصيلية."
              : "Click any text to edit it, or any element to open detailed settings."}
          </p>
        </div>
      </aside>

      <div data-lpe-ui className="lpe-preview-tools">
        <span>
          <CheckCircle2 size={14} />{" "}
          {lang === "ar" ? "معاينة التصميم الحالي" : "Current design preview"}
        </span>
        <div>
          <button
            className={device === "desktop" ? "active" : ""}
            onClick={() => setDevice("desktop")}
          >
            <Monitor size={14} />
          </button>
          <button
            className={device === "tablet" ? "active" : ""}
            onClick={() => setDevice("tablet")}
          >
            <Tablet size={14} />
          </button>
          <button
            className={device === "mobile" ? "active" : ""}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone size={14} />
          </button>
        </div>
      </div>

      {selectedAddedSection && !styleOpen && (
        <aside data-lpe-ui className="lpe-section-inspector">
          <div className="lpe-inspector-title">
            <small>SECTION SETTINGS</small>
            <h3>{lang === "ar" ? "تخصيص القسم" : "Customize section"}</h3>
          </div>
          <SectionEditor
            section={selectedAddedSection}
            onChange={(updater, opts) =>
              pageEditor.updateSection(selectedAddedSection.id, updater, opts)
            }
            notify={pageEditor.notifyChange}
          />
        </aside>
      )}

      {!styleOpen && !selectedAddedSection && (
        <aside data-lpe-ui className="lpe-empty-inspector">
          <Palette size={24} />
          <h3>{lang === "ar" ? "اختر عنصرًا من الموقع" : "Select an element"}</h3>
          <p>
            {lang === "ar"
              ? "ستظهر هنا جميع إعدادات النص والألوان والمسافات والتخطيط والتأثيرات."
              : "Text, color, spacing, layout and effect controls will appear here."}
          </p>
        </aside>
      )}

      {libraryOpen && (
        <div data-lpe-ui className="lpe-library-backdrop" onMouseDown={() => setLibraryOpen(false)}>
          <section className="lpe-library-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>BLOCK LIBRARY</small>
                <h2>{lang === "ar" ? "أضف شيئًا استثنائيًا" : "Add something exceptional"}</h2>
                <p>
                  {lang === "ar"
                    ? `${BLOCK_TEMPLATES.length} قسمًا جاهزًا وقابلًا للتخصيص بالكامل`
                    : `${BLOCK_TEMPLATES.length} fully customizable sections`}
                </p>
              </div>
              <button onClick={() => setLibraryOpen(false)}>
                <X size={19} />
              </button>
            </header>
            <div className="lpe-library-search">
              <Search size={16} />
              <input
                value={blockQuery}
                onChange={(event) => setBlockQuery(event.target.value)}
                placeholder={lang === "ar" ? "ابحث في الأقسام…" : "Search sections…"}
                autoFocus
              />
            </div>
            <div className="lpe-block-grid">
              {visibleBlocks.map((block) => (
                <button key={block.id} onClick={() => addBlock(block)}>
                  <span className={`lpe-block-icon block-${block.type}`}>
                    <LayoutTemplate size={20} />
                  </span>
                  <span>
                    <b>{lang === "ar" ? block.ar : block.en}</b>
                    <small>{block.category}</small>
                  </span>
                  <Plus size={15} />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <HistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} pagePath={pagePath} />

      {styleOpen && selected?.el && (
        <StylePopover
          el={selected.el}
          initial={selectedStyleInitial}
          onChange={onStyleChange}
          onClose={() => setStyleOpen(false)}
        />
      )}
    </div>
  );
}
