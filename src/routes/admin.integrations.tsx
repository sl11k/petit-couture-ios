import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { logAudit } from "@/lib/audit";
import { INTEGRATION_CATALOG, CATEGORY_LABELS, type IntegrationCategory, type IntegrationDef } from "@/lib/integrations";
import { CheckCircle2, XCircle, Loader2, Settings, Webhook, Plus, Trash2, Copy } from "lucide-react";

export const Route = createFileRoute("/admin/integrations")({ component: IntegrationsAdmin });

type IntegrationRow = {
  id: string; category: string; provider: string; display_name: string | null;
  enabled: boolean; mode: string;
  api_key: string | null; api_secret: string | null;
  webhook_url: string | null; webhook_secret: string | null;
  config: Record<string, any>;
  last_test_at: string | null; last_test_ok: boolean | null; last_test_message: string | null;
};

type WebhookEndpoint = {
  id: string; name: string; url: string; secret: string | null; events: string[];
  enabled: boolean; last_delivery_at: string | null; last_delivery_status: number | null; failure_count: number;
};

const PROJECT_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://your-store.lovable.app";
const EVENT_TYPES = ["order.created","order.paid","order.shipped","order.delivered","order.cancelled","order.refunded","product.updated","customer.created","return.created"];

function IntegrationsAdmin() {
  const { isSuperAdmin, can } = useUserRole();
  const allowed = isSuperAdmin || can("integrations.manage");
  const [tab, setTab] = useState<IntegrationCategory | "webhooks">("payment");
  const [rows, setRows] = useState<Record<string, IntegrationRow>>({});
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [editing, setEditing] = useState<IntegrationDef | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [intRes, hookRes] = await Promise.all([
      supabase.from("integrations").select("*"),
      supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }),
    ]);
    const map: Record<string, IntegrationRow> = {};
    (intRes.data ?? []).forEach((r: any) => { map[`${r.category}:${r.provider}`] = r; });
    setRows(map);
    setEndpoints((hookRes.data ?? []) as WebhookEndpoint[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save(def: IntegrationDef, payload: Partial<IntegrationRow>) {
    if (!allowed) return alert("لا تملك صلاحية تعديل التكاملات");
    const existing = rows[`${def.category}:${def.provider}`];
    const data: any = {
      category: def.category, provider: def.provider, display_name: def.displayName,
      enabled: payload.enabled ?? existing?.enabled ?? false,
      mode: payload.mode ?? existing?.mode ?? "sandbox",
      api_key: payload.api_key ?? existing?.api_key ?? null,
      api_secret: payload.api_secret ?? existing?.api_secret ?? null,
      webhook_url: payload.webhook_url ?? existing?.webhook_url ?? `${PROJECT_ORIGIN}/api/public/webhook/${def.provider}`,
      webhook_secret: payload.webhook_secret ?? existing?.webhook_secret ?? null,
      config: { ...(existing?.config ?? {}), ...(payload.config ?? {}) },
    };
    if (existing?.id) {
      await supabase.from("integrations").update(data).eq("id", existing.id);
    } else {
      await supabase.from("integrations").insert(data);
    }
    await logAudit({ action: existing ? "integration.update" : "integration.connect", entity: "integration", entity_id: def.provider, metadata: { category: def.category, mode: data.mode, enabled: data.enabled } });
    await load();
  }

  async function toggleEnabled(def: IntegrationDef, enabled: boolean) {
    await save(def, { enabled });
    if (!enabled) await logAudit({ action: "integration.disconnect", entity: "integration", entity_id: def.provider });
  }

  async function testConnection(def: IntegrationDef) {
    if (!allowed) return;
    const existing = rows[`${def.category}:${def.provider}`];
    if (!existing) return alert("احفظ الإعدادات أولاً");
    setTesting(`${def.category}:${def.provider}`);
    // Simulated test (real implementation would call an edge function per provider)
    await new Promise((r) => setTimeout(r, 800));
    const ok = !!existing.api_key || (def.fields.length === 0);
    const msg = ok ? "تم الاتصال بنجاح ✓" : "ينقص API Key أو الإعدادات";
    await supabase.from("integrations").update({
      last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_message: msg,
    }).eq("id", existing.id);
    await logAudit({ action: ok ? "integration.test_ok" : "integration.test_fail", entity: "integration", entity_id: def.provider, metadata: { message: msg } });
    setTesting(null);
    await load();
  }

  const filteredCatalog = useMemo(
    () => INTEGRATION_CATALOG.filter((i) => i.category === tab),
    [tab],
  );

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">التكاملات</h1>
        <p className="text-xs text-muted-foreground">ربط المتجر بـ بوابات الدفع، الشحن، WhatsApp، SMS، التحليلات والأنظمة المؤسسية</p>
      </div>

      {!allowed && (
        <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-50/50 p-3 text-xs text-amber-800">
          أنت تشاهد فقط — تعديل التكاملات يتطلب صلاحية <b>integrations.manage</b>.
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-border pb-2">
        {(Object.keys(CATEGORY_LABELS) as IntegrationCategory[]).map((cat) => (
          <button key={cat} onClick={() => setTab(cat)}
            className={`rounded-md px-3 py-1.5 text-xs ${tab === cat ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
        <button onClick={() => setTab("webhooks")}
          className={`rounded-md px-3 py-1.5 text-xs ${tab === "webhooks" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
          🔗 Webhooks & API
        </button>
      </div>

      {loading ? <p className="p-6 text-center text-sm text-muted-foreground">جاري التحميل...</p> : tab === "webhooks" ? (
        <WebhooksTab endpoints={endpoints} onChange={load} allowed={allowed} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredCatalog.map((def) => {
            const row = rows[`${def.category}:${def.provider}`];
            const isOn = row?.enabled ?? false;
            const isTesting = testing === `${def.category}:${def.provider}`;
            return (
              <div key={def.provider} className={`rounded-xl border p-4 transition ${isOn ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-1.5"><span className="text-lg">{def.icon}</span> {def.displayName}</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{def.desc}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" checked={isOn} onChange={(e) => toggleEnabled(def, e.target.checked)} disabled={!allowed} className="peer sr-only" />
                    <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary"></div>
                    <div className="absolute end-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:-translate-x-4 rtl:peer-checked:translate-x-4"></div>
                  </label>
                </div>

                {row && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className={`rounded-full px-2 py-0.5 ${row.mode === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.mode === "live" ? "Live" : "Sandbox"}
                    </span>
                    {row.last_test_ok === true && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> اتصال ناجح</span>}
                    {row.last_test_ok === false && <span className="flex items-center gap-1 text-rose-600"><XCircle className="h-3 w-3" /> فشل</span>}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setEditing(def)} disabled={!allowed}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50">
                    <Settings className="h-3 w-3" /> إعدادات
                  </button>
                  {def.testable && (
                    <button onClick={() => testConnection(def)} disabled={!allowed || isTesting}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50">
                      {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} اختبار
                    </button>
                  )}
                  {def.hasWebhook && row?.webhook_url && (
                    <button onClick={() => navigator.clipboard.writeText(row.webhook_url!)}
                      title="نسخ Webhook URL"
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted">
                      <Webhook className="h-3 w-3" /> نسخ Hook
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditModal def={editing} row={rows[`${editing.category}:${editing.provider}`]} onClose={() => setEditing(null)} onSave={save} />
      )}
    </AdminShell>
  );
}

function EditModal({ def, row, onClose, onSave }: {
  def: IntegrationDef; row?: IntegrationRow; onClose: () => void;
  onSave: (def: IntegrationDef, payload: Partial<IntegrationRow>) => Promise<void>;
}) {
  const [mode, setMode] = useState(row?.mode ?? "sandbox");
  const [apiKey, setApiKey] = useState(row?.api_key ?? "");
  const [apiSecret, setApiSecret] = useState(row?.api_secret ?? "");
  const [webhookSecret, setWebhookSecret] = useState(row?.webhook_secret ?? "");
  const [config, setConfig] = useState<Record<string, string>>(row?.config ?? {});
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(def, { mode, api_key: apiKey || null, api_secret: apiSecret || null, webhook_secret: webhookSecret || null, config });
    setSaving(false);
    onClose();
  }

  const webhookUrl = row?.webhook_url ?? `${PROJECT_ORIGIN}/api/public/webhook/${def.provider}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><span className="text-2xl">{def.icon}</span> {def.displayName}</h2>
          <p className="text-xs text-muted-foreground">{def.desc}</p>
        </div>

        <div className="space-y-3 text-xs">
          {def.hasMode && (
            <div>
              <label className="mb-1 block font-medium">الوضع</label>
              <div className="flex gap-2">
                {["sandbox","live"].map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 rounded-md border px-3 py-1.5 ${mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {m === "sandbox" ? "🧪 تجريبي Sandbox" : "🚀 فعلي Live"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Field label="API Key / Token" value={apiKey} onChange={setApiKey} type="password" placeholder="sk_..." />
          <Field label="API Secret (اختياري)" value={apiSecret} onChange={setApiSecret} type="password" />

          {def.fields.map((f) => (
            f.type === "select" ? (
              <div key={f.key}>
                <label className="mb-1 block font-medium">{f.label}</label>
                <select value={config[f.key] ?? ""} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5">
                  <option value="">— اختر —</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : (
              <Field key={f.key} label={f.label} value={config[f.key] ?? ""} onChange={(v) => setConfig({ ...config, [f.key]: v })} type={f.type} placeholder={f.placeholder} />
            )
          ))}

          {def.hasWebhook && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-1 font-medium flex items-center gap-1"><Webhook className="h-3 w-3" /> Webhook URL</p>
              <div className="flex items-center gap-1">
                <input value={webhookUrl} readOnly className="flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-[10px]" />
                <button onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  className="rounded border border-border p-1.5 hover:bg-muted"><Copy className="h-3 w-3" /></button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">انسخ هذا الرابط إلى لوحة {def.displayName} لاستقبال الأحداث.</p>
              <Field label="Webhook Secret" value={webhookSecret} onChange={setWebhookSecret} type="password" />
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-1.5 text-xs">إلغاء</button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-md bg-primary px-4 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block font-medium">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5" />
    </div>
  );
}

function WebhooksTab({ endpoints, onChange, allowed }: { endpoints: WebhookEndpoint[]; onChange: () => void; allowed: boolean }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);

  async function create() {
    if (!newName || !newUrl) return;
    const secret = crypto.randomUUID();
    await supabase.from("webhook_endpoints").insert({ name: newName, url: newUrl, secret, events: newEvents });
    await logAudit({ action: "webhook.create", entity: "webhook", metadata: { name: newName, url: newUrl, events: newEvents } });
    setNewName(""); setNewUrl(""); setNewEvents([]); setCreating(false);
    onChange();
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الـ Webhook؟")) return;
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    await logAudit({ action: "webhook.delete", entity: "webhook", entity_id: id });
    onChange();
  }

  async function toggle(ep: WebhookEndpoint) {
    await supabase.from("webhook_endpoints").update({ enabled: !ep.enabled }).eq("id", ep.id);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold">🌐 REST API الخاص بمتجرك</h3>
        <p className="mb-2 text-[11px] text-muted-foreground">نقاط نهاية عامة تستقبل أحداث من خدمات خارجية:</p>
        <pre className="rounded bg-muted/40 p-2 font-mono text-[10px] overflow-x-auto">{`POST ${PROJECT_ORIGIN}/api/public/webhook/{provider}
GET  ${PROJECT_ORIGIN}/api/public/health`}</pre>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Webhooks الصادرة</h3>
          <p className="text-[11px] text-muted-foreground">أرسل أحداث المتجر إلى أي نظام خارجي (ERP, CRM, Zapier...)</p>
        </div>
        {allowed && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> إضافة Webhook
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-2 text-xs">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم (مثال: ERP Sync)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5" />
          <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com/webhook"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono" />
          <div>
            <p className="mb-1 font-medium">الأحداث المُرسَلة:</p>
            <div className="flex flex-wrap gap-1">
              {EVENT_TYPES.map((ev) => {
                const has = newEvents.includes(ev);
                return (
                  <button key={ev} onClick={() => setNewEvents(has ? newEvents.filter((x) => x !== ev) : [...newEvents, ev])}
                    className={`rounded border px-2 py-0.5 text-[10px] ${has ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="rounded border border-border px-3 py-1 text-[11px]">إلغاء</button>
            <button onClick={create} className="rounded bg-primary px-3 py-1 text-[11px] text-primary-foreground">إنشاء</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-3">الاسم</th>
              <th className="p-3">URL</th>
              <th className="p-3">الأحداث</th>
              <th className="p-3">آخر إرسال</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.id} className="border-b border-border/50 last:border-0">
                <td className="p-3 text-xs font-medium">{ep.name}</td>
                <td className="p-3 font-mono text-[10px] text-muted-foreground max-w-xs truncate">{ep.url}</td>
                <td className="p-3 text-[10px]">{ep.events.length} أحداث</td>
                <td className="p-3 text-[10px] text-muted-foreground">
                  {ep.last_delivery_at ? new Date(ep.last_delivery_at).toLocaleString("ar") : "—"}
                  {ep.failure_count > 0 && <span className="ms-1 text-rose-600">({ep.failure_count} فشل)</span>}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => toggle(ep)} disabled={!allowed}
                      className={`rounded px-2 py-0.5 text-[10px] ${ep.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {ep.enabled ? "مفعّل" : "معطّل"}
                    </button>
                    {allowed && (
                      <button onClick={() => remove(ep.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3 w-3" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {endpoints.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">لا توجد Webhooks بعد</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
