import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import type {
  AdminDetailConfig,
  DetailFieldDef,
  DetailSectionDef,
  RelatedTableDef,
  ColumnDef,
} from "../types";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";
import { FormDialog } from "./FormDialog";
import { cn } from "@/lib/utils";

function formatValue(value: any, type: DetailFieldDef["type"], lang: string): React.ReactNode {
  const ar = lang === "ar";
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  switch (type) {
    case "currency":
      return `${Number(value).toLocaleString(ar ? "ar" : "en")} ${ar ? "ر.س" : "SAR"}`;
    case "number":
      return Number(value).toLocaleString(ar ? "ar" : "en");
    case "date":
      return new Date(value).toLocaleDateString(ar ? "ar" : "en");
    case "datetime":
      return new Date(value).toLocaleString(ar ? "ar" : "en");
    case "badge":
      return <StatusBadge value={value} />;
    case "boolean":
      return <StatusBadge value={Boolean(value)} />;
    case "image":
      return value ? <img src={value} alt="" className="h-20 w-20 rounded-md border border-border object-cover" /> : "—";
    case "url":
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{value}</a>;
    case "email":
      return <a href={`mailto:${value}`} className="text-primary underline">{value}</a>;
    case "tel":
      return <a href={`tel:${value}`} className="text-primary underline" dir="ltr">{value}</a>;
    case "longtext":
      return <span className="whitespace-pre-wrap text-sm">{value}</span>;
    case "json":
      return (
        <pre className="max-h-48 overflow-auto rounded-md bg-muted/30 p-2 text-[11px] font-mono leading-relaxed">
          {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        </pre>
      );
    case "address": {
      if (typeof value !== "object") return String(value);
      const parts = [value.line1, value.line2, value.city, value.region, value.country, value.postal_code]
        .filter(Boolean);
      return <span className="whitespace-pre-wrap text-sm">{parts.join("، ")}</span>;
    }
    default:
      return String(value);
  }
}

function DetailField({ def, row, lang }: { def: DetailFieldDef; row: any; lang: string }) {
  const ar = lang === "ar";
  const raw = row[def.key];
  if (def.hideIfEmpty && (raw === null || raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0))) {
    return null;
  }
  const value = def.render ? def.render(raw, row) : formatValue(raw, def.type, lang);
  const isWide = def.type === "longtext" || def.type === "json" || def.type === "address" || def.span === 2 || def.span === 3;
  return (
    <div className={cn("space-y-1", isWide && "sm:col-span-2", def.span === 3 && "sm:col-span-3")}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{ar ? def.label.ar : def.label.en}</div>
      <div className="text-sm break-words">{value}</div>
    </div>
  );
}

function DetailSection({ section, row, lang }: { section: DetailSectionDef; row: any; lang: string }) {
  const ar = lang === "ar";
  const cols = section.columns ?? 2;
  const colCls = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{ar ? section.title.ar : section.title.en}</h3>
      <div className={cn("grid gap-4", colCls)}>
        {section.fields.map((f) => (
          <DetailField key={f.key} def={f} row={row} lang={lang} />
        ))}
      </div>
    </section>
  );
}

function formatCell(value: any, type: ColumnDef["type"], lang: string): React.ReactNode {
  const ar = lang === "ar";
  if (value === null || value === undefined || value === "") return "—";
  switch (type) {
    case "currency": return `${Number(value).toLocaleString(ar ? "ar" : "en")} ${ar ? "ر.س" : "SAR"}`;
    case "number": return Number(value).toLocaleString(ar ? "ar" : "en");
    case "date": return new Date(value).toLocaleDateString(ar ? "ar" : "en");
    case "datetime": return new Date(value).toLocaleString(ar ? "ar" : "en");
    case "badge": return <StatusBadge value={value} />;
    case "boolean": return <StatusBadge value={Boolean(value)} />;
    case "image": return value ? <img src={value} className="h-8 w-8 rounded object-cover" alt="" /> : "—";
    default: return String(value);
  }
}

function RelatedTable({ def, mainRow, lang }: { def: RelatedTableDef; mainRow: any; lang: string }) {
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fkVal = def.foreignKeyValue ? def.foreignKeyValue(mainRow) : mainRow.id;
    if (!fkVal) { setRows([]); setLoading(false); return; }
    let q = supabase.from(def.table as any).select(def.select ?? "*").eq(def.foreignKey, fkVal).limit(def.limit ?? 100);
    if (def.orderBy) q = q.order(def.orderBy.column, { ascending: def.orderBy.ascending ?? false });
    q.then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [mainRow, def.table]);

  return (
    <section className="rounded-xl border border-border bg-card">
      <h3 className="border-b border-border p-4 text-sm font-semibold">{ar ? def.title.ar : def.title.en}</h3>
      {loading ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          {def.emptyMessage ? (ar ? def.emptyMessage.ar : def.emptyMessage.en) : ar ? "لا توجد بيانات" : "No data"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                {def.columns.map((c) => (
                  <th key={c.key} className={cn("p-3 font-medium", ar ? "text-right" : "text-left", c.width, c.hideOnMobile && "hidden sm:table-cell")}>
                    {ar ? c.label.ar : c.label.en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const href = def.rowHref?.(r);
                return (
                  <tr key={r.id ?? idx}
                      className={cn("border-b border-border/50 last:border-0", href && "cursor-pointer hover:bg-muted/30")}
                      onClick={() => href && navigate({ to: href })}>
                    {def.columns.map((c) => (
                      <td key={c.key} className={cn("p-3 align-middle", ar ? "text-right" : "text-left", c.hideOnMobile && "hidden sm:table-cell")}>
                        {c.render ? c.render(r[c.key], r) : formatCell(r[c.key], c.type, lang)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {def.footer && rows.length > 0 && <div className="border-t border-border p-4">{def.footer(rows, mainRow)}</div>}
    </section>
  );
}

export function DetailPage<T extends Record<string, any>>({
  config,
  id,
}: {
  config: AdminDetailConfig<T>;
  id: string;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [row, setRow] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    supabase.from(config.table as any).select(config.select ?? "*").eq("id", id).maybeSingle()
      .then(({ data }) => { setRow(data as T | null); setLoading(false); });
  }, [config.table, id, reloadKey]);

  const Arrow = ar ? ArrowRight : ArrowLeft;
  const sidebarSections = useMemo(() => config.sections.filter((s) => s.sidebar), [config.sections]);
  const mainSections = useMemo(() => config.sections.filter((s) => !s.sidebar), [config.sections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!row) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{ar ? "العنصر غير موجود" : "Item not found"}</p>
        <Link to={config.backTo as any} className="mt-3 inline-block text-sm text-primary underline">
          {ar ? config.backLabel.ar : config.backLabel.en}
        </Link>
      </div>
    );
  }

  const title = config.title(row);
  const description = config.description?.(row);

  return (
    <div>
      <Link to={config.backTo as any} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Arrow className="h-3 w-3" /> {ar ? config.backLabel.ar : config.backLabel.en}
      </Link>

      <PageHeader
        title={title as any}
        description={description as any}
        actions={
          config.editForm && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Pencil className="h-3 w-3" /> {ar ? "تعديل" : "Edit"}
            </button>
          )
        }
      />

      <div className={cn("grid gap-4", sidebarSections.length > 0 ? "lg:grid-cols-3" : "")}>
        <div className={cn("space-y-4", sidebarSections.length > 0 && "lg:col-span-2")}>
          {mainSections.map((s, i) => <DetailSection key={i} section={s} row={row} lang={lang} />)}
          {config.related?.map((r, i) => <RelatedTable key={`r-${i}`} def={r} mainRow={row} lang={lang} />)}
        </div>
        {sidebarSections.length > 0 && (
          <div className="space-y-4">
            {sidebarSections.map((s, i) => <DetailSection key={`s-${i}`} section={s} row={row} lang={lang} />)}
          </div>
        )}
      </div>

      {config.editForm && editing && (
        <FormDialog
          open
          mode="edit"
          table={config.table}
          title={typeof title === "string" ? { ar: title, en: title } : title}
          fields={config.editForm}
          initialValues={row}
          rowId={id}
          onClose={() => setEditing(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
