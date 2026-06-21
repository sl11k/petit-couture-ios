import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { PageContent } from "@/page-builder/schemas/pageSchema";

type ABRow = {
  id: string;
  name: string;
  scope: string;
  is_active: boolean;
  variant_a: any;
  variant_b: any;
  views_a: number;
  views_b: number;
  conversions_a: number;
  conversions_b: number;
};

/** A/B variant manager scoped to a single CMS page. */
export function AbVariantManager({
  open, onOpenChange, pageSlug, currentContent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pageSlug: string;
  currentContent: PageContent;
}) {
  const scope = `page:${pageSlug}`;
  const [row, setRow] = useState<ABRow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ab_tests").select("*").eq("scope", scope).maybeSingle();
    setRow((data as any) ?? null);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const createTest = async () => {
    const { data, error } = await supabase.from("ab_tests").insert({
      name: `A/B — ${pageSlug}`,
      scope,
      variant_a: currentContent as any,
      variant_b: currentContent as any,
      is_active: true,
    }).select("*").maybeSingle();
    if (error) { toast.error(error.message); return; }
    setRow(data as any);
    toast.success("تم إنشاء اختبار A/B — نسخة B تساوي الأصلية. عدّلها من المحرر");
  };

  const setVariantBFromCurrent = async () => {
    if (!row) return;
    const { error } = await supabase.from("ab_tests").update({ variant_b: currentContent as any }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث نسخة B بمحتوى المحرر الحالي");
    load();
  };

  const toggleActive = async (v: boolean) => {
    if (!row) return;
    const { error } = await supabase.from("ab_tests").update({ is_active: v }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRow({ ...row, is_active: v });
  };

  const deleteTest = async () => {
    if (!row) return;
    if (!confirm("حذف اختبار A/B؟")) return;
    const { error } = await supabase.from("ab_tests").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRow(null);
    toast.success("تم الحذف");
  };

  const total = (row?.views_a ?? 0) + (row?.views_b ?? 0);
  const pctA = total ? Math.round(((row?.views_a ?? 0) / total) * 100) : 50;
  const cvrA = row?.views_a ? Math.round(((row.conversions_a / row.views_a) * 100)) : 0;
  const cvrB = row?.views_b ? Math.round(((row.conversions_b / row.views_b) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>اختبار A/B للصفحة</DialogTitle></DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل…</p>
        ) : !row ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              لا يوجد اختبار A/B لهذه الصفحة. أنشئ واحداً وستُعرض نسختان مختلفتان للزوار بالتساوي (50/50) لمقارنة أيهما أفضل.
            </p>
            <Button onClick={createTest} className="w-full">إنشاء اختبار A/B</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">الاختبار نشط</Label>
                <p className="text-xs text-muted-foreground">عند الإيقاف يرى الكل النسخة الأصلية المنشورة</p>
              </div>
              <Switch checked={row.is_active} onCheckedChange={toggleActive} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">نسخة A (الأصلية المنشورة)</div>
                <div className="text-2xl font-semibold mt-1">{row.views_a}</div>
                <div className="text-[11px] text-muted-foreground">مشاهدات · {pctA}%</div>
                <div className="text-xs mt-1">تحويل {cvrA}%</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">نسخة B</div>
                <div className="text-2xl font-semibold mt-1">{row.views_b}</div>
                <div className="text-[11px] text-muted-foreground">مشاهدات · {100 - pctA}%</div>
                <div className="text-xs mt-1">تحويل {cvrB}%</div>
              </div>
            </div>

            <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-2">
              <p>لتعديل نسخة B: عدّل الصفحة في المحرر المباشر ثم اضغط الزر بالأسفل لحفظ الحالة الحالية كنسخة B.</p>
              <Button size="sm" variant="secondary" onClick={setVariantBFromCurrent} className="w-full">
                احفظ محتوى المحرر الحالي كنسخة B
              </Button>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {row && <Button variant="ghost" className="text-destructive me-auto" onClick={deleteTest}>حذف الاختبار</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Public helper: returns published variant for a page slug, sticky per visitor. */
export async function pickAbVariant(pageSlug: string, fallback: PageContent): Promise<PageContent> {
  try {
    const { data } = await supabase
      .from("ab_tests")
      .select("id, variant_a, variant_b, is_active")
      .eq("scope", `page:${pageSlug}`)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return fallback;
    const key = `ab:page:${pageSlug}`;
    let pick = localStorage.getItem(key) as "a" | "b" | null;
    if (!pick) {
      pick = Math.random() < 0.5 ? "a" : "b";
      try { localStorage.setItem(key, pick); } catch { /* ignore */ }
    }
    // fire-and-forget view counter
    void supabase
      .from("ab_tests")
      .update({ [col]: ((data as any)[col] ?? 0) + 1 } as any)
      .eq("id", (data as any).id);
    const variant = pick === "a" ? (data as any).variant_a : (data as any).variant_b;
    return (variant?.sections ? variant : fallback) as PageContent;
  } catch {
    return fallback;
  }
}
