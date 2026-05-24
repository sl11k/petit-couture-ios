import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import {
  getProductVariantsAdmin,
  upsertOptionType,
  deleteOptionType,
  upsertOptionValue,
  deleteOptionValue,
  upsertVariant,
  deleteVariant,
  upsertVariantInventory,
} from "@/lib/variants.functions";

export const Route = createFileRoute("/admin/products/$id/variants")({
  component: VariantsAdminPage,
});

function VariantsAdminPage() {
  const { id } = useParams({ from: "/admin/products/$id/variants" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const qc = useQueryClient();

  const fetchAll = useServerFn(getProductVariantsAdmin);
  const { data, isLoading, error } = useQuery({
    queryKey: ["product-variants-admin", id],
    queryFn: () => fetchAll({ data: { productId: id } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["product-variants-admin", id] });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  }
  if (error || !data) {
    return <div className="p-6 text-sm text-destructive">{(error as any)?.message || "Failed to load"}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to="/admin/products/$id"
            params={{ id }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {ar ? "العودة للمنتج" : "Back to product"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {ar ? "المتغيرات والمخزون" : "Variants & inventory"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "أضف أنواع الخيارات (مثل لون/مقاس)، ثم القيم، ثم أنشئ المتغيرات وحدّد مخزون كل متغير لكل مستودع." : "Define option types (color/size), their values, then create variants and set per-warehouse stock."}
          </p>
        </div>
      </div>

      <OptionTypesSection productId={id} types={data.types} values={data.values} onChange={invalidate} ar={ar} />

      <VariantsSection
        productId={id}
        types={data.types}
        values={data.values}
        variants={data.variants}
        bridge={data.bridge}
        inventory={data.inventory}
        warehouses={data.warehouses}
        onChange={invalidate}
        ar={ar}
      />
    </div>
  );
}

/* ----------------------- Option types & values ----------------------- */

function OptionTypesSection({ productId, types, values, onChange, ar }: any) {
  const upsertType = useServerFn(upsertOptionType);
  const delType = useServerFn(deleteOptionType);
  const upsertValue = useServerFn(upsertOptionValue);
  const delValue = useServerFn(deleteOptionValue);

  const [newTypeName, setNewTypeName] = useState("");

  const addType = useMutation({
    mutationFn: () => upsertType({ data: { product_id: productId, name: newTypeName.trim(), position: types.length } }),
    onSuccess: () => { setNewTypeName(""); onChange(); toast.success(ar ? "تمت الإضافة" : "Added"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-lg font-medium">{ar ? "أنواع الخيارات" : "Option types"}</h2>

      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder={ar ? "مثال: اللون، المقاس" : "e.g. Color, Size"}
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
        />
        <button
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!newTypeName.trim() || addType.isPending}
          onClick={() => addType.mutate()}
        >
          <Plus className="size-4" /> {ar ? "إضافة نوع" : "Add type"}
        </button>
      </div>

      {types.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ar ? "لا توجد أنواع بعد." : "No option types yet."}</p>
      ) : (
        <div className="space-y-4">
          {types.map((t: any) => (
            <OptionTypeCard
              key={t.id}
              type={t}
              values={values.filter((v: any) => v.option_type_id === t.id)}
              onSaveType={async (patch) => { await upsertType({ data: { id: t.id, product_id: productId, name: patch.name, name_en: patch.name_en, position: patch.position } }); onChange(); }}
              onDeleteType={async () => { if (confirm(ar ? "حذف هذا النوع وكل قيمه؟" : "Delete this type and all its values?")) { await delType({ data: { id: t.id } }); onChange(); } }}
              onSaveValue={async (val) => { await upsertValue({ data: { id: val.id, option_type_id: t.id, value: val.value, value_en: val.value_en, hex_color: val.hex_color, image_url: val.image_url, position: val.position ?? 0 } }); onChange(); }}
              onDeleteValue={async (id) => { await delValue({ data: { id } }); onChange(); }}
              ar={ar}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OptionTypeCard({ type, values, onSaveType, onDeleteType, onSaveValue, onDeleteValue, ar }: any) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ name: type.name, name_en: type.name_en ?? "", position: type.position });
  const [newValue, setNewValue] = useState({ value: "", value_en: "", hex_color: "", image_url: "" });

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        {edit ? (
          <div className="flex flex-1 gap-2">
            <input className="rounded border bg-card px-2 py-1 text-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={ar ? "اسم عربي" : "Name (AR)"} />
            <input className="rounded border bg-card px-2 py-1 text-sm" value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} placeholder="Name (EN)" />
            <button className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground" onClick={async () => { await onSaveType(draft); setEdit(false); }}><Save className="size-3" /></button>
            <button className="rounded border px-2 py-1 text-xs" onClick={() => setEdit(false)}><X className="size-3" /></button>
          </div>
        ) : (
          <div className="font-medium">{type.name} {type.name_en && <span className="text-xs text-muted-foreground">({type.name_en})</span>}</div>
        )}
        <div className="flex gap-1">
          {!edit && <button className="rounded p-1 hover:bg-muted" onClick={() => setEdit(true)}><Pencil className="size-3.5" /></button>}
          <button className="rounded p-1 text-destructive hover:bg-muted" onClick={onDeleteType}><Trash2 className="size-3.5" /></button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {values.map((v: any) => (
          <div key={v.id} className="flex items-center gap-2 rounded border bg-card p-2 text-sm">
            {v.hex_color && <span className="inline-block size-4 rounded-full border" style={{ background: v.hex_color }} />}
            <span className="flex-1">{v.value}{v.value_en && <span className="text-xs text-muted-foreground"> ({v.value_en})</span>}</span>
            <button className="rounded p-1 text-destructive hover:bg-muted" onClick={() => { if (confirm(ar ? "حذف القيمة؟" : "Delete value?")) onDeleteValue(v.id); }}><Trash2 className="size-3.5" /></button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <input className="w-32 rounded border bg-card px-2 py-1 text-sm" placeholder={ar ? "القيمة" : "Value"} value={newValue.value} onChange={(e) => setNewValue({ ...newValue, value: e.target.value })} />
          <input className="w-32 rounded border bg-card px-2 py-1 text-sm" placeholder="Value (EN)" value={newValue.value_en} onChange={(e) => setNewValue({ ...newValue, value_en: e.target.value })} />
          <input className="w-24 rounded border bg-card px-2 py-1 text-sm" placeholder="#hex" value={newValue.hex_color} onChange={(e) => setNewValue({ ...newValue, hex_color: e.target.value })} />
          <button
            className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs"
            disabled={!newValue.value.trim()}
            onClick={async () => {
              await onSaveValue({ ...newValue, position: values.length });
              setNewValue({ value: "", value_en: "", hex_color: "", image_url: "" });
            }}
          >
            <Plus className="size-3" /> {ar ? "إضافة قيمة" : "Add value"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Variants ----------------------- */

function VariantsSection({ productId, types, values, variants, bridge, inventory, warehouses, onChange, ar }: any) {
  const upsert = useServerFn(upsertVariant);
  const del = useServerFn(deleteVariant);
  const upsertInv = useServerFn(upsertVariantInventory);

  const valuesByVariant = useMemo(() => {
    const map = new Map<string, Set<string>>();
    bridge.forEach((b: any) => {
      if (!map.has(b.variant_id)) map.set(b.variant_id, new Set());
      map.get(b.variant_id)!.add(b.option_value_id);
    });
    return map;
  }, [bridge]);

  const valuesById = useMemo(() => {
    const m = new Map<string, any>();
    values.forEach((v: any) => m.set(v.id, v));
    return m;
  }, [values]);

  const typeNameById = useMemo(() => {
    const m = new Map<string, string>();
    types.forEach((t: any) => m.set(t.id, ar ? t.name : (t.name_en || t.name)));
    return m;
  }, [types, ar]);

  const labelForVariant = (variantId: string) => {
    const ids = valuesByVariant.get(variantId);
    if (!ids || ids.size === 0) return ar ? "(بدون خيارات)" : "(no options)";
    return Array.from(ids).map((vid) => {
      const v = valuesById.get(vid);
      if (!v) return "";
      const typeName = typeNameById.get(v.option_type_id) || "";
      return `${typeName}: ${ar ? v.value : (v.value_en || v.value)}`;
    }).join(" • ");
  };

  const [editing, setEditing] = useState<any>(null); // variant being created/edited

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">{ar ? "المتغيرات" : "Variants"}</h2>
        <button
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          disabled={types.length === 0}
          onClick={() => setEditing({ product_id: productId, sku: "", is_active: true, position: variants.length, option_value_ids: [] })}
        >
          <Plus className="size-4" /> {ar ? "متغير جديد" : "New variant"}
        </button>
      </div>

      {types.length === 0 && (
        <p className="text-sm text-muted-foreground">{ar ? "أضف نوع خيار واحد على الأقل أولاً." : "Add at least one option type first."}</p>
      )}

      {variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ar ? "لا توجد متغيرات بعد." : "No variants yet."}</p>
      ) : (
        <div className="space-y-3">
          {variants.map((v: any) => (
            <div key={v.id} className="rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{labelForVariant(v.id)}</div>
                  <div className="text-xs text-muted-foreground">
                    SKU: {v.sku || "—"} • {ar ? "السعر" : "Price"}: {v.price_override ?? (ar ? "افتراضي" : "default")} • {v.is_active ? (ar ? "مفعل" : "active") : (ar ? "معطل" : "inactive")}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="rounded p-1 hover:bg-muted" onClick={() => setEditing({ ...v, option_value_ids: Array.from(valuesByVariant.get(v.id) ?? []) })}><Pencil className="size-3.5" /></button>
                  <button className="rounded p-1 text-destructive hover:bg-muted" onClick={async () => { if (confirm(ar ? "حذف المتغير؟" : "Delete variant?")) { await del({ data: { id: v.id } }); onChange(); } }}><Trash2 className="size-3.5" /></button>
                </div>
              </div>

              {/* Per-warehouse inventory editor */}
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {warehouses.map((w: any) => {
                  const inv = inventory.find((i: any) => i.variant_id === v.id && i.warehouse_id === w.id);
                  return (
                    <InventoryRow
                      key={w.id}
                      warehouse={w}
                      inv={inv}
                      ar={ar}
                      onSave={async (qty, lowThreshold, sku) => {
                        await upsertInv({ data: { product_id: productId, variant_id: v.id, warehouse_id: w.id, quantity: qty, low_stock_threshold: lowThreshold, sku } });
                        onChange();
                        toast.success(ar ? "تم الحفظ" : "Saved");
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <VariantDialog
          editing={editing}
          types={types}
          values={values}
          ar={ar}
          onCancel={() => setEditing(null)}
          onSave={async (payload) => {
            await upsert({ data: payload });
            setEditing(null);
            onChange();
            toast.success(ar ? "تم الحفظ" : "Saved");
          }}
        />
      )}
    </section>
  );
}

function InventoryRow({ warehouse, inv, ar, onSave }: any) {
  const [qty, setQty] = useState<number>(inv?.quantity ?? 0);
  const [threshold, setThreshold] = useState<number>(inv?.low_stock_threshold ?? 5);
  const [sku, setSku] = useState<string>(inv?.sku ?? "");
  return (
    <div className="rounded border bg-card p-2 text-sm">
      <div className="mb-1 font-medium">{warehouse.name} <span className="text-xs text-muted-foreground">({warehouse.code})</span></div>
      <div className="flex gap-1">
        <input type="number" className="w-20 rounded border bg-background px-2 py-1 text-xs" value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder={ar ? "الكمية" : "Qty"} />
        <input type="number" className="w-20 rounded border bg-background px-2 py-1 text-xs" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} placeholder={ar ? "حد منخفض" : "Low"} />
        <input className="flex-1 rounded border bg-background px-2 py-1 text-xs" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
        <button className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground" onClick={() => onSave(qty, threshold, sku || null)}><Save className="size-3" /></button>
      </div>
    </div>
  );
}

function VariantDialog({ editing, types, values, onCancel, onSave, ar }: any) {
  const [form, setForm] = useState<any>(editing);
  const setOptionValue = (typeId: string, valueId: string | null) => {
    // Replace any chosen value for this type
    const typeValueIds = new Set(values.filter((v: any) => v.option_type_id === typeId).map((v: any) => v.id));
    const next = (form.option_value_ids as string[]).filter((id) => !typeValueIds.has(id));
    if (valueId) next.push(valueId);
    setForm({ ...form, option_value_ids: next });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-4">
        <h3 className="text-lg font-medium">{editing.id ? (ar ? "تعديل متغير" : "Edit variant") : (ar ? "متغير جديد" : "New variant")}</h3>

        <div className="space-y-3">
          {types.map((t: any) => {
            const typeValues = values.filter((v: any) => v.option_type_id === t.id);
            const selected = (form.option_value_ids as string[]).find((id) => typeValues.some((v: any) => v.id === id)) || "";
            return (
              <div key={t.id}>
                <label className="mb-1 block text-xs text-muted-foreground">{ar ? t.name : (t.name_en || t.name)}</label>
                <select className="w-full rounded border bg-background px-2 py-1.5 text-sm" value={selected} onChange={(e) => setOptionValue(t.id, e.target.value || null)}>
                  <option value="">{ar ? "— اختر —" : "— select —"}</option>
                  {typeValues.map((v: any) => (
                    <option key={v.id} value={v.id}>{ar ? v.value : (v.value_en || v.value)}</option>
                  ))}
                </select>
              </div>
            );
          })}

          <div className="grid grid-cols-2 gap-2">
            <Field label="SKU" value={form.sku ?? ""} onChange={(v) => setForm({ ...form, sku: v })} />
            <Field label={ar ? "الباركود" : "Barcode"} value={form.barcode ?? ""} onChange={(v) => setForm({ ...form, barcode: v })} />
            <Field label={ar ? "سعر مخصص" : "Price override"} type="number" value={form.price_override ?? ""} onChange={(v) => setForm({ ...form, price_override: v === "" ? null : Number(v) })} />
            <Field label={ar ? "سعر قبل الخصم" : "Compare-at"} type="number" value={form.compare_at_price_override ?? ""} onChange={(v) => setForm({ ...form, compare_at_price_override: v === "" ? null : Number(v) })} />
            <Field label={ar ? "صورة" : "Image URL"} value={form.image_url ?? ""} onChange={(v) => setForm({ ...form, image_url: v })} />
            <Field label={ar ? "ترتيب" : "Position"} type="number" value={form.position ?? 0} onChange={(v) => setForm({ ...form, position: Number(v) || 0 })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            {ar ? "مفعل" : "Active"}
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button className="rounded border px-3 py-1.5 text-sm" onClick={onCancel}>{ar ? "إلغاء" : "Cancel"}</button>
          <button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={() => onSave(form)}>{ar ? "حفظ" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input type={type} className="w-full rounded border bg-background px-2 py-1.5 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
