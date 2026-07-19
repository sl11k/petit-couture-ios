import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AdminPageConfig, FilterDef } from "../types";

export function useAdminTable<T extends Record<string, any>>(config: AdminPageConfig<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const loadRows = async (select: string) => {
    let q = supabase.from(config.table as any).select(select).limit(500);
    if (config.orderBy) {
      q = q.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? false });
    }
    if (config.applyQuery) {
      try { q = config.applyQuery(q); } catch (e) { console.warn("applyQuery failed", e); }
    }
    return q;
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    let { data, error: err } = await loadRows(config.select ?? "*");
    if (err && config.fallbackSelect) {
      const fallback = await loadRows(config.fallbackSelect);
      data = fallback.data;
      err = fallback.error;
      if (!err) {
        console.warn("Admin table fallback select used", {
          table: config.table,
          select: config.select,
          fallbackSelect: config.fallbackSelect,
        });
      }
    }
    if (err) setError(err.message);
    let next = (data ?? []) as unknown as T[];
    if (config.enrichRows && next.length > 0) {
      try { next = await config.enrichRows(next); }
      catch (e: any) { console.warn("enrichRows failed", e); }
    }
    setRows(next);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.table]);

  const filtered = useMemo(() => {
    const filters = config.filters ?? [];
    return rows.filter((row) => {
      for (const f of filters) {
        const v = filterValues[f.key];
        if (!v) continue;
        if (f.type === "search") {
          const q = v.toLowerCase();
          const match = (f as Extract<FilterDef, { type: "search" }>).columns.some((col) =>
            String(row[col] ?? "").toLowerCase().includes(q),
          );
          if (!match) return false;
        } else if (f.type === "select") {
          if (String(row[f.key] ?? "") !== v) return false;
        } else if (f.type === "date") {
          const d = row[f.key] ? new Date(row[f.key]).toISOString().slice(0, 10) : "";
          if (d !== v) return false;
        }
      }
      return true;
    });
  }, [rows, filterValues, config.filters]);

  return {
    rows: filtered,
    allRows: rows,
    loading,
    error,
    filterValues,
    setFilter: (key: string, value: string) => setFilterValues((s) => ({ ...s, [key]: value })),
    reload,
  };
}
