import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import {
  MessageCircle,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Activity,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProviderSettings,
  saveProviderCredentials,
  sendTestNotification,
  checkProviderHealth,
} from "@/lib/notif/admin.functions";

export const Route = createFileRoute("/admin/notif-wasender")({
  component: WasenderPage,
});

function WasenderPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const getFn = useServerFn(getProviderSettings);
  const saveFn = useServerFn(saveProviderCredentials);
  const testFn = useServerFn(sendTestNotification);
  const healthFn = useServerFn(checkProviderHealth);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({
    api_url: "https://wasenderapi.com",
    api_key: "",
    instance_id: "",
    session_name: "",
    webhook_secret: "",
    timeout_ms: 15000,
    retry_attempts: 3,
    retry_delay_ms: 5000,
    ssl_verify: true,
    enable_provider: false,
  });
  const [hasKey, setHasKey] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [testTo, setTestTo] = useState("");
  const [testBody, setTestBody] = useState(
    ar ? "رسالة اختبار من مركز الإشعارات ✅" : "Test message from Notifications Center ✅",
  );

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await getFn({ data: { provider_code: "wasender" } });
      if (r?.credentials) {
        setForm((f) => ({
          ...f,
          api_url: r.credentials.api_url || "https://wasenderapi.com",
          instance_id: r.credentials.instance_id || "",
          session_name: r.credentials.session_name || "",
          timeout_ms: r.credentials.timeout_ms ?? 15000,
          retry_attempts: r.credentials.retry_attempts ?? 3,
          retry_delay_ms: r.credentials.retry_delay_ms ?? 5000,
          ssl_verify: r.credentials.ssl_verify ?? true,
          enable_provider: r.provider?.is_enabled ?? false,
        }));
        setHasKey(!!r.credentials.has_api_key);
      } else if (r?.provider) {
        setForm((f) => ({ ...f, enable_provider: r.provider.is_enabled ?? false }));
      }
      setHealth(r?.health ?? null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          provider_code: "wasender",
          api_url: form.api_url,
          api_key: form.api_key || undefined,
          instance_id: form.instance_id || undefined,
          session_name: form.session_name || undefined,
          webhook_secret: form.webhook_secret || undefined,
          timeout_ms: form.timeout_ms,
          retry_attempts: form.retry_attempts,
          retry_delay_ms: form.retry_delay_ms,
          ssl_verify: form.ssl_verify,
          enable_provider: form.enable_provider,
        },
      });
      toast.success(ar ? "تم الحفظ بنجاح" : "Saved");
      setForm((f) => ({ ...f, api_key: "", webhook_secret: "" }));
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!testTo) return toast.error(ar ? "أدخل رقم واتساب" : "Enter a WhatsApp number");
    setTesting(true);
    try {
      const r: any = await testFn({ data: { to: testTo, body: testBody } });
      if (r?.ok) toast.success(ar ? "أُرسلت الرسالة" : "Message sent");
      else toast.error(r?.error || (ar ? "فشل الإرسال" : "Send failed"));
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setTesting(false);
    }
  };

  const runHealth = async () => {
    setChecking(true);
    try {
      const r: any = await healthFn();
      if (r?.ok) toast.success(ar ? "المزود متصل" : "Provider healthy");
      else toast.error(r?.error_message || (ar ? "المزود غير متاح" : "Unhealthy"));
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={{ ar: "إعدادات WasenderAPI", en: "WasenderAPI Settings" }}
        description={{
          ar: "أدخل بيانات اعتماد Wasender وابدأ إرسال إشعارات الطلبات تلقائياً",
          en: "Enter Wasender credentials and start sending order notifications automatically",
        }}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="h-4 w-4 text-primary" />
                {ar ? "بيانات الاعتماد" : "Credentials"}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={ar ? "رابط API" : "API URL"} full>
                  <input
                    className="input"
                    value={form.api_url}
                    onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                    placeholder="https://wasenderapi.com"
                  />
                </Field>
                <Field label={ar ? "مفتاح API" : "API Key"} full hint={
                  hasKey
                    ? ar
                      ? "محفوظ ومشفّر — اترك الحقل فارغاً لعدم التغيير"
                      : "Stored & encrypted — leave blank to keep unchanged"
                    : ar
                      ? "لم يتم الحفظ بعد"
                      : "Not saved yet"
                }>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      type={showKey ? "text" : "password"}
                      value={form.api_key}
                      onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                      placeholder={hasKey ? "••••••••" : ar ? "أدخل المفتاح" : "Paste key"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="rounded-md border border-border px-2 hover:bg-muted"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </Field>
                <Field label={ar ? "Instance ID (اختياري)" : "Instance ID (optional)"}>
                  <input
                    className="input"
                    value={form.instance_id}
                    onChange={(e) => setForm({ ...form, instance_id: e.target.value })}
                  />
                </Field>
                <Field label={ar ? "اسم الجلسة (اختياري)" : "Session name (optional)"}>
                  <input
                    className="input"
                    value={form.session_name}
                    onChange={(e) => setForm({ ...form, session_name: e.target.value })}
                  />
                </Field>
                <Field label={ar ? "سر Webhook (اختياري)" : "Webhook secret (optional)"} full>
                  <input
                    className="input"
                    type="password"
                    value={form.webhook_secret}
                    onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                    placeholder={ar ? "للتحقق من webhooks الواردة" : "For verifying inbound webhooks"}
                  />
                </Field>
                <Field label={ar ? "مهلة الطلب (ms)" : "Timeout (ms)"}>
                  <input
                    className="input"
                    type="number"
                    value={form.timeout_ms}
                    onChange={(e) => setForm({ ...form, timeout_ms: Number(e.target.value) })}
                  />
                </Field>
                <Field label={ar ? "عدد المحاولات" : "Retry attempts"}>
                  <input
                    className="input"
                    type="number"
                    value={form.retry_attempts}
                    onChange={(e) => setForm({ ...form, retry_attempts: Number(e.target.value) })}
                  />
                </Field>
                <Field label={ar ? "تأخير الإعادة (ms)" : "Retry delay (ms)"}>
                  <input
                    className="input"
                    type="number"
                    value={form.retry_delay_ms}
                    onChange={(e) => setForm({ ...form, retry_delay_ms: Number(e.target.value) })}
                  />
                </Field>
                <Field label="SSL">
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.ssl_verify}
                      onChange={(e) => setForm({ ...form, ssl_verify: e.target.checked })}
                    />
                    {ar ? "تحقق شهادة SSL" : "Verify SSL certificate"}
                  </label>
                </Field>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.enable_provider}
                    onChange={(e) => setForm({ ...form, enable_provider: e.target.checked })}
                  />
                  {ar ? "تفعيل هذا المزود كافتراضي" : "Enable this provider as default"}
                </label>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {ar ? "حفظ" : "Save"}
                </button>
              </div>
            </div>

            {/* Test send */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Send className="h-4 w-4 text-primary" />
                {ar ? "إرسال رسالة اختبار" : "Send test message"}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  className="input sm:col-span-1"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="9665XXXXXXXX"
                />
                <input
                  className="input sm:col-span-2"
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                />
              </div>
              <button
                onClick={runTest}
                disabled={testing}
                className="mt-3 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {ar ? "إرسال الآن" : "Send now"}
              </button>
            </div>
          </div>

          {/* Right: health + docs */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4 text-primary" />
                  {ar ? "حالة الاتصال" : "Health"}
                </div>
                <button
                  onClick={runHealth}
                  disabled={checking}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
                >
                  {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                  {ar ? "فحص" : "Check"}
                </button>
              </div>
              {health ? (
                <div className="space-y-2 text-xs">
                  <Row label={ar ? "الحالة" : "Status"} value={health.status} ok={health.status === "healthy"} />
                  <Row label={ar ? "الجلسة" : "Session"} value={health.session_status || "—"} />
                  <Row label={ar ? "آخر نجاح" : "Last success"} value={health.last_success_at ? new Date(health.last_success_at).toLocaleString(ar ? "ar" : "en") : "—"} />
                  <Row label={ar ? "آخر فشل" : "Last failure"} value={health.last_failure_at ? new Date(health.last_failure_at).toLocaleString(ar ? "ar" : "en") : "—"} />
                  <Row label={ar ? "متوسط الاستجابة" : "Avg response"} value={health.avg_response_ms ? `${health.avg_response_ms} ms` : "—"} />
                  {health.last_error && (
                    <div className="mt-2 rounded bg-destructive/10 p-2 text-destructive">{health.last_error}</div>
                  )}
                </div>
              ) : (
                <div className="text-center text-xs text-muted-foreground">
                  {ar ? "لم يتم الفحص بعد" : "Not checked yet"}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4 text-xs">
              <div className="mb-2 font-medium">{ar ? "كيف تحصل على المفتاح؟" : "How to get the key"}</div>
              <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                <li>{ar ? "افتح لوحة Wasender" : "Open your Wasender dashboard"}</li>
                <li>{ar ? "أنشئ جلسة WhatsApp واربط رقمك" : "Create a WhatsApp session and link your number"}</li>
                <li>{ar ? "انسخ API Key ورابط API" : "Copy your API Key and API URL"}</li>
                <li>{ar ? "الصقهما هنا ثم اضغط حفظ" : "Paste them here and click Save"}</li>
              </ol>
              <a
                href="https://wasenderapi.com/docs"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> {ar ? "توثيق Wasender" : "Wasender docs"}
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          border-radius: 0.375rem;
          padding: 0.5rem 0.625rem;
          font-size: 0.8125rem;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  hint?: string;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: any; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-medium">
        {ok === true && <CheckCircle2 className="h-3 w-3 text-green-600" />}
        {ok === false && <XCircle className="h-3 w-3 text-destructive" />}
        {value}
      </span>
    </div>
  );
}
