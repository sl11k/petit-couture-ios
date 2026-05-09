import type { ReactNode } from "react";
import type { Bilingual } from "../types";
import { useLanguage } from "@/i18n/LanguageContext";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: Bilingual | string;
  description?: Bilingual | string;
  actions?: ReactNode;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const t = (v: Bilingual | string) => (typeof v === "string" ? v : ar ? v.ar : v.en);
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{t(title)}</h1>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{t(description)}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
