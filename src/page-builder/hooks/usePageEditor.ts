import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isPageContent, type CmsPage, type PageContent, EMPTY_PAGE_CONTENT, type Section } from "../schemas/pageSchema";

const MAX_HISTORY = 50;

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

  const historyRef = useRef<PageContent[]>([]);
  const futureRef = useRef<PageContent[]>([]);
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

  const pushHistory = useCallback((prev: PageContent) => {
    historyRef.current.push(prev);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    futureRef.current = [];
  }, []);

  const updateContent = useCallback((updater: (c: PageContent) => PageContent) => {
    setContent((curr) => {
      pushHistory(curr);
      const next = updater(curr);
      setDirty(true);
      return next;
    });
  }, [pushHistory]);

  const updateSection = useCallback((sectionId: string, updater: (s: Section) => Section) => {
    updateContent((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === sectionId ? updater(s) : s)),
    }));
  }, [updateContent]);

  const addSection = useCallback((s: Section, index?: number) => {
    updateContent((c) => {
      const arr = [...c.sections];
      if (typeof index === "number") arr.splice(index, 0, s);
      else arr.push(s);
      return { ...c, sections: arr };
    });
    setSelectedSectionId(s.id);
  }, [updateContent]);

  const removeSection = useCallback((id: string) => {
    updateContent((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== id) }));
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
    });
  }, [updateContent]);

  const moveSection = useCallback((fromIdx: number, toIdx: number) => {
    updateContent((c) => {
      const arr = [...c.sections];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...c, sections: arr };
    });
  }, [updateContent]);

  const undo = useCallback(() => {
    setContent((curr) => {
      const prev = historyRef.current.pop();
      if (!prev) return curr;
      futureRef.current.push(curr);
      setDirty(true);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setContent((curr) => {
      const next = futureRef.current.pop();
      if (!next) return curr;
      historyRef.current.push(curr);
      setDirty(true);
      return next;
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

  return {
    page, content, loading, saving, publishing, dirty,
    lastSavedAt, autoSaveEnabled, setAutoSaveEnabled,
    selectedSectionId, setSelectedSectionId,
    updateContent, updateSection, addSection, removeSection, duplicateSection, moveSection,
    updatePageMeta, undo, redo, notifyChange,
    saveDraft: () => saveDraft(false),
    publish,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
