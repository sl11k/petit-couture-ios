import { useEffect, useMemo, useState } from "react";
import { z, ZodIssue } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MediaUploader } from "./MediaUploader";
import { ProductMediaGallery } from "./ProductMediaGallery";
import { WarehouseStockPicker, type WarehouseStockEntry } from "./WarehouseStockPicker";
import type { Bilingual, FormFieldDef } from "../types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  table: string;
  title: Bilingual;
  fields: FormFieldDef[];
  initialValues?: Record<string, any>;
  rowId?: string;
  onClose: () => void;
  onSaved: () => void;
};

function buildSchema(fields: FormFieldDef[], mode: "create" | "edit", ar: boolean) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (mode === "create" && f.editOnly) continue;
    if (mode === "edit" && f.createOnly) continue;
    if (f.type === "warehouseStock") {
      shape[f.key] = z.array(z.any()).default([]);
      continue;
    }
    let s: z.ZodTypeAny;
    switch (f.type) {
      case "number":
        s = z.preprocess(
          (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
          z.number({ invalid_type_error: ar ? "رقم غير صحيح" : "Invalid number" }),
        );
        if (f.min !== undefined) s = (s as z.ZodNumber).min(f.min);
        if (f.max !== undefined) s = (s as z.ZodNumber).max(f.max);
        break;
      case "boolean":
        s = z.boolean().or(z.string().transform((v) => v === "true"));
        break;
      case "date":
      case "datetime":
        s = z.string().min(1).or(z.literal(""));
        break;
      case "email":
        s = z.string().email(ar ? "بريد غير صحيح" : "Invalid email");
        break;
      case "url":
        s = z.string().url(ar ? "رابط غير صحيح" : "Invalid URL");
        break;
      case "image":
      case "video":
        // Storage public URL — accept any non-empty string
        s = z.string();
        break;
      case "gallery":
      case "videoGallery":
        s = z.array(z.string()).default([]);
        break;
      case "json":
        s = z.string().refine(
          (v) => {
            if (!v || v.trim() === "") return true;
            try { JSON.parse(v); return true; } catch { return false; }
          },
          { message: ar ? "JSON غير صحيح" : "Invalid JSON" },
        );
        break;
      case "select":
        s = z.string();
        break;
      default:
        s = z.string();
        if (f.maxLength) s = (s as z.ZodString).max(f.maxLength);
        if (f.pattern) s = (s as z.ZodString).regex(new RegExp(f.pattern), ar ? "صيغة غير صحيحة" : "Invalid format");
    }
    if (f.type === "gallery" || f.type === "videoGallery") {
      // arrays are always present (possibly empty)
    } else if (!f.required) {
      s = s.optional().or(z.literal("")).or(z.null());
    } else if (f.type === "text" || f.type === "textarea" || f.type === "select" || f.type === "url" || f.type === "email" || f.type === "image" || f.type === "video") {
      s = (s as z.ZodString).min(1, ar ? "حقل مطلوب" : "Required");
    }
    shape[f.key] = s;
  }
  return z.object(shape);
}

function coerceForDb(fields: FormFieldDef[], values: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === "warehouseStock") continue; // virtual field; handled separately
    let v = values[f.key];
    if (f.type === "gallery" || f.type === "videoGallery") {
      out[f.key] = Array.isArray(v) ? v : [];
      continue;
    }
    if (v === "" || v === undefined) {
      if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== "") {
        out[f.key] = f.defaultValue;
      } else {
        out[f.key] = null;
      }
      continue;
    }
    if (f.type === "number") v = Number(v);
    else if (f.type === "boolean") v = typeof v === "string" ? v === "true" : Boolean(v);
    else if (f.type === "json") { try { v = JSON.parse(v); } catch { /* keep string */ } }
    out[f.key] = v;
  }
  return out;
}

function defaultsFrom(fields: FormFieldDef[], initial?: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    let v = initial?.[f.key] ?? f.defaultValue;
    if (f.type === "gallery" || f.type === "videoGallery") {
      out[f.key] = Array.isArray(v) ? v : [];
      continue;
    }
    if (f.type === "warehouseStock") {
      out[f.key] = Array.isArray(v) ? v : [];
      continue;
    }
    if (f.type === "json" && v && typeof v !== "string") v = JSON.stringify(v, null, 2);
    if (f.type === "boolean") v = Boolean(v);
    if (v === undefined || v === null) v = f.type === "boolean" ? false : "";
    out[f.key] = v;
  }
  return out;
}

export function FormDialog({
  open,
  mode,
  table,
  title,
  fields,
  initialValues,
  rowId,
  onClose,
  onSaved,
}: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const visibleFields = useMemo(
    () => fields.filter((f) => (mode === "create" ? !f.editOnly : !f.createOnly)),
    [fields, mode],
  );

  const [values, setValues] = useState<Record<string, any>>(() => defaultsFrom(visibleFields, initialValues));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [existingInventory, setExistingInventory] = useState<Record<string, number>>({});

  const warehouseStockField = useMemo(
    () => visibleFields.find((f) => f.type === "warehouseStock"),
    [visibleFields],
  );

  useEffect(() => {
    if (open) {
      setValues(defaultsFrom(visibleFields, initialValues));
      setErrors({});
    }
  }, [open, initialValues, visibleFields]);

  useEffect(() => {
    if (!open || !warehouseStockField || mode !== "edit" || !rowId) {
      setExistingInventory({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("inventory")
        .select("warehouse_id, quantity")
        .eq("product_id", rowId)
        .is("variant_id", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { map[r.warehouse_id] = r.quantity; });
      setExistingInventory(map);
      setValues((s) => ({
        ...s,
        [warehouseStockField.key]: Object.entries(map).map(([wid, qty]) => ({
          warehouse_id: wid,
          quantity: qty as number,
          enabled: true,
        })),
      }));
    })();
  }, [open, mode, rowId, warehouseStockField]);

  const persistWarehouseStock = async (productId: string, entries: WarehouseStockEntry[]) => {
    const active = entries.filter((e) => e.enabled);
    for (const e of active) {
      const qty = Math.max(0, Number(e.quantity) || 0);
      const { data: existing } = await supabase
        .from("inventory")
        .select("id")
        .eq("product_id", productId)
        .eq("warehouse_id", e.warehouse_id)
        .is("variant_id", null)
        .maybeSingle();
      if (existing?.id) {
        const { error: upErr } = await supabase
          .from("inventory")
          .update({ quantity: qty, status: "active" } as any)
          .eq("id", existing.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from("inventory")
          .insert({
            product_id: productId,
            warehouse_id: e.warehouse_id,
            variant_id: null,
            quantity: qty,
            status: "active",
          } as any);
        if (insErr) throw insErr;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = buildSchema(fields, mode, ar);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i: ZodIssue) => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    setSaving(true);
    const payload = coerceForDb(visibleFields, values);
    let productId = rowId;
    if (mode === "create") {
      const { data, error } = await supabase
        .from(table as any)
        .insert(payload as any)
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
      productId = (data as any)?.id;
    } else {
      const { error } = await supabase
        .from(table as any)
        .update(payload as any)
        .eq("id", rowId!);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
    }

    if (warehouseStockField && productId) {
      try {
        await persistWarehouseStock(productId, (values[warehouseStockField.key] as WarehouseStockEntry[]) ?? []);
      } catch (err: any) {
        setSaving(false);
        toast.error(err?.message || (ar ? "تعذر حفظ مخزون المستودعات" : "Failed to save warehouse stock"));
        return;
      }
    }

    setSaving(false);
    toast.success(ar ? (mode === "create" ? "تم الإنشاء" : "تم الحفظ") : mode === "create" ? "Created" : "Saved");
    onSaved();
    onClose();
  };

  const setVal = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? (ar ? "إضافة " : "Add ") : (ar ? "تعديل " : "Edit ")}
            {ar ? title.ar : title.en}
          </DialogTitle>
          <DialogDescription>
            {ar ? "املأ الحقول التالية" : "Fill in the fields below"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleFields.map((f) => {
              const isFull = f.fullWidth ?? (f.type === "textarea" || f.type === "json" || f.type === "gallery" || f.type === "videoGallery" || f.type === "image" || f.type === "video" || f.type === "warehouseStock");
              const lbl = ar ? f.label.ar : f.label.en;
              const ph = f.placeholder ? (ar ? f.placeholder.ar : f.placeholder.en) : undefined;
              const help = f.helpText ? (ar ? f.helpText.ar : f.helpText.en) : undefined;
              const err = errors[f.key];
              return (
                <div key={f.key} className={cn("space-y-1.5", isFull && "sm:col-span-2")}>
                  <Label htmlFor={f.key} className="text-xs">
                    {lbl} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  {f.type === "image" || f.type === "video" ? (
                    <MediaUploader
                      value={values[f.key] ?? ""}
                      onChange={(url) => setVal(f.key, url ?? "")}
                      bucket={f.bucket || (f.type === "video" ? "product-media" : "content-media")}
                      folder={f.folder}
                      kind={f.type}
                    />
                  ) : f.type === "gallery" || f.type === "videoGallery" ? (
                    <ProductMediaGallery
                      value={Array.isArray(values[f.key]) ? values[f.key] : []}
                      onChange={(urls) => setVal(f.key, urls)}
                      bucket={f.bucket || "product-media"}
                      folder={f.folder || (f.type === "videoGallery" ? "videos" : "gallery")}
                      max={f.maxItems ?? (f.type === "videoGallery" ? 10 : 20)}
                      kind={f.type === "videoGallery" ? "video" : "image"}
                    />
                  ) : f.type === "warehouseStock" ? (
                    <WarehouseStockPicker
                      value={Array.isArray(values[f.key]) ? values[f.key] : []}
                      onChange={(v) => setVal(f.key, v)}
                      existing={existingInventory}
                    />
                  ) : f.type === "textarea" || f.type === "json" ? (
                    <Textarea
                      id={f.key}
                      rows={f.rows ?? (f.type === "json" ? 6 : 4)}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setVal(f.key, e.target.value)}
                      placeholder={ph}
                      className={cn("text-sm", f.type === "json" && "font-mono text-xs")}
                    />
                  ) : f.type === "select" ? (
                    <select
                      id={f.key}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setVal(f.key, e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {ar ? o.label.ar : o.label.en}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        id={f.key}
                        checked={Boolean(values[f.key])}
                        onCheckedChange={(c) => setVal(f.key, c)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {values[f.key] ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}
                      </span>
                    </div>
                  ) : (
                    <Input
                      id={f.key}
                      type={
                        f.type === "number" ? "number"
                        : f.type === "date" ? "date"
                        : f.type === "datetime" ? "datetime-local"
                        : f.type === "color" ? "color"
                        : f.type === "tel" ? "tel"
                        : f.type === "email" ? "email"
                        : f.type === "url" ? "url"
                        : "text"
                      }
                      value={values[f.key] ?? ""}
                      onChange={(e) => setVal(f.key, e.target.value)}
                      placeholder={ph}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      maxLength={f.maxLength}
                    />
                  )}
                  {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
                  {err && <p className="text-[11px] text-destructive">{err}</p>}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
