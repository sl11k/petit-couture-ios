import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AdminPageConfig, FilterDef } from "../types";

export function useAdminTable<T extends Record<string, any>>(config: AdminPageConfig<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const reload = async () => {
    setLoading(true);
    setError(null);
    let q = supabase.from(config.table as any).select(config.select ?? "*").limit(500);
    if (config.orderBy) {
      q = q.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? false });
    }
    const { data, error: err } = await q;
    if (err) setError(err.message);
    setRows((data ?? []) as unknown as T[]);
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
