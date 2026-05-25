// src/features/admin/components/LookupField.tsx
//
// Reusable searchable picker that replaces every "UUID" / "JSON array of IDs"
// field across the admin. Configure via `cfg` on the form field definition:
//
//   { key: "product_id",  type: "lookup", lookup: { table: "products" } }
//   { key: "product_ids", type: "lookup", lookup: { table: "products", multiple: true } }
//   { key: "user_id",     type: "lookup", lookup: { table: "profiles", labelColumns: ["full_name","email"] } }
//
import { useEffect, useMemo, useState } from "react";
import { Loader2, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export type LookupConfig = {
  /** Supabase table to query, e.g. "products" */
  table: string;
  /** Columns concatenated to build the visible label. First non-empty wins per row. */
  labelColumns?: readonly string[];
  /** Secondary column shown small under the label (e.g. SKU or email). */
  secondaryColumn?: string;
  /** Image column to show as thumbnail. */
  imageColumn?: string;
  /** Columns matched by the search input (case-insensitive). */
  searchColumns?: readonly string[];
  /** Multi-select returns string[]; otherwise returns string|null. */
  multiple?: boolean;
  /** Max rows fetched for the initial list (default 50). */
  limit?: number;
  /** Extra equality filters, e.g. { is_active: true }. */
  filter?: Record<string, any>;
  /** Order column, default "created_at" desc. */
  orderBy?: { column: string; ascending?: boolean };
};

type Row = { id: string; __label: string; __secondary?: string; __image?: string };

const DEFAULT_LABEL_COLS = ["name_ar", "name_en", "title_ar", "title_en", "full_name", "email", "name"];

function rowLabel(r: any, labelCols: readonly string[]): string {
  for (const c of labelCols) {
    const v = r?.[c];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return r?.id ? `#${String(r.id).slice(0, 8)}` : "—";
}

export function LookupField({
  value,
  onChange,
  cfg,
  placeholder,
  disabled,
}: {
  value: string | string[] | null | undefined;
  onChange: (v: string | string[] | null) => void;
  cfg: LookupConfig;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const labelCols = cfg.labelColumns?.length ? cfg.labelColumns : DEFAULT_LABEL_COLS;
  const searchCols = cfg.searchColumns?.length ? cfg.searchColumns : labelCols;
  const limit = cfg.limit ?? 50;
  const multiple = !!cfg.multiple;

  const valArr = useMemo<string[]>(
    () => (multiple ? (Array.isArray(value) ? value : []) : value ? [String(value)] : []),
    [value, multiple],
  );

  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cols = Array.from(new Set([
          "id",
          ...labelCols,
          ...(cfg.secondaryColumn ? [cfg.secondaryColumn] : []),
          ...(cfg.imageColumn ? [cfg.imageColumn] : []),
        ]));
        let q = (supabase as any).from(cfg.table).select(cols.join(",")).limit(limit);
        if (cfg.filter) for (const [k, v] of Object.entries(cfg.filter)) q = q.eq(k, v);
        if (cfg.orderBy) q = q.order(cfg.orderBy.column, { ascending: cfg.orderBy.ascending ?? false });
        else q = q.order("created_at", { ascending: false });
        const { data, error } = await q;
        if (cancelled) return;
        if (error) {
          console.error("[LookupField] fetch failed", { table: cfg.table, error });
          setAllRows([]);
        } else {
          const rows: Row[] = (data ?? []).map((r: any) => ({
            id: r.id,
            __label: rowLabel(r, labelCols),
            __secondary: cfg.secondaryColumn ? r[cfg.secondaryColumn] ?? undefined : undefined,
            __image: cfg.imageColumn ? r[cfg.imageColumn] ?? undefined : undefined,
          }));
          setAllRows(rows);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.table, JSON.stringify(cfg.filter), JSON.stringify(cfg.orderBy), limit]);

  const [extraRows, setExtraRows] = useState<Row[]>([]);
  useEffect(() => {
    const known = new Set(allRows.map((r) => r.id));
    const missing = valArr.filter((id) => id && !known.has(id) && !extraRows.find((r) => r.id === id));
    if (missing.length === 0) return;
    (async () => {
      try {
        const cols = Array.from(new Set([
          "id",
          ...labelCols,
          ...(cfg.secondaryColumn ? [cfg.secondaryColumn] : []),
          ...(cfg.imageColumn ? [cfg.imageColumn] : []),
        ]));
        const { data } = await (supabase as any).from(cfg.table).select(cols.join(",")).in("id", missing);
        const rows: Row[] = (data ?? []).map((r: any) => ({
          id: r.id,
          __label: rowLabel(r, labelCols),
          __secondary: cfg.secondaryColumn ? r[cfg.secondaryColumn] ?? undefined : undefined,
          __image: cfg.imageColumn ? r[cfg.imageColumn] ?? undefined : undefined,
        }));
        setExtraRows((s) => [...s, ...rows]);
      } catch (e) {
        console.error("[LookupField] resolve-missing failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valArr.join("|"), allRows.length]);

  const allIndex = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of [...allRows, ...extraRows]) m.set(r.id, r);
    return m;
  }, [allRows, extraRows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((r) => {
      const hay = [r.__label, r.__secondary, ...searchCols.map((c) => (r as any)[c])]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [allRows, search, searchCols]);

  const selected: Row[] = valArr
    .map((id) => allIndex.get(id))
    .filter((x): x is Row => !!x);

  const toggle = (id: string) => {
    if (multiple) {
      const next = valArr.includes(id) ? valArr.filter((x) => x !== id) : [...valArr, id];
      onChange(next);
    } else {
      onChange(id);
      setOpen(false);
    }
  };

  const remove = (id: string) => {
    if (multiple) onChange(valArr.filter((x) => x !== id));
    else onChange(null);
  };

  const buttonLabel = multiple
    ? (selected.length
        ? (ar ? `${selected.length} مختار` : `${selected.length} selected`)
        : (placeholder ?? (ar ? "اختر..." : "Select...")))
    : (selected[0]?.__label ?? (placeholder ?? (ar ? "اختر..." : "Select...")));

  return (
    <div className="space-y-1.5">
      {multiple && selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px]">
              {r.__image && <img src={r.__image} alt="" className="h-4 w-4 rounded object-cover" />}
              <span>{r.__label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive"
                  aria-label={ar ? "إزالة" : "Remove"}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-input bg-background px-2 py-1.5 text-xs",
          "hover:bg-muted/50 disabled:opacity-50",
        )}
      >
        <span className={cn("truncate", !selected.length && "text-muted-foreground")}>{buttonLabel}</span>
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && !disabled && (
        <div className="relative">
          <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
            <div className="flex items-center gap-2 border-b border-border p-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ar ? "ابحث..." : "Search..."}
                className="flex-1 bg-transparent text-xs outline-none"
              />
              {!multiple && selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => { onChange(null); setOpen(false); }}
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                >
                  {ar ? "مسح" : "Clear"}
                </button>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  {ar ? "لا نتائج" : "No results"}
                </div>
              ) : (
                filtered.map((r) => {
                  const checked = valArr.includes(r.id);
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => toggle(r.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-xs hover:bg-muted",
                        checked && "bg-primary/10",
                      )}
                    >
                      {multiple && (
                        <input type="checkbox" checked={checked} readOnly className="pointer-events-none" />
                      )}
                      {r.__image && (
                        <img src={r.__image} alt="" className="h-6 w-6 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{r.__label}</div>
                        {r.__secondary && (
                          <div className="truncate text-[10px] text-muted-foreground">{r.__secondary}</div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-border p-2 text-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-3 py-1 text-[11px] text-primary-foreground hover:bg-primary/90"
              >
                {ar ? "تم" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

