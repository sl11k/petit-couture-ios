import { useRouter } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ColumnDef, RowAction } from "../types";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

function formatCell(value: any, type?: ColumnDef["type"], lang?: string) {
  if (value === null || value === undefined || value === "") return "—";
  switch (type) {
    case "currency":
      return `${Number(value).toLocaleString(lang === "ar" ? "ar" : "en")} ${lang === "ar" ? "ر.س" : "SAR"}`;
    case "number":
      return Number(value).toLocaleString(lang === "ar" ? "ar" : "en");
    case "date":
      return new Date(value).toLocaleDateString(lang === "ar" ? "ar" : "en");
    case "datetime":
      return new Date(value).toLocaleString(lang === "ar" ? "ar" : "en");
    case "badge":
      return <StatusBadge value={value} />;
    case "boolean":
      return <StatusBadge value={Boolean(value)} />;
    case "image":
      return value ? <img src={value} className="h-8 w-8 rounded object-cover" alt="" /> : "—";
    default:
      return String(value);
  }
}

export function DataTable<T extends Record<string, any>>({
  rows,
  columns,
  loading,
  rowHref,
  rowActions,
  emptyMessage,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  rowHref?: (row: T) => string;
  rowActions?: RowAction<T>[];
  emptyMessage?: string;
}) {
  const { lang } = useLanguage();
  const router = useRouter();
  const ar = lang === "ar";

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {ar ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState message={emptyMessage ?? (ar ? "لا توجد بيانات" : "No data")} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "p-3 font-medium",
                  ar ? "text-right" : "text-left",
                  c.width,
                  c.hideOnMobile && "hidden sm:table-cell",
                )}
              >
                {ar ? c.label.ar : c.label.en}
              </th>
            ))}
            {rowActions && rowActions.length > 0 && <th className="p-3 w-1" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={row.id ?? idx}
                className={cn(
                  "border-b border-border/50 last:border-0",
                  href && "cursor-pointer hover:bg-muted/30",
                )}
                onClick={() => href && router.history.push(href)}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "p-3 align-middle",
                      ar ? "text-right" : "text-left",
                      c.hideOnMobile && "hidden sm:table-cell",
                    )}
                  >
                    {c.render ? c.render(row[c.key], row) : formatCell(row[c.key], c.type, lang)}
                  </td>
                ))}
                {rowActions && rowActions.length > 0 && (
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {rowActions.map((a) => {
                        const className = cn(
                          "rounded p-1.5 text-xs hover:bg-muted",
                          a.variant === "danger" && "text-destructive",
                        );
                        if (a.to) {
                          const href = a.to(row);
                          return (
                            <button
                              key={a.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.history.push(href);
                              }}
                              className={className}
                              title={ar ? a.label.ar : a.label.en}
                              aria-label={ar ? a.label.ar : a.label.en}
                            >
                              {a.icon}
                            </button>
                          );
                        }
                        return (
                          <button
                            key={a.key}
                            onClick={(e) => { e.stopPropagation(); a.onClick?.(row); }}
                            className={className}
                            title={ar ? a.label.ar : a.label.en}
                          >
                            {a.icon}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
