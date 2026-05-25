// src/features/admin/components/AttributesEditor.tsx
//
// Free-form sub-attribute editor for products — covers "age", "shape",
// "occasion", any custom attribute the admin invents without a DB migration.
import { Plus, Trash2, Tag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export type AttributeEntry = {
  id?: string;
  attribute_key: string;
  value_ar?: string;
  value_en?: string;
};

const SUGGESTED_KEYS: Array<{ key: string; label: { ar: string; en: string } }> = [
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
    onChange([...value, { attribute_key: key, value_ar: "", value_en: "" }]);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
        {ar
          ? "أضف تصنيفات فرعية مرنة للمنتج — مثل العمر (0-2 سنوات)، الشكل (دائري)، المناسبة (عيد)."
          : "Add flexible sub-attributes — like Age (0-2 years), Shape (round), Occasion (Eid)."}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_KEYS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => addWithKey(s.key)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] hover:bg-muted/50 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {ar ? s.label.ar : s.label.en}
          </button>
        ))}
      </div>

      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {ar
            ? "لا توجد تصنيفات فرعية. اضغط على أحد الاقتراحات في الأعلى."
            : "No sub-attributes yet. Click a suggestion above to start."}
        </div>
      )}

      <ul className="space-y-2">
        {value.map((row, idx) => (
          <li key={row.id ?? `new-${idx}`} className="rounded-md border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {row.attribute_key || (ar ? "بدون نوع" : "No type")}
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={disabled}
                className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                aria-label={ar ? "حذف" : "Remove"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  {ar ? "نوع التصنيف" : "Attribute key"}
                </label>
                <input
                  type="text"
                  value={row.attribute_key}
                  onChange={(e) => update(idx, { attribute_key: e.target.value })}
                  placeholder="age / shape / occasion"
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  {ar ? "القيمة بالعربية" : "Value (AR)"}
                </label>
                <input
                  type="text"
                  value={row.value_ar ?? ""}
                  onChange={(e) => update(idx, { value_ar: e.target.value })}
                  placeholder={ar ? "مثال: 0-2 سنوات" : "e.g. 0-2 years"}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  {ar ? "القيمة بالإنجليزية" : "Value (EN)"}
                </label>
                <input
                  type="text"
                  value={row.value_en ?? ""}
                  onChange={(e) => update(idx, { value_en: e.target.value })}
                  placeholder="0-2 years"
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => addWithKey("")}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs",
          "text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {ar ? "إضافة تصنيف فرعي مخصص" : "Add custom sub-attribute"}
      </button>
    </div>
  );
}

