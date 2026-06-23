import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Upload, X, ArrowRight, Check, Loader2 } from "lucide-react";

type Field = {
  key: string;
  label: { ar: string; en: string };
  required?: boolean;
};

const FIELDS: Field[] = [
  { key: "name_ar", label: { ar: "الاسم (عربي)", en: "Name (AR)" }, required: true },
  { key: "name_en", label: { ar: "الاسم (إنجليزي)", en: "Name (EN)" }, required: true },
  { key: "slug", label: { ar: "Slug", en: "Slug" } },
  { key: "sku", label: { ar: "SKU", en: "SKU" } },
  { key: "barcode", label: { ar: "الباركود", en: "Barcode" } },
  { key: "brand", label: { ar: "العلامة التجارية", en: "Brand" } },
  { key: "price", label: { ar: "السعر", en: "Price" }, required: true },
  { key: "compare_at_price", label: { ar: "السعر قبل التخفيض", en: "Compare-at price" } },
  { key: "cost", label: { ar: "التكلفة", en: "Cost" } },
  { key: "stock", label: { ar: "المخزون", en: "Stock" } },
  { key: "category", label: { ar: "التصنيف (اسم/Slug)", en: "Category (name/slug)" } },
  { key: "description_ar", label: { ar: "الوصف (عربي)", en: "Description (AR)" } },
  { key: "description_en", label: { ar: "الوصف (إنجليزي)", en: "Description (EN)" } },
  { key: "short_description_ar", label: { ar: "وصف مختصر (عربي)", en: "Short desc (AR)" } },
  { key: "short_description_en", label: { ar: "وصف مختصر (إنجليزي)", en: "Short desc (EN)" } },
  { key: "image_url", label: { ar: "رابط الصورة", en: "Image URL" } },
  { key: "is_active", label: { ar: "متاح (true/false)", en: "Active (true/false)" } },
  { key: "status", label: { ar: "الحالة (active/draft/archived)", en: "Status" } },
];

function slugify(s: string) {
  return String(s || "")
    .toLowerCase().trim()
    .replace(/[^\w\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || `p-${Date.now().toString(36)}`;
}

function toBool(v: any): boolean | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "yes", "نعم", "active", "متاح", "y"].includes(s)) return true;
  if (["false", "0", "no", "لا", "inactive", "مخفي", "n"].includes(s)) return false;
  return undefined;
}

function toNum(v: any): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

type Row = Record<string, any>;

export function ProductImportDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; updated: number; failed: { row: number; reason: string }[]; categoriesCreated: string[] } | null>(null);

  function reset() {
    setStep(1); setFileName(""); setHeaders([]); setRows([]); setMapping({}); setResult(null);
  }
  function close() { reset(); onClose(); }

  async function handleFile(f: File) {
    setFileName(f.name);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
      if (!data.length) { toast.error(t("الملف فارغ", "Empty file")); return; }
      const hs = Object.keys(data[0]);
      setHeaders(hs);
      setRows(data);
      const auto: Record<string, string> = {};
      for (const f of FIELDS) {
        const found = hs.find((h) => {
          const hh = h.toLowerCase().trim();
          return hh === f.key || hh === f.label.en.toLowerCase() || hh === f.label.ar.toLowerCase() || hh.replace(/[^a-z]/g, "") === f.key.replace(/_/g, "");
        });
        if (found) auto[f.key] = found;
      }
      setMapping(auto);
      setStep(2);
    } catch (err: any) {
      console.error("[ProductImport] file parse failed", err);
      toast.error(err?.message || t("تعذّر قراءة الملف", "Failed to read file"));
    }
  }

  const preview = useMemo(() => rows.slice(0, 5).map((r) => {
    const o: Row = {};
    for (const f of FIELDS) {
      const col = mapping[f.key];
      if (col) o[f.key] = r[col];
    }
    return o;
  }), [rows, mapping]);

  async function runImport() {
    setBusy(true);
    // BUGFIX: outer try/catch — previously only try/finally, so if the initial
    // categories load threw (network error), no toast was shown and the step
    // never advanced — user saw "nothing happen".
    try {
      const { data: catsData, error: catsErr } = await (supabase as any).from("categories").select("id, slug, name_ar, name_en");
      if (catsErr) throw catsErr;
      const catBy = new Map<string, string>();
      for (const c of (catsData ?? []) as any[]) {
        if (c.slug) catBy.set(String(c.slug).toLowerCase(), c.id);
        if (c.name_ar) catBy.set(String(c.name_ar).toLowerCase(), c.id);
        if (c.name_en) catBy.set(String(c.name_en).toLowerCase(), c.id);
      }
      const categoriesCreated: string[] = [];

      let added = 0, updated = 0;
      const failed: { row: number; reason: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const get = (key: string) => mapping[key] ? raw[mapping[key]] : undefined;
        try {
          const name_ar = String(get("name_ar") ?? "").trim();
          const name_en = String(get("name_en") ?? "").trim() || name_ar;
          const price = toNum(get("price"));
          if (!name_ar && !name_en) { failed.push({ row: i + 2, reason: t("الاسم مفقود", "Missing name") }); continue; }
          if (price === undefined) { failed.push({ row: i + 2, reason: t("السعر غير صالح", "Invalid price") }); continue; }

          const sku = get("sku") ? String(get("sku")).trim() : null;
          const slug = get("slug") ? slugify(String(get("slug"))) : slugify(name_en || name_ar);

          let category_id: string | null = null;
          const catRaw = get("category");
          if (catRaw) {
            const key = String(catRaw).toLowerCase().trim();
            if (catBy.has(key)) category_id = catBy.get(key)!;
            else {
              const newSlug = slugify(String(catRaw));
              const { data: newCat, error: cErr } = await (supabase as any)
                .from("categories")
                .insert({ slug: newSlug, name_ar: String(catRaw), name_en: String(catRaw), is_active: true })
                .select("id").single();
              if (!cErr && newCat) {
                category_id = newCat.id;
                catBy.set(key, newCat.id);
                categoriesCreated.push(String(catRaw));
              }
            }
          }

          let existingId: string | null = null;
          if (sku) {
            const { data: e } = await (supabase as any).from("products").select("id").eq("sku", sku).maybeSingle();
            if (e?.id) existingId = e.id;
          }
          if (!existingId && slug) {
            const { data: e } = await (supabase as any).from("products").select("id").eq("slug", slug).maybeSingle();
            if (e?.id) existingId = e.id;
          }
          if (!existingId && name_ar) {
            const { data: e } = await (supabase as any).from("products").select("id").eq("name_ar", name_ar).maybeSingle();
            if (e?.id) existingId = e.id;
          }

          const payload: Row = {
            name_ar, name_en, price,
            slug,
            sku,
            barcode: get("barcode") ? String(get("barcode")) : null,
            brand: get("brand") ? String(get("brand")) : null,
            compare_at_price: toNum(get("compare_at_price")),
            cost: toNum(get("cost")),
            stock: toNum(get("stock")) ?? 0,
            description_ar: get("description_ar") ? String(get("description_ar")) : null,
            description_en: get("description_en") ? String(get("description_en")) : null,
            short_description_ar: get("short_description_ar") ? String(get("short_description_ar")) : null,
            short_description_en: get("short_description_en") ? String(get("short_description_en")) : null,
            image_url: get("image_url") ? String(get("image_url")) : null,
            category_id,
            is_active: toBool(get("is_active")) ?? true,
            status: get("status") ? String(get("status")).toLowerCase() : "active",
          };
          Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

          if (existingId) {
            const { error } = await (supabase as any).from("products").update(payload).eq("id", existingId);
            if (error) failed.push({ row: i + 2, reason: error.message });
            else updated++;
          } else {
            const { error } = await (supabase as any).from("products").insert(payload);
            if (error) failed.push({ row: i + 2, reason: error.message });
            else added++;
          }
        } catch (e: any) {
          failed.push({ row: i + 2, reason: e?.message || "Unknown error" });
        }
      }

      setResult({ added, updated, failed, categoriesCreated });
      setStep(4);
      // BUGFIX: show a summary toast so user gets immediate feedback
      // instead of having to visually scan the result panel.
      const total = added + updated;
      if (total > 0 && failed.length === 0) {
        toast.success(t(`تم استيراد ${total} منتج بنجاح`, `Imported ${total} products successfully`));
      } else if (total > 0 && failed.length > 0) {
        toast.success(t(`تم استيراد ${total} وفشل ${failed.length}`, `Imported ${total}, failed ${failed.length}`));
      } else if (failed.length > 0) {
        toast.error(t(`فشل استيراد كل ${failed.length} الصفوف`, `All ${failed.length} rows failed`));
      }
      onDone?.();
    } catch (err: any) {
      console.error("[ProductImport] runImport failed", err);
      toast.error(err?.message || t("تعذّر تشغيل الاستيراد", "Import failed to run"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-card shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()} dir={ar ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">{t("استيراد منتجات من Excel", "Import products from Excel")}</h2>
          <button onClick={close} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`flex items-center gap-1 ${step >= n ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${step >= n ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{n}</span>
              {n === 1 && t("رفع", "Upload")}
              {n === 2 && t("ربط الأعمدة", "Map columns")}
              {n === 3 && t("معاينة", "Preview")}
              {n === 4 && t("النتيجة", "Result")}
              {n < 4 && <ArrowRight className={`h-3 w-3 ${ar ? "rotate-180" : ""}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {step === 1 && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 hover:bg-muted/30">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm">{t("اختر ملف .xlsx أو .csv", "Choose .xlsx or .csv file")}</div>
              {fileName && <div className="text-xs text-muted-foreground">{fileName}</div>}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">{t("اربط كل حقل بعمود من الملف. اترك فارغاً للحقول غير المطلوبة.", "Map each field to a file column. Leave empty to skip.")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <label className="w-44 shrink-0 text-xs">
                      {ar ? f.label.ar : f.label.en}
                      {f.required && <span className="text-destructive"> *</span>}
                    </label>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="">— {t("تجاهل", "Skip")} —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t(`معاينة أول ${preview.length} صفوف من ${rows.length}`, `Preview of first ${preview.length} of ${rows.length} rows`)}</p>
              <div className="overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <th key={f.key} className="p-2 text-start font-medium">{ar ? f.label.ar : f.label.en}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {FIELDS.filter((f) => mapping[f.key]).map((f) => (
                          <td key={f.key} className="p-2 align-top">{String(r[f.key] ?? "—").slice(0, 60)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 4 && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border bg-green-500/10 p-3 text-center">
                  <div className="text-2xl font-semibold text-green-600">{result.added}</div>
                  <div className="text-xs text-muted-foreground">{t("أُضيف", "Added")}</div>
                </div>
                <div className="rounded-md border border-border bg-blue-500/10 p-3 text-center">
                  <div className="text-2xl font-semibold text-blue-600">{result.updated}</div>
                  <div className="text-xs text-muted-foreground">{t("حُدّث", "Updated")}</div>
                </div>
                <div className="rounded-md border border-border bg-red-500/10 p-3 text-center">
                  <div className="text-2xl font-semibold text-red-600">{result.failed.length}</div>
                  <div className="text-xs text-muted-foreground">{t("فشل", "Failed")}</div>
                </div>
              </div>
              {result.categoriesCreated.length > 0 && (
                <div className="rounded-md border border-border p-3 text-xs">
                  <div className="font-medium mb-1">{t("تصنيفات جديدة أُنشئت:", "New categories created:")}</div>
                  <div className="text-muted-foreground">{result.categoriesCreated.join(", ")}</div>
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="rounded-md border border-border p-3 text-xs">
                  <div className="font-medium mb-1">{t("الصفوف الفاشلة:", "Failed rows:")}</div>
                  <ul className="space-y-1 max-h-40 overflow-auto">
                    {result.failed.map((f, i) => (
                      <li key={i} className="text-muted-foreground">
                        {t("الصف", "Row")} {f.row}: {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <button onClick={close} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
            {step === 4 ? t("إغلاق", "Close") : t("إلغاء", "Cancel")}
          </button>
          <div className="flex gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={(!mapping.name_ar && !mapping.name_en) || !mapping.price}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {t("التالي: معاينة", "Next: Preview")}
              </button>
            )}
            {step === 3 && (
              <>
                <button onClick={() => setStep(2)} className="rounded-md border border-border px-3 py-1.5 text-xs">
                  {t("رجوع", "Back")}
                </button>
                <button
                  onClick={runImport}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {t(`استيراد ${rows.length} صف`, `Import ${rows.length} rows`)}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
