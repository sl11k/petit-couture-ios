import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { Webhook, Copy, Check, Shield, Code2, Info, Send, Loader2, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  sendTestIncomingWebhook,
  revealIncomingWebhookSecret,
} from "@/lib/incoming-webhooks.functions";
import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export const Route = createFileRoute("/admin/incoming-webhooks")({
  component: IncomingWebhooksPage,
});

type Kind = "shipping" | "payment";

type Endpoint = {
  key: Kind;
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  path: string;
  method: "POST";
  secretName: string;
  signatureHeader: string;
  samplePayload: object;
};

const ENDPOINTS: Endpoint[] = [
  {
    key: "shipping",
    title: { ar: "ويبهوك الشحن (OTO وغيره)", en: "Shipping webhook (OTO & others)" },
    description: {
      ar: "استخدمه لاستقبال تحديثات حالة الشحنات من شركات الشحن مثل OTO، أرامكس، سمسا.",
      en: "Receive shipment status updates from carriers like OTO, Aramex, SMSA.",
    },
    path: "/api/public/shipping-webhook",
    method: "POST",
    secretName: "SHIPPING_WEBHOOK_SECRET",
    signatureHeader: "X-Webhook-Signature",
    samplePayload: {
      carrier_code: "oto",
      tracking_number: "OTO-TRK-12345",
      event_type: "in_transit",
      status: "in_transit",
      description: "Package picked up",
      location: "Riyadh",
      occurred_at: new Date().toISOString(),
    },
  },
  {
    key: "payment",
    title: { ar: "ويبهوك المدفوعات", en: "Payment webhook" },
    description: {
      ar: "استخدمه لاستقبال إشعارات الدفع من بوابات الدفع.",
      en: "Receive payment notifications from payment gateways.",
    },
    path: "/api/public/payment-webhook",
    method: "POST",
    secretName: "PAYMENT_WEBHOOK_SECRET",
    signatureHeader: "X-Webhook-Signature",
    samplePayload: {
      provider: "stripe",
      event_type: "payment.succeeded",
      order_number: "ORD-0001",
      amount: 250.0,
      currency: "SAR",
      reference: "pi_123456",
      occurred_at: new Date().toISOString(),
    },
  },
];

function CopyBtn({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        toast.success("تم النسخ");
        setTimeout(() => setDone(false), 1500);
      }}
      className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
    >
      {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
}

function SecretReveal({ kind, ar }: { kind: Kind; ar: boolean }) {
  const reveal = useServerFn(revealIncomingWebhookSecret);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSecret = async () => {
    setErr(null);
    setLoading(true);
    try {
      const r: any = await reveal({ data: { kind }, headers: await authHeaders() });
      if (!r?.secret) throw new Error(ar ? "لم يتم إرجاع قيمة السر" : "No secret returned");
      setSecret(r.secret);
    } catch (e: any) {
      const msg = e?.message || (ar ? "فشل التحقق" : "Verification failed");
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSecret();
  }, [kind]);

  return (
    <div className="rounded-md border border-border bg-background p-2 space-y-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded border border-border bg-muted/40 px-2 py-1.5 font-mono text-[13px]" dir="ltr">
          {secret ?? (loading ? (ar ? "جارِ تحميل السر..." : "Loading secret...") : "—")}
        </code>
        <button
          type="button"
          disabled={loading}
          onClick={loadSecret}
          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[12px] text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {ar ? "تحديث" : "Refresh"}
        </button>
        {secret ? <CopyBtn text={secret} label={ar ? "نسخ السر" : "Copy"} /> : null}
      </div>
      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {err}
        </div>
      )}
    </div>
  );
}

function TestButton({ kind, ar }: { kind: Kind; ar: boolean }) {
  const send = useServerFn(sendTestIncomingWebhook);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ ok: boolean; httpStatus: number | null; deliveryId: string | null; errorMessage: string | null } | null>(null);

  const handle = async () => {
    setLoading(true);
    try {
      const r: any = await send({ data: { kind }, headers: await authHeaders() });
      setLast(r);
      if (r.ok) toast.success(ar ? `نجح الاختبار (HTTP ${r.httpStatus})` : `Test succeeded (HTTP ${r.httpStatus})`);
      else toast.error(ar ? `فشل الاختبار: ${r.errorMessage || r.httpStatus}` : `Test failed: ${r.errorMessage || r.httpStatus}`);
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {ar ? "إرسال اختبار" : "Send test"}
      </button>
      {last && (
        <div className="text-[11px] text-muted-foreground">
          {last.ok ? "✓" : "✕"} HTTP {last.httpStatus ?? "—"}{" · "}
          <Link to="/admin/webhooks-deliveries" className="underline hover:text-foreground">
            {ar ? "افتح سجل التسليمات" : "Open deliveries log"}
          </Link>
        </div>
      )}
    </div>
  );
}

function generateRandomKey(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

const OTO_ENV_DEFS: Array<{
  name: string;
  required: boolean;
  defaultValue?: string;
  description: { ar: string; en: string };
  generator?: () => string;
}> = [
  {
    name: "OTO_WEBHOOK_SECRET_KEY",
    required: true,
    description: {
      ar: "مطلوب — يُولَّد من قِبَلكم ويُرسَل لـ OTO عند تسجيل الـ webhook لتوقيع الطلبات.",
      en: "Required — generated by you and sent to OTO when registering the webhook to sign requests.",
    },
    generator: () => generateRandomKey(32),
  },
  {
    name: "OTO_WEBHOOK_AUTHORIZATION_KEY",
    required: false,
    description: {
      ar: "اختياري — قيمة ترويسة Authorization التي تتوقعها من OTO عند استدعاء الويبهوك.",
      en: "Optional — Authorization header value expected from OTO when calling the webhook.",
    },
    generator: () => "Bearer " + generateRandomKey(24),
  },
  {
    name: "OTO_API_BASE_URL",
    required: false,
    defaultValue: "https://api.tryoto.com/rest/v2",
    description: {
      ar: "اختياري — يستخدم القيمة الافتراضية ما لم تُغيَّر.",
      en: "Optional — defaults to the standard OTO base URL unless overridden.",
    },
  },
  {
    name: "OTO_ALLOW_UNSIGNED",
    required: false,
    defaultValue: "1",
    description: {
      ar: "مؤقتاً (=1) قبل تأكيد آلية التوقيع مع OTO. أزِله بعد تفعيل التحقق.",
      en: "Temporary (=1) before confirming OTO's signature scheme. Remove once verification is enforced.",
    },
  },
];

function OtoEnvCard({ ar }: { ar: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const d of OTO_ENV_DEFS) init[d.name] = d.defaultValue ?? "";
    return init;
  });

  const generateOne = (name: string) => {
    const def = OTO_ENV_DEFS.find((d) => d.name === name);
    if (!def?.generator) return;
    setValues((v) => ({ ...v, [name]: def.generator!() }));
    toast.success(ar ? "تم توليد قيمة عشوائية" : "Random value generated");
  };

  const generateAll = () => {
    setValues((v) => {
      const next = { ...v };
      for (const d of OTO_ENV_DEFS) {
        if (d.generator) next[d.name] = d.generator();
        else if (d.defaultValue) next[d.name] = d.defaultValue;
      }
      return next;
    });
    toast.success(ar ? "تم توليد كل المتغيرات" : "All values generated");
  };

  const envBlock = OTO_ENV_DEFS.map((d) => `${d.name}=${values[d.name] || ""}`).join("\n");

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" />
          {ar ? "متغيرات بيئة OTO" : "OTO environment variables"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateAll}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {ar ? "توليد الكل عشوائياً" : "Generate all"}
          </button>
          <CopyBtn text={envBlock} label={ar ? "نسخ كـ .env" : "Copy as .env"} />
        </div>
      </div>

      <div className="space-y-3">
        {OTO_ENV_DEFS.map((d) => (
          <div key={d.name} className="rounded-md border border-border bg-background p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono text-[12px] font-semibold">
                {d.name}
                {d.required ? (
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                    {ar ? "مطلوب" : "required"}
                  </span>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {ar ? "اختياري" : "optional"}
                  </span>
                )}
              </div>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {ar ? d.description.ar : d.description.en}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={values[d.name] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [d.name]: e.target.value }))}
                placeholder={d.defaultValue || (ar ? "اضغط توليد" : "click generate")}
                className="flex-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[12px]"
                dir="ltr"
              />
              {d.generator && (
                <button
                  type="button"
                  onClick={() => generateOne(d.name)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] hover:bg-muted"
                >
                  <RefreshCw className="h-3 w-3" />
                  {ar ? "توليد" : "Generate"}
                </button>
              )}
              {values[d.name] && <CopyBtn text={values[d.name]} label={ar ? "نسخ" : "Copy"} />}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {ar
          ? "بعد التوليد: انسخ القيم وأضفها في إعدادات الأسرار في الخلفية، ثم أرسل OTO_WEBHOOK_SECRET_KEY و OTO_WEBHOOK_AUTHORIZATION_KEY إلى OTO عند تسجيل الويبهوك."
          : "After generating: copy and add these to your backend secrets, then send OTO_WEBHOOK_SECRET_KEY and OTO_WEBHOOK_AUTHORIZATION_KEY to OTO when registering the webhook."}
      </p>
    </div>
  );
}

function IncomingWebhooksPage() {

  const { lang } = useLanguage();
  const ar = lang === "ar";

  const baseUrl = "https://lppme.trendify.sa";

  const curlExample = (ep: Endpoint) =>
    `curl -X POST '${baseUrl}${ep.path}' \\
  -H 'Content-Type: application/json' \\
  -H '${ep.signatureHeader}: <hmac_sha256_hex_of_body_with_secret>' \\
  -d '${JSON.stringify(ep.samplePayload)}'`;

  return (
    <div>
      <PageHeader
        title={{ ar: "Webhooks الواردة", en: "Incoming Webhooks" }}
        description={{
          ar: "روابط ويبهوك الخاصة بمنصتك التي تعطيها لمزودي الشحن والدفع لإرسال التحديثات إليك.",
          en: "Your platform's webhook URLs to share with shipping/payment providers so they can push updates to you.",
        }}
      />

      <OtoEnvCard ar={ar} />


      <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {ar ? "كيف تستخدم هذه الروابط؟" : "How to use these URLs"}
          </p>
          <p className="text-muted-foreground">
            {ar
              ? "1) انسخ رابط الويبهوك المناسب. 2) ألصقه في لوحة تحكم المزود (مثلاً OTO). 3) أعطِ المزود السر (Secret) الموافق ليوقّع كل طلب بـ HMAC-SHA256. يمكنك الضغط على «إرسال اختبار» لتجربة الرابط فوراً وستجد النتيجة في صفحة «سجل التسليمات»."
              : "1) Copy the matching webhook URL. 2) Paste it in your provider dashboard. 3) Share the matching secret so the provider signs every request with HMAC-SHA256. Use \"Send test\" to ping the endpoint and view results on the deliveries page."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {ENDPOINTS.map((ep) => {
          const fullUrl = baseUrl + ep.path;
          return (
            <div key={ep.key} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Webhook className="h-4 w-4 text-primary" />
                    {ar ? ep.title.ar : ep.title.en}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ar ? ep.description.ar : ep.description.en}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {ep.method}
                  </span>
                  <TestButton kind={ep.key} ar={ar} />
                </div>
              </div>

              {/* URL */}
              <div className="mb-3">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {ar ? "الرابط (URL)" : "URL"}
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
                  <code className="flex-1 truncate font-mono text-[12px]" dir="ltr">
                    {fullUrl}
                  </code>
                  <CopyBtn text={fullUrl} />
                </div>
              </div>

              {/* Secret + signature */}
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    {ar ? "السر (Secret)" : "Secret"}
                  </div>
                  <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[12px] mb-2">
                    {ep.secretName}
                  </div>
                  <SecretReveal kind={ep.key} ar={ar} />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {ar ? "ترويسة التوقيع" : "Signature header"}
                  </div>
                  <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[12px]">
                    {ep.signatureHeader}
                  </div>
                </div>
              </div>

              {/* Sample payload */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {ar ? "مثال على البيانات (Body)" : "Sample payload (body)"}
                  </div>
                  <CopyBtn text={JSON.stringify(ep.samplePayload, null, 2)} />
                </div>
                <pre className="max-h-48 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px]" dir="ltr">
                  {JSON.stringify(ep.samplePayload, null, 2)}
                </pre>
              </div>

              {/* cURL */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Code2 className="h-3 w-3" />
                    cURL
                  </div>
                  <CopyBtn text={curlExample(ep)} />
                </div>
                <pre className="max-h-40 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[11px]" dir="ltr">
                  {curlExample(ep)}
                </pre>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">
          {ar ? "كيف يتم التحقق من التوقيع؟" : "Signature verification"}
        </p>
        <ol className="list-inside list-decimal space-y-1">
          <li>
            {ar
              ? "المزود يحسب HMAC-SHA256 للجسم (body) كاملاً باستخدام السر المشترك."
              : "The provider computes HMAC-SHA256 of the raw request body using the shared secret."}
          </li>
          <li>
            {ar
              ? "النتيجة تُرسل بصيغة hex في ترويسة X-Webhook-Signature."
              : "The result is sent as a hex string in the X-Webhook-Signature header."}
          </li>
          <li>
            {ar
              ? "السيرفر يعيد الحساب ويقارن بأمان (timing-safe) — أي طلب توقيعه غير صحيح يُرفض."
              : "Our server recomputes and compares with timing-safe equality. Invalid signatures are rejected."}
          </li>
        </ol>
      </div>
    </div>
  );
}
