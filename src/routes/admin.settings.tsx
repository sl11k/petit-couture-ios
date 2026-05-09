import { createFileRoute } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return (
    <div>
      <PageHeader
        title={{ ar: "الإعدادات", en: "Settings" }}
        description={{ ar: "إعدادات المتجر العامة", en: "General store settings" }}
      />
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {ar ? "صفحة الإعدادات قيد التطوير في المرحلة التالية." : "Settings page coming in the next phase."}
      </div>
    </div>
  );
}
