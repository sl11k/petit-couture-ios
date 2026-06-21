import { useEffect, useState } from "react";
import { createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Target = { kind: "product" | "category"; slug: string };

type Ctx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  openFor: (t: Target) => void;
};

const QECtx = createContext<Ctx | null>(null);

export function useInlineQuickEdit() {
  const v = useContext(QECtx);
  if (!v) throw new Error("useInlineQuickEdit must be used inside InlineQuickEditProvider");
  return v;
}

export function InlineQuickEditProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  // Intercept clicks on /product/<slug> and /category/<slug> while enabled
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute("href") || "";
      const m = href.match(/^\/(product|category)\/([^/?#]+)/);
      if (!m) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget({ kind: m[1] as any, slug: decodeURIComponent(m[2]) });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [enabled]);

  return (
    <QECtx.Provider value={{ enabled, setEnabled, openFor: (t) => setTarget(t) }}>
      {children}
      <QuickEditSheet target={target} onClose={() => setTarget(null)} />
    </QECtx.Provider>
  );
}

function QuickEditSheet({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const [row, setRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) { setRow(null); return; }
    setLoading(true);
    const table = target.kind === "product" ? "products" : "categories";
    supabase.from(table as any).select("*").eq("slug", target.slug).maybeSingle()
      .then(({ data }) => { setRow(data); setLoading(false); });
  }, [target]);

  if (!target) return null;

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const table = target.kind === "product" ? "products" : "categories";
    const patch: any = {
      name_ar: row.name_ar, name_en: row.name_en,
      image_url: row.image_url, is_active: row.is_active,
    };
    if (target.kind === "product") {
      patch.price = Number(row.price) || 0;
      patch.compare_at_price = row.compare_at_price ? Number(row.compare_at_price) : null;
      patch.stock = Number(row.stock) || 0;
      patch.short_description_ar = row.short_description_ar;
      patch.short_description_en = row.short_description_en;
    } else {
      patch.description_ar = row.description_ar;
      patch.description_en = row.description_en;
    }
    const { error } = await supabase.from(table as any).update(patch).eq("id", row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    onClose();
  };

  const isProduct = target.kind === "product";
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isProduct ? "تعديل المنتج" : "تعديل التصنيف"}</SheetTitle>
        </SheetHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground mt-6">جاري التحميل…</p>
        ) : !row ? (
          <p className="text-sm text-destructive mt-6">لم يتم العثور على العنصر</p>
        ) : (
          <div className="space-y-3 mt-4">
            <Field label="الاسم بالعربية" v={row.name_ar} on={(v) => setRow({ ...row, name_ar: v })} />
            <Field label="Name (English)" v={row.name_en} on={(v) => setRow({ ...row, name_en: v })} />
            <Field label="رابط الصورة" v={row.image_url ?? ""} on={(v) => setRow({ ...row, image_url: v })} />
            {row.image_url && <img src={row.image_url} alt="" className="h-32 w-full object-cover rounded-md border" />}
            {isProduct && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Field type="number" label="السعر" v={row.price} on={(v) => setRow({ ...row, price: v })} />
                  <Field type="number" label="السعر قبل الخصم" v={row.compare_at_price ?? ""} on={(v) => setRow({ ...row, compare_at_price: v })} />
                  <Field type="number" label="المخزون" v={row.stock} on={(v) => setRow({ ...row, stock: v })} />
                </div>
                <TArea label="وصف مختصر AR" v={row.short_description_ar ?? ""} on={(v) => setRow({ ...row, short_description_ar: v })} />
                <TArea label="Short description EN" v={row.short_description_en ?? ""} on={(v) => setRow({ ...row, short_description_en: v })} />
              </>
            )}
            {!isProduct && (
              <>
                <TArea label="الوصف AR" v={row.description_ar ?? ""} on={(v) => setRow({ ...row, description_ar: v })} />
                <TArea label="Description EN" v={row.description_en ?? ""} on={(v) => setRow({ ...row, description_en: v })} />
              </>
            )}
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>مفعّل / Active</Label>
              <Switch checked={!!row.is_active} onCheckedChange={(v) => setRow({ ...row, is_active: v })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
              <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "..." : "حفظ"}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, v, on, type }: { label: string; v: any; on: (v: any) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type ?? "text"} value={v ?? ""} onChange={(e) => on(type === "number" ? e.target.value : e.target.value)} />
    </div>
  );
}
function TArea({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={3} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
