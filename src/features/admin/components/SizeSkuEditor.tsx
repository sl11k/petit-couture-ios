// src/features/admin/components/SizeSkuEditor.tsx
//
// Per-size SKU editor used inside the product form.
// Each row = one size (e.g. "3 Years") with its OWN SKU, price and stock —
// exactly what a product with 7-8 ages needs. Saves to `product_variants`
// rows tagged `attributes.kind = "size"` (see syncProductSizes in FormDialog).
import { Plus, Trash2, Wand2, Hash, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export type SizeEntry = {
  id?: string;
  size: string;
  sku?: string;
  price?: number | null;
  compare_at_price?: number | null;
  stock?: number;
  is_active?: boolean;
};

// digits inside a size label, e.g. "3 Years" -> "3"
const digitsOf = (s: string) => (s.match(/\d+/)?.[0] ?? "");

// Grammatically correct age label per language.
const ageLabel = (n: number, ar: boolean) => {
  if (ar) {
    if (n === 1) return "سنة";
    if (n === 2) return "سنتان";
    if (n >= 3 && n <= 10) return `${n} سنوات`;
    return `${n} سنة`;
  }
  return `${n} ${n === 1 ? "Year" : "Years"}`;
};

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

export function SizeSkuEditor({
  value,
  onChange,
  disabled,
  basePrice = 0,
  currency = "SAR",
}: {
  value: SizeEntry[];
  onChange: (next: SizeEntry[]) => void;
  disabled?: boolean;
  basePrice?: number;
  currency?: string;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  // quick-tools state
  const [fromAge, setFromAge] = useState(3);
  const [toAge, setToAge] = useState(10);
  const [skuBase, setSkuBase] = useState("");
  const [skuSuffix, setSkuSuffix] = useState("Y");
  const [priceAll, setPriceAll] = useState<string>("");

  const update = (idx: number, patch: Partial<SizeEntry>) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const add = () => {
    onChange([
      ...value,
      { size: "", sku: "", price: basePrice || null, stock: 0, is_active: true },
    ]);
  };

  // Generate one row per age in the range, skipping ages that already exist.
  const generateAges = () => {
    const lo = Math.min(fromAge, toAge);
    const hi = Math.max(fromAge, toAge);
    const existing = new Set(value.map((r) => norm(r.size)).filter(Boolean));
    const added: SizeEntry[] = [];
    for (let n = lo; n <= hi; n++) {
      const label = ageLabel(n, ar);
      if (existing.has(norm(label))) continue;
      added.push({ size: label, sku: "", price: basePrice || null, stock: 0, is_active: true });
    }
    if (added.length) onChange([...value, ...added]);
  };

  // Apply one price to every row (uses the typed value, else the base price).
  const applyPriceToAll = () => {
    const p = priceAll.trim() === "" ? (basePrice || null) : Number(priceAll);
    onChange(value.map((r) => ({ ...r, price: p })));
  };

  // Fill empty SKUs as `${base}${ageDigits}${suffix}` → e.g. VESTIDO481 + 3 + Y = VESTIDO4813Y
  const autoFillSkus = (overwrite = false) => {
    const base = skuBase.trim();
    if (!base) return;
    onChange(
      value.map((r) => {
        if (!overwrite && r.sku && r.sku.trim()) return r;
        const d = digitsOf(r.size);
        return { ...r, sku: `${base}${d}${skuSuffix.trim()}` };
      }),
    );
  };

  // Duplicate detection + totals for the summary line.
  const sizeCounts = value.reduce<Record<string, number>>((a, r) => { const k = norm(r.size); if (k) a[k] = (a[k] || 0) + 1; return a; }, {});
  const skuCounts = value.reduce<Record<string, number>>((a, r) => { const k = norm(r.sku); if (k) a[k] = (a[k] || 0) + 1; return a; }, {});
  const totalQty = value.reduce((s, r) => s + (Number(r.stock) || 0), 0);
  const namedCount = value.filter((r) => (r.size || "").trim() !== "").length;
  const dupSizes = Object.values(sizeCounts).some((n) => n > 1);
  const dupSkus = Object.values(skuCounts).some((n) => n > 1);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
        {ar
          ? "أضف صفاً لكل مقاس/عمر، ولكل مقاس كود (SKU) وسعر وكمية مستقلة. استخدم الأدوات السريعة بالأسفل لتوليد الأعمار وتعبئة الأكواد تلقائياً بدل كتابتها واحداً واحداً."
          : "Add one row per size/age, each with its own SKU, price and quantity. Use the quick tools below to generate the ages and auto-fill the SKUs instead of typing each one."}
      </div>

      {/* Quick tools */}
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-border bg-card/40 p-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Wand2 className="h-3 w-3" /> {ar ? "توليد الأعمار" : "Generate ages"}
          </label>
          <div className="flex items-center gap-1.5">
            <input type="number" min={0} max={30} value={fromAge} onChange={(e) => setFromAge(Number(e.target.value))} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs" aria-label={ar ? "من عمر" : "From age"} />
            <span className="text-[11px] text-muted-foreground">{ar ? "إلى" : "to"}</span>
            <input type="number" min={0} max={30} value={toAge} onChange={(e) => setToAge(Number(e.target.value))} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs" aria-label={ar ? "إلى عمر" : "To age"} />
            <button type="button" onClick={generateAges} disabled={disabled} className="inline-flex h-8 items-center gap-1 rounded-md bg-secondary px-2.5 text-[11px] hover:bg-secondary/80 disabled:opacity-50">
              <Plus className="h-3 w-3" /> {ar ? "توليد" : "Generate"}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Hash className="h-3 w-3" /> {ar ? "تعبئة الأكواد تلقائياً" : "Auto-fill SKUs"}
          </label>
          <div className="flex items-center gap-1.5">
            <input type="text" value={skuBase} onChange={(e) => setSkuBase(e.target.value)} placeholder={ar ? "بادئة الكود مثل VESTIDO481" : "base e.g. VESTIDO481"} className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs font-mono" dir="ltr" />
            <input type="text" value={skuSuffix} onChange={(e) => setSkuSuffix(e.target.value)} placeholder={ar ? "لاحقة" : "suffix"} className="h-8 w-14 rounded-md border border-input bg-background px-2 text-xs font-mono" dir="ltr" aria-label={ar ? "لاحقة الكود" : "SKU suffix"} />
            <button type="button" onClick={() => autoFillSkus(false)} disabled={disabled || !skuBase.trim()} className="inline-flex h-8 items-center gap-1 rounded-md bg-secondary px-2.5 text-[11px] hover:bg-secondary/80 disabled:opacity-50" title={ar ? "تعبئة الأكواد الفارغة فقط" : "Fill empty SKUs only"}>
              {ar ? "تعبئة" : "Fill"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground" dir="ltr">
            {skuBase.trim() ? `${skuBase.trim()}${digitsOf(value[0]?.size || "3")}${skuSuffix.trim()} …` : ""}
          </p>
        </div>
      </div>

      {/* Bulk price + live summary */}
      {value.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-md border border-input bg-background">
              <span className="px-1.5 text-[10px] text-muted-foreground">{currency}</span>
              <input type="number" min={0} step={0.01} value={priceAll} onChange={(e) => setPriceAll(e.target.value)} placeholder={String(basePrice || "")} className="h-7 w-20 bg-transparent px-1 text-xs outline-none" dir="ltr" aria-label={ar ? "سعر موحّد" : "Uniform price"} />
            </div>
            <button type="button" onClick={applyPriceToAll} disabled={disabled} className="h-7 rounded-md bg-secondary px-2.5 text-[11px] hover:bg-secondary/80 disabled:opacity-50">
              {ar ? "طبّق السعر على الكل" : "Apply price to all"}
            </button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {ar ? `${namedCount} مقاس · المخزون الكلي ${totalQty}` : `${namedCount} sizes · ${totalQty} total stock`}
          </div>
        </div>
      )}

      {(dupSizes || dupSkus) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
          {ar
            ? `تنبيه: يوجد ${dupSizes ? "مقاسات" : ""}${dupSizes && dupSkus ? " و" : ""}${dupSkus ? "أكواد" : ""} مكرّرة — صحّح المميّزة بالأحمر.`
            : `Warning: duplicate ${dupSizes ? "sizes" : ""}${dupSizes && dupSkus ? " and " : ""}${dupSkus ? "SKUs" : ""} — fix the ones highlighted in red.`}
        </div>
      )}

      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {ar ? 'لا توجد مقاسات بعد — ولّد الأعمار بالأعلى أو اضغط "إضافة مقاس".' : 'No sizes yet — generate ages above or click "Add size".'}
        </div>
      )}

      {/* Header row (desktop) */}
      {value.length > 0 && (
        <div className="hidden grid-cols-[1.4fr_1.6fr_1.1fr_0.8fr_auto] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>{ar ? "المقاس / العمر" : "Size / Age"}</span>
          <span>SKU</span>
          <span>{ar ? "السعر" : "Price"}</span>
          <span>{ar ? "الكمية" : "Qty"}</span>
          <span className="sr-only">{ar ? "حذف" : "Remove"}</span>
        </div>
      )}

      <ul className="space-y-2">
        {value.map((row, idx) => {
          const inactive = row.is_active === false;
          const sizeDup = !!norm(row.size) && sizeCounts[norm(row.size)] > 1;
          const skuDup = !!norm(row.sku) && skuCounts[norm(row.sku)] > 1;
          return (
            <li
              key={row.id ?? `new-${idx}`}
              className={cn(
                "grid grid-cols-1 items-center gap-2 rounded-lg border border-border bg-card p-2.5 sm:grid-cols-[1.4fr_1.6fr_1.1fr_0.8fr_auto]",
                inactive && "opacity-60",
              )}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground sm:hidden">{ar ? "المقاس / العمر" : "Size / Age"}</span>
                <input type="text" value={row.size} onChange={(e) => update(idx, { size: e.target.value })} placeholder={ar ? "مثال: 3 سنوات" : "e.g. 3 Years"} className={cn("h-8 w-full rounded-md border bg-background px-2 text-xs", sizeDup ? "border-red-400 ring-1 ring-red-300" : "border-input")} />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground sm:hidden">SKU</span>
                <input type="text" value={row.sku ?? ""} onChange={(e) => update(idx, { sku: e.target.value })} placeholder="VESTIDO4813Y" className={cn("h-8 w-full rounded-md border bg-background px-2 text-xs font-mono", skuDup ? "border-red-400 ring-1 ring-red-300" : "border-input")} dir="ltr" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground sm:hidden">{ar ? "السعر" : "Price"}</span>
                <div className="flex items-center rounded-md border border-input bg-background">
                  <span className="px-2 text-[10px] text-muted-foreground">{currency}</span>
                  <input type="number" min={0} step={0.01} value={row.price ?? ""} onChange={(e) => update(idx, { price: e.target.value === "" ? null : Number(e.target.value) })} placeholder={String(basePrice || "")} className="h-8 w-full rounded-md bg-transparent px-1 text-xs outline-none" dir="ltr" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground sm:hidden">{ar ? "الكمية" : "Qty"}</span>
                <input type="number" min={0} value={row.stock ?? 0} onChange={(e) => update(idx, { stock: Number(e.target.value) })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" dir="ltr" />
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <button type="button" onClick={() => move(idx, -1)} disabled={disabled || idx === 0} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label={ar ? "تحريك للأعلى" : "Move up"} title={ar ? "تحريك للأعلى" : "Move up"}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => move(idx, 1)} disabled={disabled || idx === value.length - 1} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label={ar ? "تحريك للأسفل" : "Move down"} title={ar ? "تحريك للأسفل" : "Move down"}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title={ar ? "متاح للبيع" : "Available for sale"}>
                  <input type="checkbox" checked={row.is_active ?? true} onChange={(e) => update(idx, { is_active: e.target.checked })} />
                  <span className="hidden sm:inline">{ar ? "متاح" : "Active"}</span>
                </label>
                <button type="button" onClick={() => remove(idx)} disabled={disabled} className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label={ar ? "حذف المقاس" : "Remove size"}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={add} disabled={disabled} className={cn("flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs", "text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50")}>
        <Plus className="h-3.5 w-3.5" />
        {ar ? "إضافة مقاس" : "Add size"}
      </button>
    </div>
  );
}
