import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Upload, Undo2, Redo2, Eye, Monitor, Tablet, Smartphone, Copy, Trash2, Settings, Layers, History, MousePointerClick, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageEditor } from "@/page-builder/hooks/usePageEditor";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { SectionEditor } from "@/page-builder/components/SectionEditor";
import { PageSettingsPanel } from "@/page-builder/components/PageSettingsPanel";
import { SECTION_TYPES, createDefaultSection } from "@/page-builder/utils/pageDefaults";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
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
    if (!over || active.id === over.id) return;
    const oldIdx = ed.content.sections.findIndex((s) => s.id === active.id);
    const newIdx = ed.content.sections.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    ed.updateContent((c) => ({ ...c, sections: arrayMove(c.sections, oldIdx, newIdx) }));
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
          {ed.dirty && <span className="text-xs text-amber-600 dark:text-amber-400">● غير محفوظ</span>}
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={!ed.canUndo} onClick={ed.undo} title="تراجع"><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" disabled={!ed.canRedo} onClick={ed.redo} title="إعادة"><Redo2 className="h-4 w-4" /></Button>

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

      <div className="flex flex-1 min-h-0">
        {/* Left: section library */}
        <aside className="w-56 border-e border-border bg-card overflow-y-auto p-3">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">مكتبة الأقسام</h3>
          <div className="grid grid-cols-2 gap-2">
            {SECTION_TYPES.map((st) => (
              <button
                key={st.type}
                onClick={() => ed.addSection(createDefaultSection(st.type))}
                className="flex flex-col items-center gap-1 rounded-md border border-border p-2 hover:bg-muted text-xs transition"
              >
                <span className="text-xl">{st.icon}</span>
                <span>{ar ? st.label_ar : st.label_en}</span>
              </button>
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
              <div className="p-16 text-center text-muted-foreground">
                <MousePointerClick className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">ابدأ بإضافة قسم من المكتبة على اليسار.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={ed.content.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {ed.content.sections.map((s) => (
                    <SortableSection
                      key={s.id}
                      section={s}
                      device={device}
                      selected={s.id === ed.selectedSectionId}
                      onSelect={() => ed.setSelectedSectionId(s.id)}
                      onDuplicate={() => ed.duplicateSection(s.id)}
                      onDelete={() => { if (confirm("حذف القسم؟")) ed.removeSection(s.id); }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
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
                <SectionEditor section={selectedSection} onChange={(updater) => ed.updateSection(selectedSection.id, updater)} />
              ) : (
                <p className="text-xs text-muted-foreground text-center mt-8">اختر قسماً من اللوحة لتعديله.</p>
              )
            ) : (
              <PageSettingsPanel page={ed.page} onChange={ed.updatePageMeta} />
            )}
          </div>
        </aside>
      </div>

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
