import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Bilingual } from "../types";
import { PageHeader } from "./PageHeader";

export function DetailShell({
  backTo,
  backLabel,
  title,
  description,
  actions,
  loading,
  notFound,
  children,
}: {
  backTo: string;
  backLabel: Bilingual;
  title: Bilingual | string;
  description?: Bilingual | string;
  actions?: ReactNode;
  loading?: boolean;
  notFound?: boolean;
  children?: ReactNode;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return (
    <div>
      <Link
        to={backTo as any}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {ar ? <ArrowRight className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}
        {ar ? backLabel.ar : backLabel.en}
      </Link>

      <PageHeader title={title} description={description} actions={actions} />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : notFound ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          {ar ? "العنصر غير موجود" : "Item not found"}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[80px] ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
