import { useEffect, useState } from "react";
import { usePageEditor } from "@/page-builder/hooks/usePageEditor";
import { PageRenderer } from "@/page-builder/components/PageRenderer";

import { createDefaultSection } from "@/page-builder/utils/pageDefaults";
import { useLiveEdit } from "./LiveEditContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Save, Upload, X, Undo2, Redo2, Languages, Plus, Code2, FlaskConical, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SECTION_TYPES } from "@/page-builder/utils/pageDefaults";
import { CustomCssEditor } from "./CustomCssEditor";
import { AbVariantManager } from "./AbVariantManager";
import { useInlineQuickEdit } from "./InlineQuickEdit";
import { cn } from "@/lib/utils";
import { SiteInlineEditor } from "./SiteInlineEditor";

/**
 * Renders the page in live-edit mode. All text becomes inline editable
 * (via PageRenderer's built-in EditContext). A floating toolbar lets the
 * admin undo/redo, switch language, save draft, publish, or exit.
 */
export function LiveEditCanvas({ fallback }: { fallback: React.ReactNode }) {
  const { pageId, slug, stop } = useLiveEdit();
  const ed = usePageEditor(pageId ?? undefined);
  const { lang, toggle: toggleLanguage } = useLanguage();
  const ar = lang === "ar";
  const qe = useInlineQuickEdit();
  const [cssOpen, setCssOpen] = useState(false);
  const [abOpen, setAbOpen] = useState(false);

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

  // Always edit the ORIGINAL design directly via inline DOM editing.
  // No sections, no template conversion — what you see is what you edit.
  return (
    <SiteInlineEditor pagePath={typeof window !== "undefined" ? window.location.pathname : "/"}>
      {fallback}
    </SiteInlineEditor>
  );
}



