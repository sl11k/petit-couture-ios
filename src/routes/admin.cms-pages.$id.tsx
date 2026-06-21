import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Upload, Undo2, Redo2, Eye, Monitor, Tablet, Smartphone, Copy, Trash2, Settings, Layers, History, MousePointerClick, GripVertical, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageEditor } from "@/page-builder/hooks/usePageEditor";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { SectionEditor } from "@/page-builder/components/SectionEditor";
import { PageSettingsPanel } from "@/page-builder/components/PageSettingsPanel";
import { SECTION_TYPES, createDefaultSection } from "@/page-builder/utils/pageDefaults";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, useDraggable, useDroppable, type DragEndEvent, DragOverlay } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Section } from "@/page-builder/schemas/pageSchema";

export const Route = createFileRoute("/admin/cms-pages/$id")({
  component: PageEditor,
});

type Device = "desktop" | "tablet" | "mobile";
type RightTab = "section" | "page" | "library";

function PageEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const ed = usePageEditor(id);
  const [device, setDevice] = useState<Device>("desktop");
  const [rightTab, setRightTab] = useState<RightTab>("library");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    if (ed.selectedSectionId) setRightTab("section");
  }, [ed.selectedSectionId]);

  // Keyboard shortcuts: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl+Y (redo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable;
      // allow Z/Y shortcuts even in inputs — that's the standard editor UX
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        ed.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        ed.redo();
      } else if (k === "s" && !e.shiftKey) {
        e.preventDefault();
        ed.saveDraft();
      } else {
        void isEditable;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ed]);


  const loadVersions = async () => {
    if (!ed.page) return;
    const { data } = await supabase.from("cms_page_versions").select("*").eq("page_id", ed.page.id).order("created_at", { ascending: false }).limit(50);
    setVersions(data ?? []);
  };

  const restoreVersion = (v: any) => {
    if (!confirm("استعادة هذا الإصدار كمسودة؟ سيتم استبدال المحتوى الحالي.")) return;
    ed.updateContent(() => v.content);
    setVersionsOpen(false);
    toast.success("تم تحميل الإصدار. اضغط حفظ أو نشر للتطبيق.");
  };

  const selectedSection = ed.content.sections.find((s) => s.id === ed.selectedSectionId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current as any;
    const overData = over.data.current as any;

    // 1. Dragging from palette → insert at drop position
    if (activeData?.source === "palette") {
      const newSection = createDefaultSection(activeData.sectionType);
      const sections = ed.content.sections;
      let insertIdx = sections.length;
      if (overData?.type === "section") {
        insertIdx = sections.findIndex((s) => s.id === over.id);
        if (insertIdx === -1) insertIdx = sections.length;
      } else if (over.id === "canvas-empty" || over.id === "canvas-end") {
        insertIdx = sections.length;
      }
      ed.addSection(newSection, insertIdx);
      ed.notifyChange(`تمت إضافة بلوك`);
      return;
    }

    // 2. Reordering existing sections
    if (active.id === over.id) return;
    const oldIdx = ed.content.sections.findIndex((s) => s.id === active.id);
    const newIdx = ed.content.sections.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    ed.updateContent((c) => ({ ...c, sections: arrayMove(c.sections, oldIdx, newIdx) }));
    ed.notifyChange("تمت إعادة ترتيب الأقسام");
  };

  const convertLegacyToEditable = () => {
    if (!confirm("سيتم استبدال قسم 'الصفحة الرئيسية الحالية' بأقسام جاهزة قابلة للتعديل (هيرو، مزايا، آراء، أسئلة، CTA). متابعة؟")) return;
    const defaults: Section[] = [
      createDefaultSection("hero"),
      createDefaultSection("feature_grid"),
      createDefaultSection("testimonials"),
      createDefaultSection("faq"),
      createDefaultSection("cta"),
    ];
    ed.updateContent((c) => ({
      ...c,
      sections: c.sections.flatMap((s) => (s.type === "legacy_home" ? defaults : [s])),
    }));
    ed.setSelectedSectionId(defaults[0].id);
    toast.success("تم التحويل — كل قسم الآن قابل للتعديل بالكامل");
  };

  if (ed.loading) {
    return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  }
  if (!ed.page) {
    return <div className="p-8 text-center text-destructive">الصفحة غير موجودة. <Link className="underline" to="/admin/cms-pages">العودة</Link></div>;
  }

  const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "390px";

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background" dir={ar ? "rtl" : "ltr"}>
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/admin/cms-pages" })}>
            <ArrowLeft className="h-4 w-4 me-1" /> رجوع
          </Button>
          <div className="text-sm font-medium truncate">{ar ? ed.page.title_ar : ed.page.title_en}</div>
          {ed.saving ? (
            <span className="text-xs text-muted-foreground animate-pulse">جاري الحفظ…</span>
          ) : ed.dirty ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">● تغييرات غير محفوظة</span>
          ) : ed.lastSavedAt ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ محفوظ تلقائياً</span>
          ) : null}
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer select-none ms-2">
            <input
              type="checkbox"
              checked={ed.autoSaveEnabled}
              onChange={(e) => ed.setAutoSaveEnabled(e.target.checked)}
              className="h-3 w-3 accent-primary"
            />
            حفظ تلقائي
          </label>
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={!ed.canUndo} onClick={ed.undo} title="تراجع (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" disabled={!ed.canRedo} onClick={ed.redo} title="إعادة (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" title="سجل التعديلات" disabled={ed.historyItems.length === 0}>
                <Clock className="h-4 w-4" />
                {ed.historyItems.length > 0 && (
                  <span className="ms-1 text-[10px] tabular-nums text-muted-foreground">{ed.historyItems.length}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="px-3 py-2 border-b border-border text-xs font-medium flex items-center justify-between">
                <span>سجل التعديلات</span>
                <span className="text-[10px] text-muted-foreground">{ed.historyItems.length} خطوة</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {ed.historyItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا يوجد تعديلات بعد</p>
                ) : ed.historyItems.map((h) => (
                  <button
                    key={h.index + ":" + h.ts}
                    onClick={() => ed.jumpToHistory(h.index)}
                    className="w-full text-start px-3 py-1.5 text-xs hover:bg-muted flex items-center justify-between gap-2 border-b border-border/40 last:border-0"
                  >
                    <span className="truncate">{h.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {new Date(h.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </button>
                ))}
              </div>
              {ed.canRedo && (
                <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
                  يمكن إعادة {/* canRedo */} الخطوات الملغاة بزر الإعادة (Ctrl+Shift+Z)
                </div>
              )}
            </PopoverContent>
          </Popover>


          <div className="mx-2 flex rounded-md border border-border">
            <button onClick={() => setDevice("desktop")} className={cn("p-1.5", device === "desktop" && "bg-muted")} title="سطح المكتب"><Monitor className="h-3.5 w-3.5" /></button>
            <button onClick={() => setDevice("tablet")} className={cn("p-1.5", device === "tablet" && "bg-muted")} title="تابلت"><Tablet className="h-3.5 w-3.5" /></button>
            <button onClick={() => setDevice("mobile")} className={cn("p-1.5", device === "mobile" && "bg-muted")} title="موبايل"><Smartphone className="h-3.5 w-3.5" /></button>
          </div>

          <Button size="sm" variant="ghost" onClick={() => { loadVersions(); setVersionsOpen(true); }} title="الإصدارات"><History className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" asChild title="معاينة مباشرة">
            <a href={ed.page.slug === "home" ? "/" : `/page/${ed.page.slug}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>
          </Button>
          <Button size="sm" variant="outline" onClick={ed.saveDraft} disabled={ed.saving}>
            <Save className="h-4 w-4 me-1" /> {ed.saving ? "جاري..." : "حفظ مسودة"}
          </Button>
          <Button size="sm" onClick={ed.publish} disabled={ed.publishing}>
            <Upload className="h-4 w-4 me-1" /> {ed.publishing ? "جاري..." : "نشر"}
          </Button>
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 min-h-0">
          {/* Left: section library (draggable palette) */}
          <aside className="w-56 border-e border-border bg-card overflow-y-auto p-3">
            <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">مكتبة البلوكات</h3>
            <p className="text-[10px] text-muted-foreground mb-2">اسحب البلوك للصفحة أو انقر للإضافة في النهاية</p>
            <div className="grid grid-cols-2 gap-2">
              {SECTION_TYPES.map((st) => (
                <PaletteItem
                  key={st.type}
                  type={st.type}
                  icon={st.icon}
                  label={ar ? st.label_ar : st.label_en}
                  onClick={() => {
                    ed.addSection(createDefaultSection(st.type));
                    ed.notifyChange(`تمت إضافة "${ar ? st.label_ar : st.label_en}"`);
                  }}
                />
              ))}
            </div>
          </aside>

          {/* Center: canvas */}
          <main className="flex-1 overflow-auto bg-muted/30 p-4">
            <div
              className="mx-auto bg-background shadow-lg rounded-lg overflow-hidden transition-all"
              style={{ width: deviceWidth, maxWidth: "100%" }}
            >
              {ed.content.sections.length === 0 ? (
                <CanvasDropZone id="canvas-empty">
                  <div className="p-16 text-center text-muted-foreground">
                    <MousePointerClick className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">اسحب بلوكاً من اليمين، أو انقر عليه للإضافة.</p>
                  </div>
                </CanvasDropZone>
              ) : (
                <SortableContext items={ed.content.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {ed.content.sections.map((s) => (
                    <SortableSection
                      key={s.id}
                      section={s}
                      device={device}
                      selected={s.id === ed.selectedSectionId}
                      onSelect={() => ed.setSelectedSectionId(s.id)}
                      onDuplicate={() => { ed.duplicateSection(s.id); ed.notifyChange("تم تكرار القسم"); }}
                      onDelete={() => { if (confirm("حذف القسم؟")) { ed.removeSection(s.id); ed.notifyChange("تم حذف القسم"); } }}
                      onSectionUpdate={ed.updateSection}
                    />
                  ))}
                  <CanvasDropZone id="canvas-end">
                    <div className="h-10 border-t-2 border-dashed border-transparent hover:border-primary/40 transition" />
                  </CanvasDropZone>
                </SortableContext>
              )}
            </div>
          </main>

        {/* Right: properties */}
        <aside className="w-80 border-s border-border bg-card flex flex-col">
          <div className="flex border-b border-border">
            <button onClick={() => setRightTab("section")} className={cn("flex-1 px-3 py-2 text-xs flex items-center justify-center gap-1", rightTab === "section" && "bg-muted font-medium")}>
              <Layers className="h-3 w-3" /> القسم
            </button>
            <button onClick={() => setRightTab("page")} className={cn("flex-1 px-3 py-2 text-xs flex items-center justify-center gap-1", rightTab === "page" && "bg-muted font-medium")}>
              <Settings className="h-3 w-3" /> الصفحة
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {rightTab === "section" ? (
              selectedSection ? (
                <SectionEditor
                  section={selectedSection}
                  onChange={(updater, opts) => ed.updateSection(selectedSection.id, updater, opts)}
                  onConvertLegacy={selectedSection.type === "legacy_home" ? convertLegacyToEditable : undefined}
                  notify={ed.notifyChange}
                />

              ) : (
                <p className="text-xs text-muted-foreground text-center mt-8">اختر قسماً من اللوحة لتعديله.</p>
              )
            ) : (
              <PageSettingsPanel page={ed.page} onChange={ed.updatePageMeta} />
            )}
          </div>
        </aside>
        </div>
      </DndContext>

      {/* Versions dialog */}
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>الإصدارات السابقة</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد إصدارات بعد. كل عملية نشر تنشئ إصداراً.</p>
            ) : versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">{v.version_label || "إصدار"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreVersion(v)}>استعادة</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableSection({
  section, device, selected, onSelect, onDuplicate, onDelete, onSectionUpdate,
}: {
  section: Section;
  device: Device;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSectionUpdate: (id: string, updater: (s: Section) => Section, opts?: { label?: string; key?: string }) => void;
}) {

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, data: { type: "section" } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative group", selected && "ring-2 ring-primary ring-inset")}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className={cn(
        "absolute top-2 end-2 z-10 flex items-center gap-1 rounded-md border border-border bg-background/95 backdrop-blur p-1 shadow-sm transition",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}>
        <button
          {...attributes}
          {...listeners}
          title="اسحب لإعادة الترتيب"
          onClick={(e) => e.stopPropagation()}
          className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{section.type}</span>
        <button title="تكرار" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1 hover:bg-muted rounded">
          <Copy className="h-3 w-3" />
        </button>
        <button title="حذف" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-destructive/10 text-destructive rounded">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className={cn(!selected && "transition hover:outline hover:outline-1 hover:outline-primary/40 hover:outline-offset-[-1px]")}>
        <PageRenderer content={{ sections: [section] }} device={device} onSectionUpdate={onSectionUpdate} />
      </div>
    </div>
  );
}
