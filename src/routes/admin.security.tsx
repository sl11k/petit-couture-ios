import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { toast } from "sonner";
import { Loader2, Save, Shield, Lock, Clock, KeyRound, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/admin/security")({
  component: SecurityPage,
});

type Settings = Record<string, any>;

// Numeric bounds with clear bilingual messages
const numericBounds: Record<string, { min: number; max: number; label: { ar: string; en: string } }> = {
  password_min_length: { min: 6, max: 128, label: { ar: "أقل عدد للأحرف", en: "Min length" } },
  password_max_age_days: { min: 0, max: 3650, label: { ar: "العمر الأقصى (أيام)", en: "Max age (days)" } },
  password_history_count: { min: 0, max: 50, label: { ar: "تاريخ كلمات المرور", en: "History count" } },
  lockout_max_attempts: { min: 1, max: 100, label: { ar: "عدد المحاولات", en: "Max attempts" } },
  lockout_window_minutes: { min: 1, max: 1440, label: { ar: "نافذة (دقائق)", en: "Window (minutes)" } },
  lockout_duration_minutes: { min: 1, max: 10080, label: { ar: "مدة الإقفال (دقائق)", en: "Lockout duration (minutes)" } },
  session_idle_timeout_minutes: { min: 1, max: 1440, label: { ar: "انتهاء الخمول (دقائق)", en: "Idle timeout (minutes)" } },
  session_absolute_timeout_hours: { min: 1, max: 720, label: { ar: "الانتهاء المطلق (ساعات)", en: "Absolute timeout (hours)" } },
  api_rate_limit_per_minute: { min: 1, max: 100000, label: { ar: "حد API/دقيقة", en: "API rate/min" } },
};

function buildSchema(ar: boolean) {
  const shape: Record<string, any> = {};
  for (const [k, b] of Object.entries(numericBounds)) {
    const lbl = ar ? b.label.ar : b.label.en;
    shape[k] = z
      .number({ invalid_type_error: ar ? `${lbl}: قيمة غير صالحة` : `${lbl}: invalid number` })
      .int(ar ? `${lbl}: يجب أن يكون رقماً صحيحاً` : `${lbl}: must be an integer`)
      .min(b.min, ar ? `${lbl}: الحد الأدنى ${b.min}` : `${lbl}: minimum is ${b.min}`)
      .max(b.max, ar ? `${lbl}: الحد الأقصى ${b.max}` : `${lbl}: maximum is ${b.max}`);
  }
  return z.object(shape).passthrough();
}

function SecurityPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("security_settings").select("*").maybeSingle();
      if (error) toast.error(error.message);
      setS(data ?? {});
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: any) => {
    setS((p) => ({ ...(p ?? {}), [k]: v }));
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  // Cross-field rule: idle < absolute (in minutes)
  const validateCrossFields = (data: Settings): Record<string, string> => {
    const e: Record<string, string> = {};
    const idle = Number(data.session_idle_timeout_minutes);
    const abs = Number(data.session_absolute_timeout_hours) * 60;
    if (idle && abs && idle >= abs) {
      e.session_idle_timeout_minutes = ar
        ? "انتهاء الخمول يجب أن يكون أقل من الانتهاء المطلق"
        : "Idle timeout must be less than absolute timeout";
    }
    return e;
  };

  const save = async () => {
    if (!s) return;
    const schema = buildSchema(ar);
    const parsed = schema.safeParse(s);
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? "");
        if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
    }
    Object.assign(fieldErrors, validateCrossFields(s));
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      toast.error(ar ? "تحقق من الحقول المظللة" : "Please fix highlighted fields", {
        description: Object.values(fieldErrors).slice(0, 3).join(" • "),
      });
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("security_settings").update(s as any).eq("id", true);
    setSaving(false);
    if (error) {
      toast.error(ar ? "فشل الحفظ" : "Save failed", { description: error.message });
    } else {
      toast.success(ar ? "تم الحفظ بنجاح" : "Saved successfully");
    }
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
  const Num = ({ k, label }: any) => {
    const b = numericBounds[k];
    const err = errors[k];
    return (
      <label className="text-xs">
        <span className="mb-1 flex items-center justify-between text-muted-foreground">
          <span>{label}</span>
          {b && <span className="text-[10px] opacity-60">{b.min}–{b.max}</span>}
        </span>
        <input
          type="number"
          min={b?.min}
          max={b?.max}
          value={s?.[k] ?? 0}
          onChange={(e) => set(k, e.target.value === "" ? 0 : parseInt(e.target.value))}
          aria-invalid={!!err}
          className={`w-full rounded-md border bg-background px-2 py-1.5 text-sm ${
            err ? "border-destructive" : "border-border"
          }`}
        />
        {err && (
          <span className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{err}</span>
          </span>
        )}
      </label>
    );
  };
  const Bool = ({ k, label }: any) => (
    <label className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs">
      <span>{label}</span>
      <input type="checkbox" checked={!!s?.[k]} onChange={(e) => set(k, e.target.checked)} />
    </label>
  );

  const errorCount = Object.keys(errors).length;

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

      {errorCount > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {ar
              ? `يوجد ${errorCount} خطأ في النموذج. صحّح الحقول قبل الحفظ.`
              : `${errorCount} field${errorCount > 1 ? "s" : ""} need fixing before saving.`}
          </span>
        </div>
      )}

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
