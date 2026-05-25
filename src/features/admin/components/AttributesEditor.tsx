// src/features/admin/components/AttributesEditor.tsx
//
// Flexible options-with-stock editor.
import { Plus, Trash2, Tag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { MediaUploader } from "./MediaUploader";
import { cn } from "@/lib/utils";

export type AttributeEntry = {
  id?: string;
  attribute_key: string;
  value_ar?: string;
  value_en?: string;
  color_hex?: string | null;
  image_url?: string | null;
  stock?: number;
  is_active?: boolean;
};

const SUGGESTED_KEYS: Array<{ key: string; label: { ar: string; en: string } }> = [
  { key: "color",     label: { ar: "اللون",          en: "Colour" } },
  { key: "size",      label: { ar: "المقاس",         en: "Size" } },
  { key: "age",       label: { ar: "العمر",          en: "Age" } },
  { key: "shape",     label: { ar: "الشكل",          en: "Shape" } },
  { key: "occasion",  label: { ar: "المناسبة",       en: "Occasion" } },
  { key: "material",  label: { ar: "الخامة",         en: "Material" } },
  { key: "season",    label: { ar: "الموسم",         en: "Season" } },
  { key: "style",     label: { ar: "الأسلوب",        en: "Style" } },
];

export function AttributesEditor({
  value,
  onChange,
  disabled,
}: {
  value: AttributeEntry[];
  onChange: (next: AttributeEntry[]) => void;
  disabled?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const update = (idx: number, patch: Partial<AttributeEntry>) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const addWithKey = (key: string) => {
    onChange([
      ...value,
      { attribute_key: key, value_ar: "", value_en: "", color_hex: null, image_url: null, stock: 0, is_active: true },
    ]);
  };

  const grouped = value.reduce<Record<string, number[]>>((acc, row, idx) => {
    const k = (row.attribute_key || "_other").toLowerCase();
    (acc[k] ||= []).push(idx);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
        {ar
          ? "أضف خيارات للمنتج (لون، مقاس، عمر، شكل، أو أي نوع تختاره). لكل خيار: قيمة، صورة (اختيارية)، ولون لو كان نوع الخيار \"اللون\". وحدّد المخزون لكل خيار — لما ينفد الخيار يختفي من المتجر تلقائياً."
          : "Add options to the product (colour, size, age, shape, or any custom type). Per option: value, optional image, and a hex colour for colour rows. Each option has its own stock — when it hits 0 the option disappears from the storefront."}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_KEYS.map((s) => (
          <button key={s.key} type="button" onClick={() => addWithKey(s.key)} disabled={disabled} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] hover:bg-muted/50 disabled:opacity-50">
            <Plus className="h-3 w-3" />
            {ar ? s.label.ar : s.label.en}
          </button>
        ))}
        <button type="button" onClick={() => addWithKey("")} disabled={disabled} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] hover:bg-muted/50 disabled:opacity-50">
          <Plus className="h-3 w-3" />
          {ar ? "نوع مخصص" : "Custom type"}
        </button>
      </div>

      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {ar ? "لا توجد خيارات. اضغط على أحد الاقتراحات في الأعلى للبدء." : "No options yet. Click a suggestion above to start."}
        </div>
      )}

      {Object.entries(grouped).map(([groupKey, idxs]) => (
        <div key={groupKey} className="rounded-lg border border-border bg-card/60 p-2">
          <div className="mb-2 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Tag className="h-3 w-3" />
            {groupKey === "_other" ? (ar ? "بدون نوع" : "Untyped") : groupKey}
            <span className="text-muted-foreground/60">· {idxs.length}</span>
          </div>
          <ul className="space-y-2">
            {idxs.map((idx) => {
              const row = value[idx];
              const isColorType = (row.attribute_key || "").toLowerCase() === "color";
              return (
                <li key={row.id ?? `new-${idx}`} className="rounded-md border border-border bg-background p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input type="text" value={row.attribute_key} onChange={(e) => update(idx, { attribute_key: e.target.value })} placeholder={ar ? "نوع الخيار" : "Option type"} className="h-7 w-32 rounded border border-input bg-background px-2 text-[11px]" />
                    <div className="flex items-center gap-2 text-[10px]">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={row.is_active ?? true} onChange={(e) => update(idx, { is_active: e.target.checked })} />
                        {ar ? "ظاهر" : "Active"}
                      </label>
                      <button type="button" onClick={() => remove(idx)} disabled={disabled} className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label={ar ? "حذف" : "Remove"}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">{ar ? "القيمة (عربي)" : "Value (AR)"}</label>
                      <input type="text" value={row.value_ar ?? ""} onChange={(e) => update(idx, { value_ar: e.target.value })} placeholder={isColorType ? (ar ? "أحمر" : "Red") : (ar ? "مثال: 0-2 سنوات" : "e.g. 0-2 years")} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">{ar ? "القيمة (إنجليزي)" : "Value (EN)"}</label>
                      <input type="text" value={row.value_en ?? ""} onChange={(e) => update(idx, { value_en: e.target.value })} placeholder={isColorType ? "Red" : "0-2 years"} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                    </div>

                    {isColorType && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">{ar ? "كود اللون (Hex)" : "Hex colour"}</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={row.color_hex || "#000000"} onChange={(e) => update(idx, { color_hex: e.target.value })} className="h-8 w-12 cursor-pointer rounded-md border border-input bg-background" />
                          <input type="text" value={row.color_hex ?? ""} onChange={(e) => update(idx, { color_hex: e.target.value })} placeholder="#ff66a1" className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs font-mono" dir="ltr" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">{ar ? "المخزون لهذا الخيار" : "Stock for this option"}</label>
                      <input type="number" min={0} value={row.stock ?? 0} onChange={(e) => update(idx, { stock: Number(e.target.value) })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                      <p className="text-[10px] text-muted-foreground">{ar ? "لما يصير صفر يختفي الخيار من المتجر" : "Option hides when stock hits 0"}</p>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] text-muted-foreground">{ar ? "صورة للخيار (اختياري)" : "Option image (optional)"}</label>
                      <MediaUploader value={row.image_url ?? ""} onChange={(url) => update(idx, { image_url: url || null })} bucket="product-media" folder="options" kind="image" />
                      {isColorType && (
                        <p className="text-[10px] text-muted-foreground">{ar ? "تظهر هذي الصورة كصورة رئيسية لما يختار العميل هذا اللون" : "Shown as main image when the customer picks this colour"}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <button type="button" onClick={() => addWithKey("")} disabled={disabled} className={cn("flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs", "text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50")}>
        <Plus className="h-3.5 w-3.5" />
        {ar ? "إضافة خيار" : "Add option"}
      </button>
    </div>
  );
}
