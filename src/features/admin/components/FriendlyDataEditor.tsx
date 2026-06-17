import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * FriendlyDataEditor — يستبدل حقول JSON بواجهة بسيطة:
 *  - مصفوفة نصوص    → قائمة عناصر (سطر = عنصر)
 *  - مصفوفة كائنات  → جدول حقول لكل عنصر
 *  - كائن            → صفوف (اسم الحقل + القيمة)
 *  - فارغ            → يبدأ كقائمة بسيطة
 *
 * القيمة دائماً تُحفظ ككائن/مصفوفة جافاسكربت أصلية — لا JSON نصي.
 */

type AnyValue = any;

function coerceScalar(v: string): AnyValue {
  const t = v.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
  }
  return v;
}

function toDisplay(v: AnyValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
}

function detectShape(value: AnyValue): "array-string" | "array-object" | "object" | "empty" {
  if (value === null || value === undefined) return "empty";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array-string";
    const first = value[0];
    if (first && typeof first === "object" && !Array.isArray(first)) return "array-object";
    return "array-string";
  }
  if (typeof value === "object") {
    if (Object.keys(value).length === 0) return "empty";
    return "object";
  }
  return "empty";
}

export function FriendlyDataEditor({
  value,
  onChange,
}: {
  value: AnyValue;
  onChange: (v: AnyValue) => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const shape = useMemo(() => detectShape(value), [value]);

  // Empty → ask user to pick mode
  if (shape === "empty") {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          {ar ? "اختر طريقة الإدخال:" : "Choose input style:"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([""])}>
            <Plus className="h-3 w-3 me-1" />
            {ar ? "قائمة عناصر" : "List of items"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ "": "" })}>
            <Plus className="h-3 w-3 me-1" />
            {ar ? "حقول (اسم/قيمة)" : "Fields (name/value)"}
          </Button>
        </div>
      </div>
    );
  }

  if (shape === "array-string") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {arr.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
            <Input
              value={toDisplay(item)}
              onChange={(e) => {
                const next = [...arr];
                next[idx] = coerceScalar(e.target.value);
                onChange(next);
              }}
              placeholder={ar ? "قيمة..." : "Value..."}
              className="text-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                const next = arr.filter((_, i) => i !== idx);
                onChange(next.length ? next : null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...arr, ""])}>
          <Plus className="h-3 w-3 me-1" />
          {ar ? "إضافة عنصر" : "Add item"}
        </Button>
      </div>
    );
  }

  if (shape === "array-object") {
    const arr = Array.isArray(value) ? value : [];
    // Collect union of keys from all items so columns are stable
    const keys = Array.from(
      new Set(arr.flatMap((it) => (it && typeof it === "object" ? Object.keys(it) : []))),
    );
    return (
      <div className="space-y-3">
        {arr.map((item, idx) => (
          <div key={idx} className="rounded-md border border-border bg-card p-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  const next = arr.filter((_, i) => i !== idx);
                  onChange(next.length ? next : null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {keys.map((k) => (
                <div key={k} className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">{k}</label>
                  <Input
                    value={toDisplay(item?.[k])}
                    onChange={(e) => {
                      const next = [...arr];
                      next[idx] = { ...(next[idx] || {}), [k]: coerceScalar(e.target.value) };
                      onChange(next);
                    }}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const template: Record<string, AnyValue> = {};
            keys.forEach((k) => (template[k] = ""));
            onChange([...arr, template]);
          }}
        >
          <Plus className="h-3 w-3 me-1" />
          {ar ? "إضافة عنصر" : "Add item"}
        </Button>
      </div>
    );
  }

  // object
  const obj = value && typeof value === "object" ? (value as Record<string, AnyValue>) : {};
  const entries = Object.entries(obj);
  return (
    <div className="space-y-2">
      {entries.map(([k, v], idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <Input
            value={k}
            onChange={(e) => {
              const newKey = e.target.value;
              const next: Record<string, AnyValue> = {};
              entries.forEach(([kk, vv], i) => {
                if (i === idx) next[newKey] = vv;
                else next[kk] = vv;
              });
              onChange(next);
            }}
            placeholder={ar ? "الاسم" : "Name"}
            className="text-sm w-1/3"
          />
          <Input
            value={toDisplay(v)}
            onChange={(e) => {
              const next = { ...obj, [k]: coerceScalar(e.target.value) };
              onChange(next);
            }}
            placeholder={ar ? "القيمة" : "Value"}
            className="text-sm flex-1"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              const next = { ...obj };
              delete next[k];
              onChange(Object.keys(next).length ? next : null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange({ ...obj, "": "" })}
      >
        <Plus className="h-3 w-3 me-1" />
        {ar ? "إضافة حقل" : "Add field"}
      </Button>
    </div>
  );
}

/**
 * FriendlyDataView — يعرض قيمة كائن/مصفوفة بطريقة قابلة للقراءة بدل JSON.
 */
export function FriendlyDataView({ value }: { value: AnyValue }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  // Parse if stringified accidentally
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return <span className="text-sm whitespace-pre-wrap">{v}</span>;
    }
  }

  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">{ar ? "(فارغ)" : "(empty)"}</span>;
    const allScalar = v.every((x) => x === null || typeof x !== "object");
    if (allScalar) {
      return (
        <ul className="list-disc ps-5 text-sm space-y-0.5">
          {v.map((x, i) => (
            <li key={i}>{String(x)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {v.map((item, i) => (
          <div key={i} className="rounded-md border border-border bg-muted/20 p-2">
            <div className="text-[11px] text-muted-foreground mb-1">#{i + 1}</div>
            <FriendlyDataView value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, AnyValue>);
    if (entries.length === 0) return <span className="text-muted-foreground">{ar ? "(فارغ)" : "(empty)"}</span>;
    return (
      <dl className="grid grid-cols-1 gap-1 text-sm">
        {entries.map(([k, val]) => (
          <div key={k} className="flex gap-2 items-start">
            <dt className="text-muted-foreground min-w-[100px]">{k}:</dt>
            <dd className="flex-1 break-words">
              {val !== null && typeof val === "object" ? (
                <FriendlyDataView value={val} />
              ) : (
                String(val ?? "")
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span className="text-sm">{String(v)}</span>;
}
