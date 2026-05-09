import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { toast } from "sonner";
import { Loader2, Save, Shield, Lock, Clock, KeyRound } from "lucide-react";

export const Route = createFileRoute("/admin/security")({
  component: SecurityPage,
});

type Settings = Record<string, any>;

function SecurityPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("security_settings").select("*").maybeSingle();
      if (error) toast.error(error.message);
      setS(data ?? {});
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: any) => setS((p) => ({ ...(p ?? {}), [k]: v }));

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase.from("security_settings").update(s).eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(ar ? "تم الحفظ" : "Saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const Section = ({ icon: Icon, title, children }: any) => (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
  const Num = ({ k, label }: any) => (
    <label className="text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input
        type="number"
        value={s?.[k] ?? 0}
        onChange={(e) => set(k, parseInt(e.target.value) || 0)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
  const Bool = ({ k, label }: any) => (
    <label className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs">
      <span>{label}</span>
      <input type="checkbox" checked={!!s?.[k]} onChange={(e) => set(k, e.target.checked)} />
    </label>
  );

  return (
    <div>
      <PageHeader
        title={{ ar: "الأمان", en: "Security" }}
        description={{ ar: "سياسات كلمة المرور والجلسات", en: "Password & session policies" }}
        actions={
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {ar ? "حفظ" : "Save"}
          </button>
        }
      />

      <div className="space-y-4">
        <Section icon={KeyRound} title={ar ? "كلمات المرور" : "Passwords"}>
          <Num k="password_min_length" label={ar ? "أقل عدد للأحرف" : "Min length"} />
          <Num k="password_max_age_days" label={ar ? "العمر الأقصى (أيام)" : "Max age (days)"} />
          <Num k="password_history_count" label={ar ? "تاريخ كلمات المرور" : "History count"} />
          <Bool k="password_require_uppercase" label={ar ? "يتطلب أحرف كبيرة" : "Require uppercase"} />
          <Bool k="password_require_lowercase" label={ar ? "يتطلب أحرف صغيرة" : "Require lowercase"} />
          <Bool k="password_require_number" label={ar ? "يتطلب أرقام" : "Require number"} />
          <Bool k="password_require_symbol" label={ar ? "يتطلب رموز" : "Require symbol"} />
        </Section>

        <Section icon={Lock} title={ar ? "حماية تسجيل الدخول" : "Lockout"}>
          <Num k="lockout_max_attempts" label={ar ? "عدد المحاولات" : "Max attempts"} />
          <Num k="lockout_window_minutes" label={ar ? "نافذة (دقائق)" : "Window (minutes)"} />
          <Num k="lockout_duration_minutes" label={ar ? "مدة الإقفال (دقائق)" : "Lockout duration (minutes)"} />
        </Section>

        <Section icon={Clock} title={ar ? "الجلسات" : "Sessions"}>
          <Num k="session_idle_timeout_minutes" label={ar ? "انتهاء الخمول (دقائق)" : "Idle timeout (minutes)"} />
          <Num k="session_absolute_timeout_hours" label={ar ? "الانتهاء المطلق (ساعات)" : "Absolute timeout (hours)"} />
          <Bool k="session_single_device" label={ar ? "جهاز واحد فقط" : "Single device only"} />
        </Section>

        <Section icon={Shield} title={ar ? "حماية متقدمة" : "Advanced"}>
          <Bool k="require_2fa_for_admins" label={ar ? "2FA للمدراء" : "2FA for admins"} />
          <Bool k="require_2fa_for_managers" label={ar ? "2FA للمشرفين" : "2FA for managers"} />
          <Bool k="force_https" label={ar ? "إجبار HTTPS" : "Force HTTPS"} />
          <Bool k="enable_csrf_protection" label={ar ? "حماية CSRF" : "CSRF protection"} />
          <Bool k="enable_xss_protection" label={ar ? "حماية XSS" : "XSS protection"} />
          <Num k="api_rate_limit_per_minute" label={ar ? "حد API/دقيقة" : "API rate/min"} />
        </Section>
      </div>
    </div>
  );
}
