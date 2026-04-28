import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { logAudit } from "@/lib/audit";
import {
  Store, Phone, Globe, Receipt, Truck, Package, ShoppingCart, Bell,
  Search, Lock, Wrench, Database, Save, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

const TABS = [
  { id: "store", label: "المتجر", icon: Store },
  { id: "contact", label: "التواصل", icon: Phone },
  { id: "locale", label: "اللغة والعملة", icon: Globe },
  { id: "tax", label: "الضريبة", icon: Receipt },
  { id: "policies", label: "السياسات", icon: Receipt },
  { id: "orders", label: "الطلبات", icon: ShoppingCart },
  { id: "inventory", label: "المخزون", icon: Package },
  { id: "shipping", label: "الشحن", icon: Truck },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "seo", label: "SEO", icon: Search },
  { id: "privacy", label: "الخصوصية", icon: Lock },
  { id: "maintenance", label: "الصيانة", icon: Wrench },
  { id: "backup", label: "النسخ الاحتياطي", icon: Database },
] as const;

type TabId = typeof TABS[number]["id"];

function SettingsPage() {
  const { isSuperAdmin, can } = useUserRole();
  const allowed = isSuperAdmin || can("settings.manage") || can("integrations.manage");
  const [tab, setTab] = useState<TabId>("store");
  const [s, setS] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void supabase.from("site_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => { setS(data); setOriginal(data); });
  }, []);

  async function save() {
    if (!allowed) return alert("لا تملك صلاحية تعديل الإعدادات");
    setSaving(true); setMsg("");
    const { id, updated_at, ...payload } = s;
    const { error } = await supabase.from("site_settings").update(payload).eq("id", 1);
    setSaving(false);
    if (error) { setMsg("خطأ: " + error.message); return; }
    await logAudit({ action: "settings.update", entity: "site_settings", entity_id: "1", metadata: { tab } });
    setOriginal(s);
    setMsg("تم الحفظ ✓");
    setTimeout(() => setMsg(""), 2500);
  }

  function set(k: string, v: any) { setS({ ...s, [k]: v }); }

  if (!s) return <AdminShell><p className="p-6 text-center text-sm">جاري التحميل...</p></AdminShell>;

  const dirty = JSON.stringify(s) !== JSON.stringify(original);

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">إعدادات المتجر</h1>
          <p className="text-xs text-muted-foreground">جميع إعدادات المتجر العامة في مكان واحد</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs ${msg.includes("خطأ") ? "text-rose-600" : "text-emerald-600"}`}>{msg}</span>}
          <button onClick={save} disabled={!allowed || !dirty || saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        {/* Sidebar tabs */}
        <nav className="rounded-xl border border-border bg-card p-2 h-fit sticky top-4">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="rounded-xl border border-border bg-card p-5">
          {tab === "store" && (
            <Section title="بيانات المتجر">
              <Field label="اسم المتجر"><Input value={s.store_name} onChange={(v) => set("store_name", v)} /></Field>
              <Field label="الاسم القانوني (للفواتير)"><Input value={s.company_legal_name} onChange={(v) => set("company_legal_name", v)} /></Field>
              <Grid2>
                <Field label="الرقم الضريبي"><Input value={s.tax_number} onChange={(v) => set("tax_number", v)} /></Field>
                <Field label="السجل التجاري"><Input value={s.commercial_register} onChange={(v) => set("commercial_register", v)} /></Field>
              </Grid2>
              <Field label="رابط الشعار (Logo URL)"><Input value={s.logo_url} onChange={(v) => set("logo_url", v)} placeholder="https://..." /></Field>
              <Field label="رابط الأيقونة (Favicon)"><Input value={s.favicon_url} onChange={(v) => set("favicon_url", v)} placeholder="/favicon.ico" /></Field>
              <Field label="شعار الفاتورة"><Input value={s.invoice_logo_url} onChange={(v) => set("invoice_logo_url", v)} /></Field>
              <Field label="الشريط الإعلاني العلوي"><Input value={s.announcement_bar} onChange={(v) => set("announcement_bar", v)} /></Field>
            </Section>
          )}

          {tab === "contact" && (
            <Section title="التواصل والعنوان">
              <Field label="البريد الإلكتروني للدعم"><Input value={s.support_email} onChange={(v) => set("support_email", v)} type="email" /></Field>
              <Field label="رقم الهاتف"><Input value={s.store_phone} onChange={(v) => set("store_phone", v)} placeholder="+966..." /></Field>
              <Field label="رقم WhatsApp"><Input value={s.whatsapp_number} onChange={(v) => set("whatsapp_number", v)} placeholder="+966..." /></Field>
              <Field label="العنوان"><Input value={s.store_address} onChange={(v) => set("store_address", v)} /></Field>
              <Grid2>
                <Field label="المدينة"><Input value={s.store_city} onChange={(v) => set("store_city", v)} /></Field>
                <Field label="الدولة"><Input value={s.store_country} onChange={(v) => set("store_country", v)} placeholder="SA" /></Field>
              </Grid2>
              <h4 className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">روابط التواصل الاجتماعي</h4>
              <Grid2>
                <Field label="Instagram"><Input value={s.social_instagram} onChange={(v) => set("social_instagram", v)} /></Field>
                <Field label="Twitter / X"><Input value={s.social_twitter} onChange={(v) => set("social_twitter", v)} /></Field>
                <Field label="Facebook"><Input value={s.social_facebook} onChange={(v) => set("social_facebook", v)} /></Field>
                <Field label="TikTok"><Input value={s.social_tiktok} onChange={(v) => set("social_tiktok", v)} /></Field>
                <Field label="Snapchat"><Input value={s.social_snapchat} onChange={(v) => set("social_snapchat", v)} /></Field>
                <Field label="YouTube"><Input value={s.social_youtube} onChange={(v) => set("social_youtube", v)} /></Field>
              </Grid2>
            </Section>
          )}

          {tab === "locale" && (
            <Section title="اللغة والعملة">
              <Grid2>
                <Field label="رمز العملة"><Input value={s.currency_code} onChange={(v) => set("currency_code", v)} placeholder="SAR" /></Field>
                <Field label="رمز العرض"><Input value={s.currency_symbol} onChange={(v) => set("currency_symbol", v)} placeholder="ر.س" /></Field>
              </Grid2>
              <Field label="اللغة الافتراضية">
                <select value={s.default_language} onChange={(e) => set("default_language", e.target.value)} className={inputCls}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="اللغات المدعومة">
                <div className="flex gap-2">
                  {["ar","en","fr","es"].map((l) => {
                    const has = (s.supported_languages ?? []).includes(l);
                    return (
                      <button key={l} type="button"
                        onClick={() => {
                          const cur = s.supported_languages ?? [];
                          set("supported_languages", has ? cur.filter((x: string) => x !== l) : [...cur, l]);
                        }}
                        className={`rounded-md border px-3 py-1.5 text-xs ${has ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {l.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </Section>
          )}

          {tab === "tax" && (
            <Section title="إعدادات الضريبة">
              <Field label="نسبة الضريبة (مثال: 0.15 = 15%)"><Input type="number" step="0.01" value={s.tax_rate} onChange={(v) => set("tax_rate", parseFloat(v) || 0)} /></Field>
              <Field label="مسمّى الضريبة"><Input value={s.tax_label} onChange={(v) => set("tax_label", v)} /></Field>
              <Toggle label="السعر شامل الضريبة" checked={s.tax_inclusive} onChange={(v) => set("tax_inclusive", v)} />
              <Toggle label="إصدار فاتورة ضريبية" checked={s.issue_tax_invoice} onChange={(v) => set("issue_tax_invoice", v)} />
              <Toggle label="إصدار تلقائي عند الدفع" checked={s.auto_issue_on_payment} onChange={(v) => set("auto_issue_on_payment", v)} />
              <Field label="بادئة رقم الفاتورة"><Input value={s.invoice_prefix} onChange={(v) => set("invoice_prefix", v)} /></Field>
              <Field label="ملاحظة أسفل الفاتورة"><Textarea value={s.invoice_footer_note} onChange={(v) => set("invoice_footer_note", v)} /></Field>
            </Section>
          )}

          {tab === "policies" && (
            <Section title="السياسات والشروط">
              <Field label="سياسة الشحن"><Textarea rows={5} value={s.shipping_policy} onChange={(v) => set("shipping_policy", v)} /></Field>
              <Field label="سياسة الاسترجاع"><Textarea rows={5} value={s.return_policy} onChange={(v) => set("return_policy", v)} /></Field>
              <Field label="سياسة الخصوصية"><Textarea rows={5} value={s.privacy_policy} onChange={(v) => set("privacy_policy", v)} /></Field>
              <Field label="شروط الاستخدام"><Textarea rows={5} value={s.terms_of_service} onChange={(v) => set("terms_of_service", v)} /></Field>
            </Section>
          )}

          {tab === "orders" && (
            <Section title="إعدادات الطلبات">
              <Field label="الحد الأدنى لقيمة الطلب">
                <Input type="number" value={s.min_order_amount} onChange={(v) => set("min_order_amount", parseFloat(v) || 0)} />
              </Field>
              <Field label="مهلة الدفع (دقائق)">
                <Input type="number" value={s.order_payment_timeout_minutes} onChange={(v) => set("order_payment_timeout_minutes", parseInt(v) || 0)} />
              </Field>
              <Toggle label="تأكيد الطلبات تلقائياً" desc="بدون مراجعة يدوية" checked={s.order_auto_confirm} onChange={(v) => set("order_auto_confirm", v)} />
              <Toggle label="السماح بالشراء كزائر (بدون حساب)" checked={s.guest_checkout_enabled} onChange={(v) => set("guest_checkout_enabled", v)} />
            </Section>
          )}

          {tab === "inventory" && (
            <Section title="إعدادات المخزون">
              <Field label="حد التنبيه (انخفاض المخزون)">
                <Input type="number" value={s.inventory_low_stock_threshold} onChange={(v) => set("inventory_low_stock_threshold", parseInt(v) || 0)} />
              </Field>
              <Toggle label="إخفاء المنتج عند نفاد المخزون" checked={s.inventory_hide_when_out} onChange={(v) => set("inventory_hide_when_out", v)} />
              <Toggle label="السماح بالطلب المسبق (Backorder)" checked={s.inventory_allow_backorder} onChange={(v) => set("inventory_allow_backorder", v)} />
              <Toggle label="حجز الكمية عند بدء الدفع" desc="تمنع البيع المتزامن" checked={s.inventory_reserve_on_checkout} onChange={(v) => set("inventory_reserve_on_checkout", v)} />
            </Section>
          )}

          {tab === "shipping" && (
            <Section title="إعدادات الشحن">
              <Field label="رسوم الشحن الافتراضية">
                <Input type="number" value={s.shipping_fee} onChange={(v) => set("shipping_fee", parseFloat(v) || 0)} />
              </Field>
              <Field label="حد الشحن المجاني">
                <Input type="number" value={s.free_shipping_threshold} onChange={(v) => set("free_shipping_threshold", parseFloat(v) || 0)} />
              </Field>
              <p className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                إعدادات شركات الشحن التفصيلية (Aramex, SMSA...) في صفحة <b>التكاملات</b>.
              </p>
            </Section>
          )}

          {tab === "notifications" && (
            <Section title="إعدادات الإشعارات">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">إشعارات الإدارة</h4>
              <Toggle label="عند طلب جديد" checked={s.notify_admin_new_order} onChange={(v) => set("notify_admin_new_order", v)} />
              <Toggle label="عند انخفاض المخزون" checked={s.notify_admin_low_stock} onChange={(v) => set("notify_admin_low_stock", v)} />

              <h4 className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">إشعارات العملاء</h4>
              <Toggle label="إشعار العميل بتحديثات الطلب" checked={s.notify_customer_order_status} onChange={(v) => set("notify_customer_order_status", v)} />

              <h4 className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">قنوات الإرسال المفعّلة</h4>
              <Toggle label="📧 البريد الإلكتروني" checked={s.notify_channel_email} onChange={(v) => set("notify_channel_email", v)} />
              <Toggle label="📱 SMS" checked={s.notify_channel_sms} onChange={(v) => set("notify_channel_sms", v)} />
              <Toggle label="💬 WhatsApp" checked={s.notify_channel_whatsapp} onChange={(v) => set("notify_channel_whatsapp", v)} />
            </Section>
          )}

          {tab === "seo" && (
            <Section title="إعدادات SEO">
              <Field label="عنوان الصفحة الرئيسية (Title)"><Input value={s.seo_title} onChange={(v) => set("seo_title", v)} placeholder="< 60 حرفاً" /></Field>
              <Field label="وصف Meta (Description)"><Textarea value={s.seo_description} onChange={(v) => set("seo_description", v)} placeholder="< 160 حرفاً" /></Field>
              <Field label="الكلمات المفتاحية"><Input value={s.seo_keywords} onChange={(v) => set("seo_keywords", v)} placeholder="مفصولة بفاصلة" /></Field>
              <Field label="صورة OG (للمشاركة على السوشال)"><Input value={s.seo_og_image} onChange={(v) => set("seo_og_image", v)} /></Field>
              <Field label="إعدادات Robots">
                <select value={s.seo_robots} onChange={(e) => set("seo_robots", e.target.value)} className={inputCls}>
                  <option value="index,follow">index, follow (افتراضي)</option>
                  <option value="noindex,follow">noindex, follow</option>
                  <option value="index,nofollow">index, nofollow</option>
                  <option value="noindex,nofollow">noindex, nofollow (إخفاء كامل)</option>
                </select>
              </Field>
            </Section>
          )}

          {tab === "privacy" && (
            <Section title="إعدادات الخصوصية">
              <Toggle label="عرض شريط Cookie للزوار" checked={s.privacy_cookie_banner} onChange={(v) => set("privacy_cookie_banner", v)} />
              <Toggle label="طلب موافقة على رسائل التسويق" checked={s.privacy_marketing_consent} onChange={(v) => set("privacy_marketing_consent", v)} />
              <Field label="مدة الاحتفاظ بالبيانات (أيام)" desc="بعد هذه المدة يمكن أرشفة بيانات العملاء غير النشطين">
                <Input type="number" value={s.privacy_data_retention_days} onChange={(v) => set("privacy_data_retention_days", parseInt(v) || 365)} />
              </Field>
            </Section>
          )}

          {tab === "maintenance" && (
            <Section title="وضع الصيانة">
              <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 p-3 text-xs text-amber-800 dark:bg-amber-950/20">
                <AlertTriangle className="inline h-3.5 w-3.5" /> تفعيل هذا الوضع يخفي المتجر عن الزوار ويعرض رسالة الصيانة فقط.
              </div>
              <Toggle label="تفعيل وضع الصيانة" checked={s.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} />
              <Field label="رسالة الصيانة"><Textarea value={s.maintenance_message} onChange={(v) => set("maintenance_message", v)} /></Field>
              <Field label="عناوين IP المسموح لها بالدخول (مفصولة بفاصلة)" desc="حتى يتمكن المطورون من المعاينة">
                <Input value={(s.maintenance_allowed_ips ?? []).join(", ")} onChange={(v) => set("maintenance_allowed_ips", v.split(",").map((x) => x.trim()).filter(Boolean))} />
              </Field>
            </Section>
          )}

          {tab === "backup" && (
            <Section title="النسخ الاحتياطي">
              <Toggle label="تفعيل النسخ الاحتياطي التلقائي" checked={s.backup_auto_enabled} onChange={(v) => set("backup_auto_enabled", v)} />
              <Field label="تكرار النسخ">
                <select value={s.backup_frequency} onChange={(e) => set("backup_frequency", e.target.value)} className={inputCls}>
                  <option value="daily">يومي</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="monthly">شهري</option>
                </select>
              </Field>
              <Field label="إيميل لاستلام النسخة الاحتياطية"><Input type="email" value={s.backup_email} onChange={(v) => set("backup_email", v)} /></Field>
              {s.backup_last_run_at && (
                <p className="text-[11px] text-muted-foreground">
                  آخر نسخة: {new Date(s.backup_last_run_at).toLocaleString("ar")}
                </p>
              )}
              <p className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                💡 قاعدة البيانات يتم نسخها تلقائياً يومياً بواسطة Lovable Cloud. يمكنك أيضاً تصدير البيانات يدوياً من صفحات التقارير.
              </p>
            </Section>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// ===== UI helpers =====
const inputCls = "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="mb-3 border-b border-border pb-2 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {desc && <p className="mb-1 text-[10px] text-muted-foreground">{desc}</p>}
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Input(props: { value: any; onChange: (v: string) => void; type?: string; placeholder?: string; step?: string }) {
  return <input type={props.type ?? "text"} step={props.step} placeholder={props.placeholder}
    value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} className={inputCls} />;
}

function Textarea(props: { value: any; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea rows={props.rows ?? 3} placeholder={props.placeholder} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)}
    className={inputCls + " min-h-[80px]"} />;
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
      <div>
        <p className="text-xs font-medium">{label}</p>
        {desc && <p className="text-[10px] text-muted-foreground">{desc}</p>}
      </div>
      <span className="relative inline-flex">
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="block h-5 w-9 rounded-full bg-muted peer-checked:bg-primary"></span>
        <span className="absolute end-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:-translate-x-4 rtl:peer-checked:translate-x-4"></span>
      </span>
    </label>
  );
}
