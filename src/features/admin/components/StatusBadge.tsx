import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  inactive: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  shipped: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  refunded: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  default: "bg-muted text-foreground",
};

export function StatusBadge({ value, label }: { value: string | boolean | null; label?: string }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  let v: string;
  let display = label;
  if (typeof value === "boolean") {
    v = value ? "active" : "inactive";
    if (!display) display = value ? "✓" : "—";
  } else {
    v = String(value).toLowerCase();
    if (!display) display = String(value);
  }
  const cls = COLORS[v] ?? COLORS.default;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>
      {display}
    </span>
  );
}
