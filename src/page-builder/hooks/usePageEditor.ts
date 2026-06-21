import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isPageContent, type CmsPage, type PageContent, EMPTY_PAGE_CONTENT, type Section } from "../schemas/pageSchema";
import { getDefaultSectionsForPage } from "../utils/pageDefaults";

const MAX_HISTORY = 100;
const COALESCE_MS = 700;

type HistoryEntry = { snap: PageContent; label: string; key?: string; ts: number };
export type HistoryItem = { index: number; label: string; ts: number };

export type UpdateOpts = { label?: string; key?: string };

export function usePageEditor(pageId: string | undefined) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [content, setContent] = useState<PageContent>(EMPTY_PAGE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  // bumped on every history mutation so consumers re-render
  const [histVer, setHistVer] = useState(0);

  const historyRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const pageRef = useRef<CmsPage | null>(null);
  const contentRef = useRef<PageContent>(EMPTY_PAGE_CONTENT);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { contentRef.current = content; }, [content]);

  // Load
  useEffect(() => {
    if (!pageId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("cms_pages")
        .select("*")
        .eq("id", pageId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("تعذر تحميل الصفحة");
        setLoading(false);
        return;
      }
      const p = data as unknown as CmsPage;
      setPage(p);
      const initial = isPageContent(p.draft_content) ? p.draft_content : EMPTY_PAGE_CONTENT;
      setContent(initial);
      historyRef.current = [];
      futureRef.current = [];
      setHistVer((v) => v + 1);
      setDirty(false);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pageId]);

  // Warn on unload
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const pushHistory = useCallback((prev: PageContent, opts?: UpdateOpts) => {
    const key = opts?.key;
    const label = opts?.label ?? "تعديل";
    const now = Date.now();
    const last = historyRef.current[historyRef.current.length - 1];
    if (key && last && last.key === key && now - last.ts < COALESCE_MS) {
      // keep the older snapshot as the undo target; just refresh ts/label
      last.ts = now;
      last.label = label;
      futureRef.current = [];
      setHistVer((v) => v + 1);
      return;
    }
    historyRef.current.push({ snap: prev, label, key, ts: now });
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    futureRef.current = [];
    setHistVer((v) => v + 1);
  }, []);

  const updateContent = useCallback((updater: (c: PageContent) => PageContent, opts?: UpdateOpts) => {
    setContent((curr) => {
      pushHistory(curr, opts);
      const next = updater(curr);
      setDirty(true);
      return next;
    });
  }, [pushHistory]);

  const updateSection = useCallback((sectionId: string, updater: (s: Section) => Section, opts?: UpdateOpts) => {
    updateContent((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === sectionId ? updater(s) : s)),
    }), opts);
  }, [updateContent]);

  const addSection = useCallback((s: Section, index?: number) => {
    updateContent((c) => {
      const arr = [...c.sections];
      if (typeof index === "number") arr.splice(index, 0, s);
      else arr.push(s);
      return { ...c, sections: arr };
    }, { label: `إضافة قسم: ${s.type}` });
    setSelectedSectionId(s.id);
  }, [updateContent]);

  const removeSection = useCallback((id: string) => {
    updateContent((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== id) }), { label: "حذف قسم" });
    setSelectedSectionId((cur) => (cur === id ? null : cur));
  }, [updateContent]);

  const duplicateSection = useCallback((id: string) => {
    updateContent((c) => {
      const idx = c.sections.findIndex((s) => s.id === id);
      if (idx === -1) return c;
      const copy = JSON.parse(JSON.stringify(c.sections[idx])) as Section;
      copy.id = `${copy.type}-${Date.now()}`;
      const arr = [...c.sections];
      arr.splice(idx + 1, 0, copy);
      return { ...c, sections: arr };
    }, { label: "تكرار قسم" });
  }, [updateContent]);

  const moveSection = useCallback((fromIdx: number, toIdx: number) => {
    updateContent((c) => {
      const arr = [...c.sections];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...c, sections: arr };
    }, { label: "إعادة ترتيب الأقسام", key: "reorder" });
  }, [updateContent]);

  const undo = useCallback(() => {
    setContent((curr) => {
      const prev = historyRef.current.pop();
      if (!prev) return curr;
      futureRef.current.push({ snap: curr, label: prev.label, key: prev.key, ts: Date.now() });
      setDirty(true);
      setHistVer((v) => v + 1);
      return prev.snap;
    });
  }, []);

  const redo = useCallback(() => {
    setContent((curr) => {
      const next = futureRef.current.pop();
      if (!next) return curr;
      historyRef.current.push({ snap: curr, label: next.label, key: next.key, ts: Date.now() });
      setDirty(true);
      setHistVer((v) => v + 1);
      return next.snap;
    });
  }, []);

  // Jump back to a specific history index (0 = oldest). Anything newer goes to future stack.
  const jumpToHistory = useCallback((index: number) => {
    setContent((curr) => {
      const h = historyRef.current;
      if (index < 0 || index >= h.length) return curr;
      const target = h[index];
      // Move entries above index (newer) + the current state onto future stack (reversed for proper redo order)
      const removed = h.splice(index, h.length - index);
      // removed[0] is the target snapshot; subsequent entries are newer.
      // After jump, the current state should be target.snap, and undoing further goes to older snapshots already in h.
      // Build future from removed[1..] + current
      const newer = removed.slice(1).map((e) => e); // each e.snap is a previous content state newer than target
      // To produce proper redo order: redo pops from end of futureRef.
      // Future stack should be ordered so that the FIRST redo restores the oldest newer state.
      // pop() returns last element, so place oldest at the end. newer is already oldest→newest, so push reversed.
      futureRef.current = [
        { snap: curr, label: "الحالة الحالية", key: undefined, ts: Date.now() },
        ...newer.map((e) => ({ snap: e.snap, label: e.label, key: e.key, ts: e.ts })),
      ].reverse();
      setDirty(true);
      setHistVer((v) => v + 1);
      return target.snap;
    });
  }, []);

  // Debounced "last change" toast with quick-undo button.
  const undoRef = useRef(undo);
  useEffect(() => { undoRef.current = undo; }, [undo]);
  const pendingLabelRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyChange = useCallback((label: string) => {
    pendingLabelRef.current = label;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      const l = pendingLabelRef.current;
      if (!l) return;
      pendingLabelRef.current = null;
      toast(l, {
        duration: 3500,
        action: { label: "تراجع", onClick: () => undoRef.current?.() },
      });
    }, 500);
  }, []);

  const updatePageMeta = useCallback((patch: Partial<CmsPage>) => {
    setPage((p) => (p ? { ...p, ...patch } : p));
    setDirty(true);
  }, []);


  const saveDraft = useCallback(async (silent = false) => {
    const page = pageRef.current;
    const content = contentRef.current;
    if (!page) return;
    setSaving(true);
    const { error } = await supabase
      .from("cms_pages")
      .update({
        draft_content: content as any,
        title_ar: page.title_ar,
        title_en: page.title_en,
        slug: page.slug,
        seo_title_ar: page.seo_title_ar,
        seo_title_en: page.seo_title_en,
        seo_description_ar: page.seo_description_ar,
        seo_description_en: page.seo_description_en,
        og_image_url: page.og_image_url,
        noindex: page.noindex,
        canonical_url: page.canonical_url,
      })
      .eq("id", page.id);
    setSaving(false);
    if (error) { if (!silent) toast.error("فشل حفظ المسودة: " + error.message); return; }
    setDirty(false);
    setLastSavedAt(new Date());
    if (!silent) toast.success("تم حفظ المسودة");
  }, []);

  // Auto-save draft 1.5s after the last change (silent).
  useEffect(() => {
    if (!autoSaveEnabled || !dirty || !page) return;
    const t = setTimeout(() => { saveDraft(true); }, 1500);
    return () => clearTimeout(t);
  }, [content, page, dirty, autoSaveEnabled, saveDraft]);

  const publish = useCallback(async () => {
    if (!page) return;
    setPublishing(true);
    const { error } = await supabase
      .from("cms_pages")
      .update({
        draft_content: content as any,
        published_content: content as any,
        status: "published",
        published_at: new Date().toISOString(),
        title_ar: page.title_ar,
        title_en: page.title_en,
        slug: page.slug,
        seo_title_ar: page.seo_title_ar,
        seo_title_en: page.seo_title_en,
        seo_description_ar: page.seo_description_ar,
        seo_description_en: page.seo_description_en,
        og_image_url: page.og_image_url,
        noindex: page.noindex,
        canonical_url: page.canonical_url,
      })
      .eq("id", page.id);
    if (!error) {
      await supabase.from("cms_page_versions").insert({
        page_id: page.id,
        content: content as any,
        version_label: `Published ${new Date().toLocaleString()}`,
      });
    }
    setPublishing(false);
    if (error) { toast.error("فشل النشر: " + error.message); return; }
    setDirty(false);
    setPage({ ...page, status: "published", published_content: content, published_at: new Date().toISOString() });
    toast.success("تم النشر — التغييرات ظاهرة على الموقع الآن");
  }, [page, content]);

  // Derive reactive history list for UI (most-recent first)
  const historyItems: HistoryItem[] = (() => {
    // referenced histVer to recompute
    void histVer;
    const h = historyRef.current;
    // Each entry's snapshot represents the state BEFORE that labeled change.
    // To "jump back to right after action X", we want to restore the snapshot AFTER X — which means jumping to index of the entry that was pushed by the NEXT change. Simpler: show labels as "undo to before X" — jumpToHistory(index) restores h[index].snap.
    return h.map((e, i) => ({ index: i, label: e.label, ts: e.ts })).reverse();
  })();

  return {
    page, content, loading, saving, publishing, dirty,
    lastSavedAt, autoSaveEnabled, setAutoSaveEnabled,
    selectedSectionId, setSelectedSectionId,
    updateContent, updateSection, addSection, removeSection, duplicateSection, moveSection,
    updatePageMeta, undo, redo, jumpToHistory, notifyChange,
    historyItems,
    saveDraft: () => saveDraft(false),
    publish,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
