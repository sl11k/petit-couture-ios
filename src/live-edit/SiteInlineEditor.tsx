import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Save, Upload, X, Link as LinkIcon, History as HistoryIcon, Palette } from "lucide-react";
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
  keyOf,
  type DraftMap,
  type OverrideProp,
} from "./overrides";

const EDITABLE_TAGS = new Set([
  "H1","H2","H3","H4","H5","H6","P","SPAN","A","BUTTON","LI","LABEL","STRONG","EM","SMALL","FIGCAPTION","BLOCKQUOTE",
]);

function isLeafText(el: Element): boolean {
  if (!EDITABLE_TAGS.has(el.tagName)) return false;
  // Leaf = only text or inline children, no block descendants
  for (const child of Array.from(el.children)) {
    if (!["SPAN","STRONG","EM","SMALL","B","I","U"].includes(child.tagName)) return false;
  }
  const txt = el.textContent?.trim() ?? "";
  return txt.length > 0;
}

/**
 * Wraps existing rendered children. When LiveEdit is on, walks the DOM and makes
 * text leaves contentEditable, images clickable, and persists changes to live_overrides.
 */
export function SiteInlineEditor({ children, pagePath }: { children: ReactNode; pagePath: string }) {
  const { stop } = useLiveEdit();
  const { lang } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DraftMap>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState<{ el: HTMLElement; kind: "text" | "image" | "link" } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const setField = (selector: string, prop: OverrideProp, value: any) => {
    setDraft((d) => ({ ...d, [keyOf(selector, prop, lang)]: { selector, prop, lang, value } }));
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
    return () => { cancelled = true; };
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
          el.addEventListener("mouseenter", () => { el.style.outline = "1px dashed hsl(var(--primary))"; });
          el.addEventListener("mouseleave", () => { if (document.activeElement !== el) el.style.outline = "1px dashed transparent"; });
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
    };

    function onFocusText(e: Event) {
      const el = e.currentTarget as HTMLElement;
      setSelected({ el, kind: "text" });
    }
    function onBlurText(e: Event) {
      const el = e.currentTarget as HTMLElement;
      const sel = computeSelector(root!, el);
      const value = el.innerText;
      setField(sel, "text", value);
      el.style.outline = "1px dashed transparent";
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !(e.shiftKey)) {
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
    };
    document.addEventListener("click", blockNav, true);

    return () => {
      mo.disconnect();
      document.removeEventListener("click", blockNav, true);
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    const { error } = (await persistDraft(pagePath, draft)) as any;
    setSaving(false);
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success("حُفظت كمسودة");
  };

  const onPublish = async () => {
    setPublishing(true);
    await publishDraft(pagePath, draft);
    setPublishing(false);
    toast.success("تم النشر");
  };

  const editLink = () => {
    const el = selected?.el;
    if (!el) return;
    const a = el.closest("a") as HTMLAnchorElement | null;
    if (!a) { toast.message("اختر نصاً داخل رابط"); return; }
    const url = window.prompt("الرابط:", a.href);
    if (url) {
      const sel = computeSelector(rootRef.current!, a);
      a.href = url;
      setField(sel, "href", url);
    }
  };

  const [styleOpen, setStyleOpen] = useState(false);
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
    <>
      <div ref={rootRef} data-live-root>
        {children}
      </div>

      {/* Floating toolbar */}
      <div data-lpe-ui className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur px-3 py-2 shadow-2xl">
        <span className="text-[11px] text-muted-foreground me-2">
          تحرير مباشر (هيدر · محتوى · فوتر) {dirtyCount > 0 ? `● ${dirtyCount} تغيير` : ""}
        </span>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="رابط للنص المحدد" onClick={editLink}>
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="سجل التعديلات والمقارنة" onClick={() => setHistoryOpen(true)}>
          <HistoryIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button size="sm" variant="outline" className="h-8" onClick={onSave} disabled={saving || !dirtyCount}>
          <Save className="h-3.5 w-3.5 me-1" /> {saving ? "..." : "حفظ"}
        </Button>
        <Button size="sm" className="h-8" onClick={onPublish} disabled={publishing}>
          <Upload className="h-3.5 w-3.5 me-1" /> {publishing ? "..." : "نشر"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="خروج"
          onClick={() => {
            if (dirtyCount > 0 && !confirm("هناك تغييرات غير محفوظة. الخروج؟")) return;
            stop();
            window.location.reload();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <HistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} pagePath={pagePath} />
    </>
  );
}
