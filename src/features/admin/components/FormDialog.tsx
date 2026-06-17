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
import { LookupField } from "./LookupField";
import { VariantEditor, type VariantEntry } from "./VariantEditor";
import { SizeSkuEditor, type SizeEntry } from "./SizeSkuEditor";
import { AttributesEditor, type AttributeEntry } from "./AttributesEditor";
import { FriendlyDataEditor } from "./FriendlyDataEditor";
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
    if (f.type === "warehouseStock" || f.type === "productVariants" || f.type === "productSizes" || f.type === "productAttributes") {
      shape[f.key] = z.array(z.any()).default([]);
      continue;
    }
    if (f.type === "lookup") {
      if (f.lookup?.multiple) {
        shape[f.key] = f.required
          ? z.array(z.string()).min(1, ar ? "حقل مطلوب" : "Required")
          : z.array(z.string()).default([]).optional();
      } else {
        shape[f.key] = f.required
          ? z.string().min(1, ar ? "حقل مطلوب" : "Required")
          : z.string().optional().or(z.literal("")).or(z.null());
      }
      continue;
    }
    let s: z.ZodTypeAny;
    let alreadyHandled = false;
    switch (f.type) {
      case "number": {
        let numSchema: z.ZodTypeAny = z.number({ invalid_type_error: ar ? "رقم غير صحيح" : "Invalid number" });
        if (f.min !== undefined) numSchema = (numSchema as z.ZodNumber).min(f.min, ar ? `الحد الأدنى ${f.min}` : `Min ${f.min}`);
        if (f.max !== undefined) numSchema = (numSchema as z.ZodNumber).max(f.max, ar ? `الحد الأقصى ${f.max}` : `Max ${f.max}`);
        s = z.preprocess(
          (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
          f.required ? numSchema : numSchema.optional(),
        );
        alreadyHandled = true;
        break;
      }
      case "boolean":
        s = z.boolean().or(z.string().transform((v) => v === "true"));
        break;
      case "date":
      case "datetime":
        s = z.string().or(z.literal(""));
        break;
      case "email":
        s = z.string().email(ar ? "بريد غير صحيح" : "Invalid email");
        break;
      case "url":
        s = z.string().url(ar ? "رابط غير صحيح" : "Invalid URL");
        break;
      case "image":
      case "video":
        s = z.string();
        break;
      case "gallery":
      case "videoGallery":
        s = z.array(z.string()).default([]);
        alreadyHandled = true;
        break;
      case "json":
        s = z.any();
        alreadyHandled = true;
        break;
      case "select":
        s = z.string();
        break;
      default:
        s = z.string();
        if (f.maxLength) s = (s as z.ZodString).max(f.maxLength);
        if (f.pattern) s = (s as z.ZodString).regex(new RegExp(f.pattern), ar ? "صيغة غير صحيحة" : "Invalid format");
    }
    if (!alreadyHandled) {
      if (!f.required) {
        s = s.optional().or(z.literal("")).or(z.null());
      } else if (
        f.type === "text" || f.type === "textarea" || f.type === "select" ||
        f.type === "url" || f.type === "email" || f.type === "image" || f.type === "video" ||
        f.type === "tel" || f.type === "color" || f.type === "date" || f.type === "datetime"
      ) {
        s = (s as z.ZodString).min(1, ar ? "حقل مطلوب" : "Required");
      }
    }
    shape[f.key] = s;
  }
  return z.object(shape);
}

function coerceForDb(fields: FormFieldDef[], values: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === "warehouseStock" || f.type === "productVariants" || f.type === "productSizes" || f.type === "productAttributes") continue;
    if (f.type === "lookup" && f.lookup?.junction) continue;
    let v = values[f.key];
    if (f.type === "lookup") {
      if (f.lookup?.multiple) {
        out[f.key] = Array.isArray(v) ? v : [];
      } else {
        out[f.key] = v && String(v).trim() !== "" ? v : null;
      }
      continue;
    }
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
    else if (f.type === "json") { if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* keep */ } } }
    out[f.key] = v;
  }
  return out;
}

function defaultsFrom(fields: FormFieldDef[], initial?: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    let v = initial?.[f.key] ?? f.defaultValue;
    if (f.type === "lookup") {
      if (f.lookup?.multiple || f.lookup?.junction) out[f.key] = Array.isArray(v) ? v : [];
      else out[f.key] = v ?? "";
      continue;
    }
    if (f.type === "gallery" || f.type === "videoGallery") { out[f.key] = Array.isArray(v) ? v : []; continue; }
    if (f.type === "warehouseStock") { out[f.key] = Array.isArray(v) ? v : []; continue; }
    if (f.type === "productVariants" || f.type === "productSizes" || f.type === "productAttributes") { out[f.key] = Array.isArray(v) ? v : []; continue; }
    if (f.type === "json") {
      if (typeof v === "string") {
        try { v = JSON.parse(v); } catch { v = null; }
      }
      out[f.key] = v ?? null;
      continue;
    }
    if (f.type === "boolean") v = Boolean(v);
    if (v === undefined || v === null) v = f.type === "boolean" ? false : "";
    out[f.key] = v;
  }
  return out;
}

async function syncJunction(cfg: NonNullable<NonNullable<FormFieldDef["lookup"]>["junction"]>, ownerId: string, selectedItemIds: string[]) {
  const { error: delErr } = await (supabase as any).from(cfg.table).delete().eq(cfg.ownerColumn, ownerId);
  if (delErr) throw delErr;
  if (selectedItemIds.length === 0) return;
  const rows = selectedItemIds.map((id) => ({ [cfg.ownerColumn]: ownerId, [cfg.itemColumn]: id }));
  const { error: insErr } = await (supabase as any).from(cfg.table).insert(rows);
  if (insErr) throw insErr;
}

async function syncProductVariants(productId: string, entries: VariantEntry[]) {
  const { data: existing, error: exErr } = await (supabase as any).from("product_variants").select("id, attributes").eq("product_id", productId);
  if (exErr) throw exErr;
  // Only manage colour rows here — size rows (attributes.kind = "size") are
  // owned by syncProductSizes and must never be deleted by this editor.
  const existingIds = new Set<string>(
    (existing ?? []).filter((r: any) => r?.attributes?.kind !== "size").map((r: any) => r.id),
  );
  const keptIds = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const payload = {
      product_id: productId,
      color_name_ar: e.color_name_ar || null,
      color_name_en: e.color_name_en || null,
      color_hex: e.color_hex || null,
      color_image_url: e.color_image_url || null,
      size: e.size || null,
      sku: e.sku || null,
      stock: Number(e.stock) || 0,
      is_active: e.is_active ?? true,
      sort_order: i,
    };
    if (e.id && existingIds.has(e.id)) {
      keptIds.add(e.id);
      const { error } = await (supabase as any).from("product_variants").update(payload).eq("id", e.id);
      if (error) throw error;
    } else {
      const { error } = await (supabase as any).from("product_variants").insert(payload);
      if (error) throw error;
    }
  }
  const toDelete = Array.from(existingIds).filter((id) => !keptIds.has(id));
  if (toDelete.length) {
    const { error } = await (supabase as any).from("product_variants").delete().in("id", toDelete);
    if (error) throw error;
  }
}

// Size variants live in product_variants tagged `attributes.kind = "size"`.
// Each row carries its own SKU, price and stock. We also mirror the active
// size labels onto products.sizes so the existing storefront size selector
// keeps working unchanged.
async function syncProductSizes(productId: string, entries: SizeEntry[]) {
  const clean = entries.filter((e) => (e.size || "").trim() !== "");
  const { data: existing, error: exErr } = await (supabase as any)
    .from("product_variants")
    .select("id, attributes")
    .eq("product_id", productId);
  if (exErr) throw exErr;
  // Only the size rows are ours to manage.
  const existingIds = new Set<string>(
    (existing ?? []).filter((r: any) => r?.attributes?.kind === "size").map((r: any) => r.id),
  );
  const keptIds = new Set<string>();
  for (let i = 0; i < clean.length; i++) {
    const e = clean[i];
    const payload = {
      product_id: productId,
      size: e.size.trim(),
      sku: e.sku?.trim() || null,
      price: e.price ?? null,
      compare_at_price: e.compare_at_price ?? null,
      stock: Number(e.stock) || 0,
      is_active: e.is_active ?? true,
      sort_order: i,
      position: i,
      attributes: { kind: "size" },
    };
    if (e.id && existingIds.has(e.id)) {
      keptIds.add(e.id);
      const { error } = await (supabase as any).from("product_variants").update(payload).eq("id", e.id);
      if (error) throw error;
    } else {
      const { error } = await (supabase as any).from("product_variants").insert(payload);
      if (error) throw error;
    }
  }
  const toDelete = Array.from(existingIds).filter((id) => !keptIds.has(id));
  if (toDelete.length) {
    const { error } = await (supabase as any).from("product_variants").delete().in("id", toDelete);
    if (error) throw error;
  }
  // Mirror active size labels onto products.sizes for the storefront selector.
  // Guard: only touch products.sizes when this editor is actually in use
  // (has rows now, or had size rows before) so we never wipe legacy sizes that
  // were set elsewhere (e.g. via import) on products that don't use per-size SKUs.
  if (clean.length > 0 || existingIds.size > 0) {
    const activeRows = clean.filter((e) => e.is_active !== false);
    const labels = activeRows.map((e) => e.size.trim());
    const update: Record<string, any> = { sizes: labels };
    // When sizes are in use, the per-size quantities ARE the product's stock —
    // sum them so storefront availability/status stays correct. (Products with
    // no inventory rows aren't touched by the warehouse stock-sync trigger.)
    if (clean.length > 0) {
      update.stock = activeRows.reduce((s, e) => s + (Number(e.stock) || 0), 0);
    }
    const { error: pErr } = await (supabase as any).from("products").update(update).eq("id", productId);
    if (pErr) throw pErr;
  }
}

async function syncProductAttributes(productId: string, entries: AttributeEntry[]) {
  const clean = entries.filter((e) => (e.attribute_key || "").trim() !== "");
  const { data: existing, error: exErr } = await (supabase as any).from("product_attributes").select("id").eq("product_id", productId);
  if (exErr) throw exErr;
  const existingIds = new Set<string>((existing ?? []).map((r: any) => r.id));
  const keptIds = new Set<string>();
  for (let i = 0; i < clean.length; i++) {
    const e = clean[i];
    const payload = {
      product_id: productId,
      attribute_key: e.attribute_key.trim(),
      value_ar: e.value_ar || null,
      value_en: e.value_en || null,
      color_hex: e.color_hex || null,
      image_url: e.image_url || null,
      stock: Number(e.stock) || 0,
      is_active: e.is_active ?? true,
      sort_order: i,
    };
    if (e.id && existingIds.has(e.id)) {
      keptIds.add(e.id);
      const { error } = await (supabase as any).from("product_attributes").update(payload).eq("id", e.id);
      if (error) throw error;
    } else {
      const { error } = await (supabase as any).from("product_attributes").insert(payload);
      if (error) throw error;
    }
  }
  const toDelete = Array.from(existingIds).filter((id) => !keptIds.has(id));
  if (toDelete.length) {
    const { error } = await (supabase as any).from("product_attributes").delete().in("id", toDelete);
    if (error) throw error;
  }
}

export function FormDialog({
  open, mode, table, title, fields, initialValues, rowId, onClose, onSaved,
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

  const warehouseStockField = useMemo(() => visibleFields.find((f) => f.type === "warehouseStock"), [visibleFields]);
  const variantsField = useMemo(() => visibleFields.find((f) => f.type === "productVariants"), [visibleFields]);
  const sizesField = useMemo(() => visibleFields.find((f) => f.type === "productSizes"), [visibleFields]);
  const attributesField = useMemo(() => visibleFields.find((f) => f.type === "productAttributes"), [visibleFields]);
  const junctionLookupFields = useMemo(() => visibleFields.filter((f) => f.type === "lookup" && f.lookup?.junction), [visibleFields]);

  useEffect(() => {
    if (open) { setValues(defaultsFrom(visibleFields, initialValues)); setErrors({}); }
  }, [open, initialValues, visibleFields]);

  useEffect(() => {
    if (!open || !warehouseStockField || mode !== "edit" || !rowId) { setExistingInventory({}); return; }
    (async () => {
      const { data } = await supabase.from("inventory").select("warehouse_id, quantity").eq("product_id", rowId).is("variant_id", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { map[r.warehouse_id] = r.quantity; });
      setExistingInventory(map);
      setValues((s) => ({ ...s, [warehouseStockField.key]: Object.entries(map).map(([wid, qty]) => ({ warehouse_id: wid, quantity: qty as number, enabled: true })) }));
    })();
  }, [open, mode, rowId, warehouseStockField]);

  useEffect(() => {
    if (!open || !variantsField || mode !== "edit" || !rowId) return;
    (async () => {
      const { data } = await (supabase as any).from("product_variants").select("id, color_name_ar, color_name_en, color_hex, color_image_url, size, sku, stock, is_active, sort_order, attributes").eq("product_id", rowId).order("sort_order", { ascending: true });
      // Exclude size rows — they belong to the Sizes & SKUs editor.
      const colourRows = ((data ?? []) as any[]).filter((r) => r?.attributes?.kind !== "size");
      setValues((s) => ({ ...s, [variantsField.key]: colourRows as VariantEntry[] }));
    })();
  }, [open, mode, rowId, variantsField]);

  useEffect(() => {
    if (!open || !sizesField || mode !== "edit" || !rowId) return;
    (async () => {
      const { data } = await (supabase as any).from("product_variants").select("id, size, sku, price, compare_at_price, stock, is_active, sort_order, attributes").eq("product_id", rowId).order("sort_order", { ascending: true });
      const sizeRows = ((data ?? []) as any[]).filter((r) => r?.attributes?.kind === "size");
      setValues((s) => ({ ...s, [sizesField.key]: sizeRows as SizeEntry[] }));
    })();
  }, [open, mode, rowId, sizesField]);

  useEffect(() => {
    if (!open || !attributesField || mode !== "edit" || !rowId) return;
    (async () => {
      const { data } = await (supabase as any).from("product_attributes").select("id, attribute_key, value_ar, value_en, color_hex, image_url, stock, is_active, sort_order").eq("product_id", rowId).order("sort_order", { ascending: true });
      setValues((s) => ({ ...s, [attributesField.key]: (data ?? []) as AttributeEntry[] }));
    })();
  }, [open, mode, rowId, attributesField]);

  useEffect(() => {
    if (!open || mode !== "edit" || !rowId || junctionLookupFields.length === 0) return;
    (async () => {
      for (const f of junctionLookupFields) {
        const j = f.lookup!.junction!;
        const { data } = await (supabase as any).from(j.table).select(j.itemColumn).eq(j.ownerColumn, rowId);
        const ids = (data ?? []).map((r: any) => r[j.itemColumn]).filter(Boolean);
        setValues((s) => ({ ...s, [f.key]: ids }));
      }
    })();
  }, [open, mode, rowId, junctionLookupFields]);

  const persistWarehouseStock = async (productId: string, entries: WarehouseStockEntry[]) => {
    const active = entries.filter((e) => e.enabled);
    for (const e of active) {
      const qty = Math.max(0, Number(e.quantity) || 0);
      const { data: existing } = await supabase.from("inventory").select("id").eq("product_id", productId).eq("warehouse_id", e.warehouse_id).is("variant_id", null).maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from("inventory").update({ quantity: qty, status: "active" } as any).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory").insert({ product_id: productId, warehouse_id: e.warehouse_id, variant_id: null, quantity: qty, status: "active" } as any);
        if (error) throw error;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let schema: z.ZodTypeAny;
    try { schema = buildSchema(fields, mode, ar); }
    catch (err: any) {
      console.error("[FormDialog] schema build failed", err);
      toast.error(ar ? `تعذّر بناء النموذج: ${err?.message ?? "خطأ داخلي"}` : `Failed to build form: ${err?.message ?? "internal error"}`);
      return;
    }
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i: ZodIssue) => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      const first = parsed.error.issues[0];
      const firstKey = String(first?.path?.[0] ?? "");
      const firstField = visibleFields.find((f) => f.key === firstKey);
      const fieldLabel = firstField ? (ar ? firstField.label.ar : firstField.label.en) : firstKey;
      toast.error(`${fieldLabel ? fieldLabel + ": " : ""}${first?.message ?? (ar ? "تحقق من الحقول المطلوبة" : "Check the highlighted fields")}`);
      console.warn("[FormDialog] validation failed", { issues: parsed.error.issues, values });
      return;
    }

    setSaving(true);
    const payload = coerceForDb(visibleFields, values);
    let productId = rowId;

    try {
      if (mode === "create") {
        const { data, error } = await supabase.from(table as any).insert(payload as any).select("id").single();
        if (error) { setSaving(false); console.error("[FormDialog] insert failed", { table, error, payload }); toast.error(error.message || (ar ? "فشل الإنشاء" : "Create failed")); return; }
        productId = (data as any)?.id;
      } else {
        const { error } = await supabase.from(table as any).update(payload as any).eq("id", rowId!);
        if (error) { setSaving(false); console.error("[FormDialog] update failed", { table, rowId, error, payload }); toast.error(error.message || (ar ? "فشل الحفظ" : "Update failed")); return; }
      }

      if (warehouseStockField && productId) {
        try { await persistWarehouseStock(productId, (values[warehouseStockField.key] as WarehouseStockEntry[]) ?? []); }
        catch (err: any) { setSaving(false); console.error("[FormDialog] warehouse stock failed", err); toast.error(err?.message || (ar ? "تعذر حفظ مخزون المستودعات" : "Failed to save warehouse stock")); return; }
      }

      if (productId && junctionLookupFields.length) {
        for (const f of junctionLookupFields) {
          try { await syncJunction(f.lookup!.junction!, productId, (values[f.key] as string[]) ?? []); }
          catch (err: any) { setSaving(false); console.error("[FormDialog] junction sync failed", { field: f.key, err }); toast.error(err?.message || `${ar ? f.label.ar : f.label.en}: ${ar ? "فشل الحفظ" : "save failed"}`); return; }
        }
      }

      if (variantsField && productId) {
        try { await syncProductVariants(productId, (values[variantsField.key] as VariantEntry[]) ?? []); }
        catch (err: any) { setSaving(false); console.error("[FormDialog] variants sync failed", err); toast.error(err?.message || (ar ? "تعذر حفظ الألوان" : "Failed to save colours")); return; }
      }

      if (sizesField && productId) {
        try { await syncProductSizes(productId, (values[sizesField.key] as SizeEntry[]) ?? []); }
        catch (err: any) { setSaving(false); console.error("[FormDialog] sizes sync failed", err); toast.error(err?.message || (ar ? "تعذر حفظ المقاسات" : "Failed to save sizes")); return; }
      }

      if (attributesField && productId) {
        try { await syncProductAttributes(productId, (values[attributesField.key] as AttributeEntry[]) ?? []); }
        catch (err: any) { setSaving(false); console.error("[FormDialog] attributes sync failed", err); toast.error(err?.message || (ar ? "تعذر حفظ التصنيفات الفرعية" : "Failed to save attributes")); return; }
      }

      setSaving(false);
      toast.success(ar ? (mode === "create" ? "تم الإنشاء" : "تم الحفظ") : mode === "create" ? "Created" : "Saved");
      onSaved();
      onClose();
    } catch (err: any) {
      setSaving(false);
      console.error("[FormDialog] unexpected error during save", err);
      toast.error(err?.message || (ar ? "حدث خطأ غير متوقع أثناء الحفظ" : "Unexpected error during save"));
    }
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
          <DialogDescription>{ar ? "املأ الحقول التالية" : "Fill in the fields below"}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleFields.map((f) => {
              const isFull = f.fullWidth ?? (
                f.type === "textarea" || f.type === "json" || f.type === "gallery" ||
                f.type === "videoGallery" || f.type === "image" || f.type === "video" ||
                f.type === "warehouseStock" ||
                f.type === "productVariants" || f.type === "productSizes" || f.type === "productAttributes" ||
                (f.type === "lookup" && (f.lookup?.multiple || !!f.lookup?.junction))
              );
              const lbl = ar ? f.label.ar : f.label.en;
              const ph = f.placeholder ? (ar ? f.placeholder.ar : f.placeholder.en) : undefined;
              const help = f.helpText ? (ar ? f.helpText.ar : f.helpText.en) : undefined;
              const err = errors[f.key];
              return (
                <div key={f.key} className={cn("space-y-1.5", isFull && "sm:col-span-2")}>
                  <Label htmlFor={f.key} className="text-xs">
                    {lbl} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  {f.type === "productVariants" ? (
                    <VariantEditor value={(Array.isArray(values[f.key]) ? values[f.key] : []) as VariantEntry[]} onChange={(v) => setVal(f.key, v)} />
                  ) : f.type === "productSizes" ? (
                    <SizeSkuEditor value={(Array.isArray(values[f.key]) ? values[f.key] : []) as SizeEntry[]} onChange={(v) => setVal(f.key, v)} basePrice={Number(values["price"]) || 0} currency={(values["currency"] as string) || "SAR"} />
                  ) : f.type === "productAttributes" ? (
                    <AttributesEditor value={(Array.isArray(values[f.key]) ? values[f.key] : []) as AttributeEntry[]} onChange={(v) => setVal(f.key, v)} />
                  ) : f.type === "lookup" && f.lookup ? (
                    <LookupField value={values[f.key]} onChange={(v) => setVal(f.key, v)} cfg={f.lookup} placeholder={ph} />
                  ) : f.type === "image" || f.type === "video" ? (
                    <MediaUploader value={values[f.key] ?? ""} onChange={(url) => setVal(f.key, url ?? "")} bucket={f.bucket || (f.type === "video" ? "product-media" : "content-media")} folder={f.folder} kind={f.type} />
                  ) : f.type === "gallery" || f.type === "videoGallery" ? (
                    <ProductMediaGallery value={Array.isArray(values[f.key]) ? values[f.key] : []} onChange={(urls) => setVal(f.key, urls)} bucket={f.bucket || "product-media"} folder={f.folder || (f.type === "videoGallery" ? "videos" : "gallery")} max={f.maxItems ?? (f.type === "videoGallery" ? 10 : 20)} kind={f.type === "videoGallery" ? "video" : "image"} />
                  ) : f.type === "warehouseStock" ? (
                    <WarehouseStockPicker value={Array.isArray(values[f.key]) ? values[f.key] : []} onChange={(v) => setVal(f.key, v)} existing={existingInventory} />
                  ) : f.type === "json" ? (
                    <FriendlyDataEditor value={values[f.key]} onChange={(v) => setVal(f.key, v)} />
                  ) : f.type === "textarea" ? (
                    <Textarea id={f.key} rows={f.rows ?? 4} value={values[f.key] ?? ""} onChange={(e) => setVal(f.key, e.target.value)} placeholder={ph} className="text-sm" />
                  ) : f.type === "select" ? (
                    <select id={f.key} value={values[f.key] ?? ""} onChange={(e) => setVal(f.key, e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => (<option key={o.value} value={o.value}>{ar ? o.label.ar : o.label.en}</option>))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <div className="flex items-center gap-2 h-9">
                      <Switch id={f.key} checked={Boolean(values[f.key])} onCheckedChange={(c) => setVal(f.key, c)} />
                      <span className="text-xs text-muted-foreground">{values[f.key] ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}</span>
                    </div>
                  ) : (
                    <Input id={f.key} type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : f.type === "color" ? "color" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text"} value={values[f.key] ?? ""} onChange={(e) => setVal(f.key, e.target.value)} placeholder={ph} min={f.min} max={f.max} step={f.step} maxLength={f.maxLength} />
                  )}
                  {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
                  {err && <p className="text-[11px] text-destructive">{err}</p>}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
