import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2, Save, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PIXEL_PROVIDERS, providerLabel, type PixelRow } from "@/lib/pixels";

export const Route = createFileRoute("/admin/pixels")({
  component: PixelsAdminPage,
});

type Row = PixelRow & { _dirty?: boolean; _new?: boolean };

function PixelsAdminPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tracking_pixels")
      .select("id,provider,label,pixel_id,custom_script,enabled,placement,sort_order")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)));

  const addRow = () => {
    const id = `new_${Math.random().toString(36).slice(2, 10)}`;
    setRows((prev) => [
      ...prev,
      {
        id,
        provider: "meta",
        label: null,
        pixel_id: "",
        custom_script: null,
        enabled: true,
        placement: "head",
        sort_order: prev.length + 1,
        _new: true,
        _dirty: true,
      },
    ]);
  };

  const removeRow = async (row: Row) => {
    if (row._new) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    const { error } = await supabase.from("tracking_pixels").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success(ar ? "تم الحذف" : "Deleted");
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const row of rows.filter((r) => r._dirty)) {
        const payload = {
          provider: row.provider,
          label: row.label || null,
          pixel_id: (row.pixel_id ?? "").trim() || null,
          custom_script: row.custom_script || null,
          enabled: row.enabled,
          placement: row.placement || "head",
          sort_order: row.sort_order ?? 0,
        };
        if (row._new) {
          const { error } = await supabase.from("tracking_pixels").insert(payload as any);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("tracking_pixels")
            .update(payload as any)
            .eq("id", row.id);
          if (error) throw error;
        }
      }
      toast.success(ar ? "تم حفظ البكسلات" : "Pixels saved");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? (ar ? "تعذّر الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const dirty = useMemo(() => rows.some((r) => r._dirty), [rows]);

  return (
    <div>
      <PageHeader
        title={{ ar: "بكسلات التتبع", en: "Tracking pixels" }}
        description={{
          ar: "أضف وفعّل بكسلات تيك توك وميتا وإنستجرام وسناب شات وجوجل وغيرها، أو الصق كود تتبع مخصص.",
          en: "Add and enable TikTok, Meta, Instagram, Snapchat, Google and other pixels, or paste a custom tracking script.",
        }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={addRow} variant="outline" size="sm">
          <Plus className="h-4 w-4 me-1" />
          {ar ? "إضافة بكسل" : "Add pixel"}
        </Button>
        <Button onClick={saveAll} size="sm" disabled={!dirty || saving}>
          <Save className="h-4 w-4 me-1" />
          {saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : ar ? "حفظ التغييرات" : "Save changes"}
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {ar ? "جارٍ التحميل..." : "Loading..."}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {ar ? "لا توجد بكسلات بعد." : "No pixels yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const meta = PIXEL_PROVIDERS.find((p) => p.value === row.provider);
            return (
              <div key={row.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">
                    {row.label || providerLabel(row.provider, ar)}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(v) => update(row.id, { enabled: v })}
                      />
                      <span className="text-xs text-muted-foreground">
                        {row.enabled ? (ar ? "مفعّل" : "Enabled") : ar ? "معطّل" : "Disabled"}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => void removeRow(row)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">{ar ? "المنصة" : "Platform"}</Label>
                    <Select
                      value={row.provider}
                      onValueChange={(v) => update(row.id, { provider: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIXEL_PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {ar ? p.label.ar : p.label.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">
                      {meta ? (ar ? meta.idLabel.ar : meta.idLabel.en) : ar ? "المعرّف" : "ID"}
                    </Label>
                    <Input
                      className="mt-1"
                      dir="ltr"
                      placeholder={meta?.idPlaceholder}
                      value={row.pixel_id ?? ""}
                      onChange={(e) => update(row.id, { pixel_id: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">{ar ? "اسم داخلي (اختياري)" : "Internal label (optional)"}</Label>
                    <Input
                      className="mt-1"
                      value={row.label ?? ""}
                      onChange={(e) => update(row.id, { label: e.target.value })}
                    />
                  </div>
                </div>

                {row.provider === "custom" && (
                  <div className="mt-3">
                    <Label className="text-xs">{ar ? "كود التتبع" : "Tracking script"}</Label>
                    <Textarea
                      className="mt-1 font-mono text-xs"
                      dir="ltr"
                      rows={6}
                      placeholder="<script>...</script>"
                      value={row.custom_script ?? ""}
                      onChange={(e) => update(row.id, { custom_script: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-1 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" />
        {ar
          ? "البكسلات تعمل على صفحات المتجر فقط ولا تُحمّل داخل لوحة التحكم."
          : "Pixels run on storefront pages only and are never loaded inside the admin."}
      </p>
    </div>
  );
}
