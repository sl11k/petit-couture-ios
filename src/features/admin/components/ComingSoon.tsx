import { useLanguage } from "@/i18n/LanguageContext";
import { Construction } from "lucide-react";
import { PageHeader } from "@/features/admin/components/PageHeader";
import type { Bilingual } from "../types";

export function ComingSoon({ title }: { title: Bilingual }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return (
    <div>
      <PageHeader title={title} />
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Construction className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{ar ? "هذه الصفحة قيد التطوير" : "This page is under development"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ar ? "سيتم تفعيلها في المرحلة القادمة من إعادة بناء لوحة الإدارة." : "It will be enabled in the next phase of the admin rebuild."}
        </p>
      </div>
    </div>
  );
}
