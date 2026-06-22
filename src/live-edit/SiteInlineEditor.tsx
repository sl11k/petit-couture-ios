import { useEffect, useRef, useState, type ReactNode } from "react";
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
  type DraftMap,
  type OverrideProp,
} from "./overrides";
import "./live-editor.css";

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
  const { stop } = useLiveEdit();
  const { lang, toggle: toggleLanguage } = useLanguage();
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
  const draftRef = useRef<DraftMap>({});
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const setField = (selector: string, prop: OverrideProp, value: any) => {
    const currentLang = langRef.current;
    const next = {
      ...draftRef.current,
      [keyOf(selector, prop, currentLang)]: { selector, prop, lang: currentLang, value },
    };
    draftRef.current = next;
    setDraft(next);
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
    (async () => {
      const overrides = await loadOverrides(pagePath, true);
      if (cancelled) return;
      const root = rootRef.current;
      if (!root) return;
      for (const o of overrides) {
        if (o.lang && o.lang !== lang && (o.prop === "text" || o.prop === "html")) continue;
        const el = resolveSelector(root, o.selector);
        if (el) applyOverrideToEl(el, o.prop, o.value);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagePath, lang]);

  // Attach editing behavior
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const attach = () => {
      const all = root.querySelectorAll<HTMLElement>("*");
      all.forEach((el) => {
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
        // If anchor wraps a non-text element (image/icon), open href editor
        if (selected?.kind !== "text") {
          const url = window.prompt("الرابط:", (a as HTMLAnchorElement).href);
          if (url && url !== (a as HTMLAnchorElement).href) {
            const sel = computeSelector(root!, a);
            (a as HTMLAnchorElement).href = url;
            setField(sel, "href", url);
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
    setSaving(false);
    if (error) {
      toast.error(lang === "ar" ? "فشل حفظ المسودة" : "Could not save draft");
      return;
    }
    draftRef.current = {};
    setDraft({});
    toast.success(lang === "ar" ? "تم حفظ المسودة" : "Draft saved");
  };

  const onPublish = async () => {
    captureFocusedText();
    setPublishing(true);
    const { error } = await publishDraft(pagePath, draftRef.current);
    setPublishing(false);
    if (error) {
      toast.error(lang === "ar" ? "فشل نشر التعديلات" : "Could not publish changes");
      return;
    }
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
      const sel = computeSelector(rootRef.current!, a);
      a.href = url;
      setField(sel, "href", url);
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
    const key = keyOf(sel, "style", lang);
    const saved = draft[key]?.value;
    return (saved && typeof saved === "object" ? saved : {}) as StyleValue;
  })();
  const onStyleChange = (next: StyleValue) => {
    if (!selected?.el) return;
    const sel = computeSelector(rootRef.current!, selected.el);
    setField(sel, "style", next);
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
          className="h-8 bg-white text-[#211b1d] hover:bg-white/90"
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
            <button
              key={`${region.label}-${index}`}
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
          ))}
        </div>
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

      {!styleOpen && (
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
