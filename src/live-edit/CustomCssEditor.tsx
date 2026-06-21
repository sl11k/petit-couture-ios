import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setCustomCssLive } from "@/hooks/useCustomCss";

/** Admin CSS editor — saves to site_settings.custom_css and applies live. */
export function CustomCssEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [css, setCss] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from("site_settings").select("id, custom_css").limit(1).maybeSingle()
      .then(({ data }) => {
        setRowId((data as any)?.id ?? null);
        setCss(((data as any)?.custom_css ?? "") as string);
      });
  }, [open]);

  const onPreview = () => setCustomCssLive(css);

  const onSave = async () => {
    setSaving(true);
    const payload: any = { custom_css: css };
    const q = rowId
      ? supabase.from("site_settings").update(payload).eq("id", rowId)
      : supabase.from("site_settings").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setCustomCssLive(css);
    toast.success("تم حفظ CSS وتطبيقه على الموقع");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>محرر CSS مخصص</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          أي CSS تكتبه هنا يُطبَّق على كل الموقع. استخدم متغيرات الثيم (مثل <code>--primary</code>) لتغيير الألوان.
        </p>
        <textarea
          value={css}
          onChange={(e) => setCss(e.target.value)}
          spellCheck={false}
          dir="ltr"
          className="font-mono text-xs h-80 w-full rounded-md border border-border bg-background p-3 outline-none focus:ring-2 focus:ring-primary/50"
          placeholder={"/* مثال */\nbody { font-family: 'Tajawal', sans-serif; }\n.btn-primary { background: #c19a6b; }"}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button variant="secondary" onClick={onPreview}>معاينة فقط</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "..." : "حفظ ونشر"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
