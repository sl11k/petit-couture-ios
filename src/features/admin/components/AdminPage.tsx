import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { AdminPageConfig } from "../types";
import { useAdminTable } from "../hooks/useAdminTable";
import { PageHeader } from "./PageHeader";
import { FilterBar } from "./FilterBar";
import { DataTable } from "./DataTable";
import { FormDialog } from "./FormDialog";
import { Download, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const { rows, loading, error, filterValues, setFilter, reload } = useAdminTable<T>(config);

  const hasForm = !!(config.form && config.form.length > 0);
  const canCreate = hasForm && config.actions?.create !== false;
  const canEdit = hasForm && config.actions?.edit !== false;
  const canDelete = !!config.actions?.delete;

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; row?: T } | null>(null);

  const rowActions = [
    ...(config.rowActions ?? []),
    ...(canEdit
      ? [{
          key: "__edit",
          label: { ar: "تعديل", en: "Edit" },
          icon: <Pencil className="h-3.5 w-3.5" />,
          onClick: (row: T) => setDialog({ mode: "edit", row }),
        }]
      : []),
    ...(canDelete
      ? [{
          key: "__delete",
          label: { ar: "حذف", en: "Delete" },
          icon: <Trash2 className="h-3.5 w-3.5" />,
          variant: "danger" as const,
          onClick: async (row: T) => {
            if (!confirm(ar ? "تأكيد الحذف؟" : "Confirm delete?")) return;
            const { error: e } = await supabase.from(config.table as any).delete().eq("id", (row as any).id);
            if (e) toast.error(e.message);
            else { toast.success(ar ? "تم الحذف" : "Deleted"); reload(); }
          },
        }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={config.title}
        description={
          config.description ??
          ({ ar: `${rows.length} عنصر`, en: `${rows.length} items` })
        }
        actions={
          <div className="flex items-center gap-2">
            {config.actions?.export && (
              <button
                onClick={() => exportCSV(rows, config.table)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
              >
                <Download className="h-3 w-3" /> {ar ? "تصدير CSV" : "Export CSV"}
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => setDialog({ mode: "create" })}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3 w-3" /> {ar ? "إضافة" : "Add new"}
              </button>
            )}
          </div>
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
        rowActions={rowActions.length > 0 ? rowActions : undefined}
      />

      {hasForm && dialog && (
        <FormDialog
          open
          mode={dialog.mode}
          table={config.table}
          title={config.title}
          fields={config.form!}
          initialValues={dialog.row}
          rowId={(dialog.row as any)?.id}
          onClose={() => setDialog(null)}
          onSaved={() => reload()}
        />
      )}
    </div>
  );
}
