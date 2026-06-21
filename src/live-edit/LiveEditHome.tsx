import { useEffect } from "react";
import { usePageEditor } from "@/page-builder/hooks/usePageEditor";
import { PageRenderer } from "@/page-builder/components/PageRenderer";

import { createDefaultSection } from "@/page-builder/utils/pageDefaults";
import { useLiveEdit } from "./LiveEditContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Save, Upload, X, Undo2, Redo2, Languages, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SECTION_TYPES } from "@/page-builder/utils/pageDefaults";

/**
 * Renders the page in live-edit mode. All text becomes inline editable
 * (via PageRenderer's built-in EditContext). A floating toolbar lets the
 * admin undo/redo, switch language, save draft, publish, or exit.
 */
export function LiveEditCanvas({ fallback }: { fallback: React.ReactNode }) {
  const { pageId, stop } = useLiveEdit();
  const ed = usePageEditor(pageId ?? undefined);
  const { lang, toggle: toggleLanguage } = useLanguage();
  const ar = lang === "ar";

  // Warn on close if dirty
  useEffect(() => {
    if (!ed.dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [ed.dirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); ed.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); ed.redo(); }
      else if (k === "s") { e.preventDefault(); ed.saveDraft(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ed]);

  if (ed.loading) {
    return <div className="p-12 text-center text-muted-foreground text-sm">جاري تحميل المحرر…</div>;
  }

  const sections = ed.content?.sections ?? [];
  const onlyLegacy = sections.length === 1 && sections[0].type === "legacy_home";
  const empty = sections.length === 0;

  const convertLegacy = () => {
    const defaults = [
      createDefaultSection("hero"),
      createDefaultSection("feature_grid"),
      createDefaultSection("testimonials"),
      createDefaultSection("faq"),
      createDefaultSection("cta"),
    ];
    ed.updateContent((c) => ({
      ...c,
      sections: c.sections.flatMap((s) => (s.type === "legacy_home" ? defaults : [s])),
    }), { label: "تحويل إلى أقسام قابلة للتعديل" });
    toast.success("تم — كل قسم قابل للتعديل الآن");
  };

  return (
    <>
      {/* Canvas — if legacy/empty, show the real homepage with a friendly prompt overlay */}
      {empty || onlyLegacy ? (
        <div className="relative">
          {fallback}
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[90%] rounded-2xl border border-border bg-card/95 backdrop-blur p-5 shadow-2xl text-center">
            <h3 className="text-base font-semibold mb-2">حوّل الصفحة لمحرر مباشر</h3>
            <p className="text-xs text-muted-foreground mb-3">
              الصفحة الرئيسية تعرض حالياً القالب الجاهز. اضغط الزر لتحويلها لأقسام قابلة للتعديل بشكل كامل (هيرو، مزايا، آراء، أسئلة، CTA).
            </p>
            <Button size="sm" onClick={convertLegacy}>تحويل الآن</Button>
          </div>
        </div>
      ) : (
        <div className="pb-24">
          <PageRenderer content={ed.content} onSectionUpdate={ed.updateSection} />
        </div>
      )}

      {/* Floating toolbar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur px-2 py-1.5 shadow-2xl">
        <span className="px-2 text-[11px] text-muted-foreground hidden sm:inline">
          وضع التحرير {ed.dirty ? "● غير محفوظ" : ed.lastSavedAt ? "✓ محفوظ" : ""}
        </span>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={!ed.canUndo} onClick={ed.undo} title="تراجع">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={!ed.canRedo} onClick={ed.redo} title="إعادة">
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={toggleLanguage} title="تبديل اللغة">
          <Languages className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="إضافة قسم">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="max-h-72 overflow-y-auto">
            {SECTION_TYPES.map((st) => (
              <DropdownMenuItem
                key={st.type}
                onClick={() => {
                  ed.addSection(createDefaultSection(st.type));
                  toast.success(`أُضيف قسم ${ar ? st.label_ar : st.label_en}`);
                }}
              >
                <span className="me-2">{st.icon}</span>
                {ar ? st.label_ar : st.label_en}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border mx-1" />
        <Button size="sm" variant="outline" className="h-8" onClick={ed.saveDraft} disabled={ed.saving}>
          <Save className="h-3.5 w-3.5 me-1" /> {ed.saving ? "..." : "حفظ"}
        </Button>
        <Button size="sm" className="h-8" onClick={ed.publish} disabled={ed.publishing}>
          <Upload className="h-3.5 w-3.5 me-1" /> {ed.publishing ? "..." : "نشر"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="خروج"
          onClick={() => {
            if (ed.dirty && !confirm("هناك تغييرات غير محفوظة. الخروج بدون حفظ؟")) return;
            stop();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

