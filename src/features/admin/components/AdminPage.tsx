import { useLanguage } from "@/i18n/LanguageContext";
import type { AdminPageConfig } from "../types";
import { useAdminTable } from "../hooks/useAdminTable";
import { PageHeader } from "./PageHeader";
import { FilterBar } from "./FilterBar";
import { DataTable } from "./DataTable";
import { Download } from "lucide-react";

function exportCSV(rows: any[], filename: string) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminPage<T extends Record<string, any>>({ config }: { config: AdminPageConfig<T> }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading, error, filterValues, setFilter } = useAdminTable<T>(config);

  return (
    <div>
      <PageHeader
        title={config.title}
        description={
          config.description ??
          ({ ar: `${rows.length} عنصر`, en: `${rows.length} items` })
        }
        actions={
          config.actions?.export && (
            <button
              onClick={() => exportCSV(rows, config.table)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
            >
              <Download className="h-3 w-3" /> {ar ? "تصدير CSV" : "Export CSV"}
            </button>
          )
        }
      />

      {config.filters && config.filters.length > 0 && (
        <FilterBar filters={config.filters} values={filterValues} onChange={setFilter} />
      )}

      {error && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <DataTable
        rows={rows}
        columns={config.columns}
        loading={loading}
        rowHref={config.rowHref}
        rowActions={config.rowActions}
      />
    </div>
  );
}
