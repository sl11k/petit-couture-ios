// src/features/admin/components/VariantEditor.tsx
//
// Repeatable colour-variant editor used inside the product form.
// Each row = one colour, with its own image swatch. When the customer clicks
// a swatch in the storefront the gallery swaps to color_image_url.
import { Plus, Trash2, GripVertical } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { MediaUploader } from "./MediaUploader";
import { cn } from "@/lib/utils";

export type VariantEntry = {
  id?: string;
  color_name_ar?: string;
  color_name_en?: string;
  color_hex?: string;
  color_image_url?: string;
  size?: string;
  sku?: string;
  stock?: number;
  is_active?: boolean;
};

export function VariantEditor({
  value,
  onChange,
  disabled,
}: {
  value: VariantEntry[];
  onChange: (next: VariantEntry[]) => void;
  disabled?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const update = (idx: number, patch: Partial<VariantEntry>) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([
      ...value,
      { color_name_ar: "", color_name_en: "", color_hex: "#000000", color_image_url: "", size: "", sku: "", stock: 0, is_active: true },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
        {ar
          ? "أضف لوناً واحداً لكل متغيّر. اختر صورة لكل لون — لما يضغط العميل على اللون في المتجر تتبدّل الصورة تلقائياً."
          : "Add one entry per colour. Pick an image per colour — clicking the swatch in the storefront swaps the gallery."}
      </div>

      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {ar ? "لا توجد ألوان بعد — اضغط \"إضافة لون\" للبدء" : "No colours yet — click \"Add colour\" to start"}
        </div>
      )}

      <ul className="space-y-2">
        {value.map((row, idx) => (
          <li key={row.id ?? `new-${idx}`} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                {ar ? `لون #${idx + 1}` : `Colour #${idx + 1}`}
                {row.color_hex && (
                  <span className="inline-block h-4 w-4 rounded-full border border-border align-middle" style={{ backgroundColor: row.color_hex }} aria-hidden />
                )}
              </div>
              <button type="button" onClick={() => remove(idx)} disabled={disabled} className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label={ar ? "حذف اللون" : "Remove colour"}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{ar ? "اسم اللون بالعربية" : "Colour name (AR)"}</label>
                <input type="text" value={row.color_name_ar ?? ""} onChange={(e) => update(idx, { color_name_ar: e.target.value })} placeholder={ar ? "مثال: أحمر" : "e.g. Red"} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{ar ? "اسم اللون بالإنجليزية" : "Colour name (EN)"}</label>
                <input type="text" value={row.color_name_en ?? ""} onChange={(e) => update(idx, { color_name_en: e.target.value })} placeholder="Red" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{ar ? "كود اللون (Hex)" : "Hex colour"}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={row.color_hex || "#000000"} onChange={(e) => update(idx, { color_hex: e.target.value })} className="h-8 w-12 cursor-pointer rounded-md border border-input bg-background" />
                  <input type="text" value={row.color_hex ?? ""} onChange={(e) => update(idx, { color_hex: e.target.value })} placeholder="#ff66a1" className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs font-mono" dir="ltr" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{ar ? "المقاس (اختياري)" : "Size (optional)"}</label>
                <input type="text" value={row.size ?? ""} onChange={(e) => update(idx, { size: e.target.value })} placeholder="S / M / L" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">SKU</label>
                <input type="text" value={row.sku ?? ""} onChange={(e) => update(idx, { sku: e.target.value })} placeholder="SKU-001" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-mono" dir="ltr" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{ar ? "المخزون لهذا اللون" : "Stock for this colour"}</label>
                <input type="number" min={0} value={row.stock ?? 0} onChange={(e) => update(idx, { stock: Number(e.target.value) })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] text-muted-foreground">{ar ? "صورة هذا اللون" : "Image for this colour"}</label>
                <MediaUploader value={row.color_image_url ?? ""} onChange={(url) => update(idx, { color_image_url: url ?? "" })} bucket="product-media" folder="variants" kind="image" />
                <p className="text-[10px] text-muted-foreground">{ar ? "هذي الصورة تظهر لما يختار العميل هذا اللون في المتجر" : "Shown when the shopper picks this colour in the storefront"}</p>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={row.is_active ?? true} onChange={(e) => update(idx, { is_active: e.target.checked })} id={`variant-active-${idx}`} />
                <label htmlFor={`variant-active-${idx}`} className="text-xs">{ar ? "متاح للبيع" : "Available for sale"}</label>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" onClick={add} disabled={disabled} className={cn("flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs", "text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50")}>
        <Plus className="h-3.5 w-3.5" />
        {ar ? "إضافة لون جديد" : "Add new colour"}
      </button>
    </div>
  );
}

