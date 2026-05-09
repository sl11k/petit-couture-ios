import { useLanguage } from "@/i18n/LanguageContext";
import type { FilterDef } from "../types";
import { Search } from "lucide-react";

export function FilterBar({
  filters,
  values,
  onChange,
}: {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  if (filters.length === 0) return null;

  return (
    <div className="mb-3 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
      {filters.map((f) => {
        if (f.type === "search") {
          return (
            <div key={f.key} className="relative lg:col-span-2">
              <Search className={`absolute top-2 h-3.5 w-3.5 text-muted-foreground ${ar ? "right-2" : "left-2"}`} />
              <input
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder ? (ar ? f.placeholder.ar : f.placeholder.en) : ar ? "بحث..." : "Search..."}
                className={`w-full rounded-md border border-border bg-background py-1.5 text-xs ${ar ? "pe-8 ps-2" : "ps-8 pe-2"}`}
              />
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <select
              key={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="">{ar ? "كل" : "All"} — {ar ? f.label.ar : f.label.en}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {ar ? o.label.ar : o.label.en}
                </option>
              ))}
            </select>
          );
        }
        if (f.type === "date") {
          return (
            <input
              key={f.key}
              type="date"
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          );
        }
        return null;
      })}
    </div>
  );
}
