import { AdminShell } from "@/components/AdminLayout";
import { Construction } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export function ComingSoonPage({ title, desc, features }: { title: string; desc: string; features?: string[] }) {
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  return (
    <AdminShell>
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
        <Construction className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        {features && features.length > 0 && (
          <div className={`mt-6 rounded-lg bg-muted/30 p-4 ${isRTL ? "text-right" : "text-left"}`}>
            <h3 className="mb-2 text-xs font-semibold text-foreground">
              {ar ? "الميزات المخططة:" : "Planned features:"}
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-6 text-[11px] text-muted-foreground">
          {ar ? "سيتم تفعيل هذه الصفحة في الإصدار القادم." : "This page will be enabled in an upcoming release."}
        </p>
      </div>
    </AdminShell>
  );
}
