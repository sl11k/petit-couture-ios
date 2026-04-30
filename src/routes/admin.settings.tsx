import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { logAudit } from "@/lib/audit";
import { useTr } from "@/i18n/tr";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Store, Phone, Globe, Receipt, Truck, Package, ShoppingCart, Bell,
  Search, Lock, Wrench, Database, Save, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

type TabId =
  | "store" | "contact" | "locale" | "tax" | "policies" | "orders"
  | "inventory" | "shipping" | "notifications" | "seo" | "privacy"
  | "maintenance" | "backup";

function SettingsPage() {
  const tr = useTr();
  const { lang } = useLanguage();
  const { isSuperAdmin, can } = useUserRole();
  const allowed = isSuperAdmin || can("settings.manage") || can("integrations.manage");
  const [tab, setTab] = useState<TabId>("store");
  const [s, setS] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const TABS = useMemo(() => ([
    { id: "store" as TabId, label: tr("المتجر", "Store"), icon: Store },
    { id: "contact" as TabId, label: tr("التواصل", "Contact"), icon: Phone },
    { id: "locale" as TabId, label: tr("اللغة والعملة", "Language & Currency"), icon: Globe },
    { id: "tax" as TabId, label: tr("الضريبة", "Tax"), icon: Receipt },
    { id: "policies" as TabId, label: tr("السياسات", "Policies"), icon: Receipt },
    { id: "orders" as TabId, label: tr("الطلبات", "Orders"), icon: ShoppingCart },
    { id: "inventory" as TabId, label: tr("المخزون", "Inventory"), icon: Package },
    { id: "shipping" as TabId, label: tr("الشحن", "Shipping"), icon: Truck },
    { id: "notifications" as TabId, label: tr("الإشعارات", "Notifications"), icon: Bell },
    { id: "seo" as TabId, label: "SEO", icon: Search },
    { id: "privacy" as TabId, label: tr("الخصوصية", "Privacy"), icon: Lock },
    { id: "maintenance" as TabId, label: tr("الصيانة", "Maintenance"), icon: Wrench },
    { id: "backup" as TabId, label: tr("النسخ الاحتياطي", "Backup"), icon: Database },
  ]), [tr]);

  useEffect(() => {
    void supabase.from("site_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => { setS(data); setOriginal(data); });
  }, []);

  async function save() {
    if (!allowed) return alert(tr("لا تملك صلاحية تعديل الإعدادات", "You don't have permission to edit settings"));
    setSaving(true); setMsg("");
    const { id, updated_at, ...payload } = s;
    const { error } = await supabase.from("site_settings").update(payload).eq("id", 1);
    setSaving(false);
    if (error) { setMsg(tr("خطأ: ", "Error: ") + error.message); return; }
    await logAudit({ action: "settings.update", entity: "site_settings", entity_id: "1", metadata: { tab } });
    setOriginal(s);
    setMsg(tr("تم الحفظ ✓", "Saved ✓"));
    setTimeout(() => setMsg(""), 2500);
  }

  function set(k: string, v: any) { setS({ ...s, [k]: v }); }

  if (!s) return <AdminShell><p className="p-6 text-center text-sm">{tr("جاري التحميل...", "Loading...")}</p></AdminShell>;

  const dirty = JSON.stringify(s) !== JSON.stringify(original);
  const isError = msg.includes("خطأ") || msg.toLowerCase().includes("error");

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{tr("إعدادات المتجر", "Store Settings")}</h1>
          <p className="text-xs text-muted-foreground">{tr("جميع إعدادات المتجر العامة في مكان واحد", "All general store settings in one place")}</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs ${isError ? "text-rose-600" : "text-emerald-600"}`}>{msg}</span>}
          <button onClick={save} disabled={!allowed || !dirty || saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {saving ? tr("جاري الحفظ...", "Saving...") : tr("حفظ التغييرات", "Save changes")}
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
            <Section title={tr("بيانات المتجر", "Store information")}>
              <Field label={tr("اسم المتجر", "Store name")}><Input value={s.store_name} onChange={(v) => set("store_name", v)} /></Field>
              <Field label={tr("الاسم القانوني (للفواتير)", "Legal name (for invoices)")}><Input value={s.company_legal_name} onChange={(v) => set("company_legal_name", v)} /></Field>
              <Grid2>
                <Field label={tr("الرقم الضريبي", "Tax number")}><Input value={s.tax_number} onChange={(v) => set("tax_number", v)} /></Field>
                <Field label={tr("السجل التجاري", "Commercial register")}><Input value={s.commercial_register} onChange={(v) => set("commercial_register", v)} /></Field>
              </Grid2>
              <Field label={tr("رابط الشعار (Logo URL)", "Logo URL")}><Input value={s.logo_url} onChange={(v) => set("logo_url", v)} placeholder="https://..." /></Field>
              <Field label={tr("رابط الأيقونة (Favicon)", "Favicon URL")}><Input value={s.favicon_url} onChange={(v) => set("favicon_url", v)} placeholder="/favicon.ico" /></Field>
              <Field label={tr("شعار الفاتورة", "Invoice logo")}><Input value={s.invoice_logo_url} onChange={(v) => set("invoice_logo_url", v)} /></Field>
              <Field label={tr("الشريط الإعلاني العلوي", "Top announcement bar")}><Input value={s.announcement_bar} onChange={(v) => set("announcement_bar", v)} /></Field>
            </Section>
          )}

          {tab === "contact" && (
            <Section title={tr("التواصل والعنوان", "Contact & Address")}>
              <Field label={tr("البريد الإلكتروني للدعم", "Support email")}><Input value={s.support_email} onChange={(v) => set("support_email", v)} type="email" /></Field>
              <Field label={tr("رقم الهاتف", "Phone number")}><Input value={s.store_phone} onChange={(v) => set("store_phone", v)} placeholder="+966..." /></Field>
              <Field label={tr("رقم WhatsApp", "WhatsApp number")}><Input value={s.whatsapp_number} onChange={(v) => set("whatsapp_number", v)} placeholder="+966..." /></Field>
              <Field label={tr("العنوان", "Address")}><Input value={s.store_address} onChange={(v) => set("store_address", v)} /></Field>
              <Grid2>
                <Field label={tr("المدينة", "City")}><Input value={s.store_city} onChange={(v) => set("store_city", v)} /></Field>
                <Field label={tr("الدولة", "Country")}><Input value={s.store_country} onChange={(v) => set("store_country", v)} placeholder="SA" /></Field>
              </Grid2>
              <h4 className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">{tr("روابط التواصل الاجتماعي", "Social media links")}</h4>
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
            <Section title={tr("اللغة والعملة", "Language & Currency")}>
              <Grid2>
                <Field label={tr("رمز العملة", "Currency code")}><Input value={s.currency_code} onChange={(v) => set("currency_code", v)} placeholder="SAR" /></Field>
                <Field label={tr("رمز العرض", "Display symbol")}><Input value={s.currency_symbol} onChange={(v) => set("currency_symbol", v)} placeholder="ر.س" /></Field>
              </Grid2>
              <Field label={tr("اللغة الافتراضية", "Default language")}>
                <select value={s.default_language} onChange={(e) => set("default_language", e.target.value)} className={inputCls}>
                  <option value="ar">{tr("العربية", "Arabic")}</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label={tr("اللغات المدعومة", "Supported languages")}>
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
            <Section title={tr("إعدادات الضريبة", "Tax settings")}>
              <Field label={tr("نسبة الضريبة (مثال: 0.15 = 15%)", "Tax rate (e.g. 0.15 = 15%)")}><Input type="number" step="0.01" value={s.tax_rate} onChange={(v) => set("tax_rate", parseFloat(v) || 0)} /></Field>
              <Field label={tr("مسمّى الضريبة", "Tax label")}><Input value={s.tax_label} onChange={(v) => set("tax_label", v)} /></Field>
              <Toggle label={tr("السعر شامل الضريبة", "Price includes tax")} checked={s.tax_inclusive} onChange={(v) => set("tax_inclusive", v)} />
              <Toggle label={tr("إصدار فاتورة ضريبية", "Issue tax invoice")} checked={s.issue_tax_invoice} onChange={(v) => set("issue_tax_invoice", v)} />
              <Toggle label={tr("إصدار تلقائي عند الدفع", "Auto-issue on payment")} checked={s.auto_issue_on_payment} onChange={(v) => set("auto_issue_on_payment", v)} />
              <Field label={tr("بادئة رقم الفاتورة", "Invoice number prefix")}><Input value={s.invoice_prefix} onChange={(v) => set("invoice_prefix", v)} /></Field>
              <Field label={tr("ملاحظة أسفل الفاتورة", "Invoice footer note")}><Textarea value={s.invoice_footer_note} onChange={(v) => set("invoice_footer_note", v)} /></Field>
            </Section>
          )}

          {tab === "policies" && (
            <Section title={tr("السياسات والشروط", "Policies & Terms")}>
              <Field label={tr("سياسة الشحن", "Shipping policy")}><Textarea rows={5} value={s.shipping_policy} onChange={(v) => set("shipping_policy", v)} /></Field>
              <Field label={tr("سياسة الاسترجاع", "Return policy")}><Textarea rows={5} value={s.return_policy} onChange={(v) => set("return_policy", v)} /></Field>
              <Field label={tr("سياسة الخصوصية", "Privacy policy")}><Textarea rows={5} value={s.privacy_policy} onChange={(v) => set("privacy_policy", v)} /></Field>
              <Field label={tr("شروط الاستخدام", "Terms of service")}><Textarea rows={5} value={s.terms_of_service} onChange={(v) => set("terms_of_service", v)} /></Field>
            </Section>
          )}

          {tab === "orders" && (
            <Section title={tr("إعدادات الطلبات", "Order settings")}>
              <Field label={tr("الحد الأدنى لقيمة الطلب", "Minimum order amount")}>
                <Input type="number" value={s.min_order_amount} onChange={(v) => set("min_order_amount", parseFloat(v) || 0)} />
              </Field>
              <Field label={tr("مهلة الدفع (دقائق)", "Payment timeout (minutes)")}>
                <Input type="number" value={s.order_payment_timeout_minutes} onChange={(v) => set("order_payment_timeout_minutes", parseInt(v) || 0)} />
              </Field>
              <Toggle label={tr("تأكيد الطلبات تلقائياً", "Auto-confirm orders")} desc={tr("بدون مراجعة يدوية", "Without manual review")} checked={s.order_auto_confirm} onChange={(v) => set("order_auto_confirm", v)} />
              <Toggle label={tr("السماح بالشراء كزائر (بدون حساب)", "Allow guest checkout (no account)")} checked={s.guest_checkout_enabled} onChange={(v) => set("guest_checkout_enabled", v)} />
            </Section>
          )}

          {tab === "inventory" && (
            <Section title={tr("إعدادات المخزون", "Inventory settings")}>
              <Field label={tr("حد التنبيه (انخفاض المخزون)", "Low stock alert threshold")}>
                <Input type="number" value={s.inventory_low_stock_threshold} onChange={(v) => set("inventory_low_stock_threshold", parseInt(v) || 0)} />
              </Field>
              <Toggle label={tr("إخفاء المنتج عند نفاد المخزون", "Hide product when out of stock")} checked={s.inventory_hide_when_out} onChange={(v) => set("inventory_hide_when_out", v)} />
              <Toggle label={tr("السماح بالطلب المسبق (Backorder)", "Allow backorder")} checked={s.inventory_allow_backorder} onChange={(v) => set("inventory_allow_backorder", v)} />
              <Toggle label={tr("حجز الكمية عند بدء الدفع", "Reserve quantity at checkout")} desc={tr("تمنع البيع المتزامن", "Prevents concurrent sale")} checked={s.inventory_reserve_on_checkout} onChange={(v) => set("inventory_reserve_on_checkout", v)} />
            </Section>
          )}

          {tab === "shipping" && (
            <Section title={tr("إعدادات الشحن", "Shipping settings")}>
              <Field label={tr("رسوم الشحن الافتراضية", "Default shipping fee")}>
                <Input type="number" value={s.shipping_fee} onChange={(v) => set("shipping_fee", parseFloat(v) || 0)} />
              </Field>
              <Field label={tr("حد الشحن المجاني", "Free shipping threshold")}>
                <Input type="number" value={s.free_shipping_threshold} onChange={(v) => set("free_shipping_threshold", parseFloat(v) || 0)} />
              </Field>
              <p className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {tr("إعدادات شركات الشحن التفصيلية (Aramex, SMSA...) في صفحة ", "Detailed carrier settings (Aramex, SMSA...) are on the ")}<b>{tr("التكاملات", "Integrations")}</b>{tr(".", " page.")}
              </p>
            </Section>
          )}

          {tab === "notifications" && (
            <Section title={tr("إعدادات الإشعارات", "Notification settings")}>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{tr("إشعارات الإدارة", "Admin notifications")}</h4>
              <Toggle label={tr("عند طلب جديد", "On new order")} checked={s.notify_admin_new_order} onChange={(v) => set("notify_admin_new_order", v)} />
              <Toggle label={tr("عند انخفاض المخزون", "On low stock")} checked={s.notify_admin_low_stock} onChange={(v) => set("notify_admin_low_stock", v)} />

              <h4 className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">{tr("إشعارات العملاء", "Customer notifications")}</h4>
              <Toggle label={tr("إشعار العميل بتحديثات الطلب", "Notify customer of order updates")} checked={s.notify_customer_order_status} onChange={(v) => set("notify_customer_order_status", v)} />

              <h4 className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">{tr("قنوات الإرسال المفعّلة", "Enabled channels")}</h4>
              <Toggle label={tr("📧 البريد الإلكتروني", "📧 Email")} checked={s.notify_channel_email} onChange={(v) => set("notify_channel_email", v)} />
              <Toggle label="📱 SMS" checked={s.notify_channel_sms} onChange={(v) => set("notify_channel_sms", v)} />
              <Toggle label="💬 WhatsApp" checked={s.notify_channel_whatsapp} onChange={(v) => set("notify_channel_whatsapp", v)} />
            </Section>
          )}

          {tab === "seo" && (
            <Section title={tr("إعدادات SEO", "SEO settings")}>
              <Field label={tr("عنوان الصفحة الرئيسية (Title)", "Home page title")}><Input value={s.seo_title} onChange={(v) => set("seo_title", v)} placeholder={tr("< 60 حرفاً", "< 60 characters")} /></Field>
              <Field label={tr("وصف Meta (Description)", "Meta description")}><Textarea value={s.seo_description} onChange={(v) => set("seo_description", v)} placeholder={tr("< 160 حرفاً", "< 160 characters")} /></Field>
              <Field label={tr("الكلمات المفتاحية", "Keywords")}><Input value={s.seo_keywords} onChange={(v) => set("seo_keywords", v)} placeholder={tr("مفصولة بفاصلة", "Comma separated")} /></Field>
              <Field label={tr("صورة OG (للمشاركة على السوشال)", "OG image (social sharing)")}><Input value={s.seo_og_image} onChange={(v) => set("seo_og_image", v)} /></Field>
              <Field label={tr("إعدادات Robots", "Robots settings")}>
                <select value={s.seo_robots} onChange={(e) => set("seo_robots", e.target.value)} className={inputCls}>
                  <option value="index,follow">{tr("index, follow (افتراضي)", "index, follow (default)")}</option>
                  <option value="noindex,follow">noindex, follow</option>
                  <option value="index,nofollow">index, nofollow</option>
                  <option value="noindex,nofollow">{tr("noindex, nofollow (إخفاء كامل)", "noindex, nofollow (fully hidden)")}</option>
                </select>
              </Field>
            </Section>
          )}

          {tab === "privacy" && (
            <Section title={tr("إعدادات الخصوصية", "Privacy settings")}>
              <Toggle label={tr("عرض شريط Cookie للزوار", "Show cookie banner to visitors")} checked={s.privacy_cookie_banner} onChange={(v) => set("privacy_cookie_banner", v)} />
              <Toggle label={tr("طلب موافقة على رسائل التسويق", "Require marketing consent")} checked={s.privacy_marketing_consent} onChange={(v) => set("privacy_marketing_consent", v)} />
              <Field label={tr("مدة الاحتفاظ بالبيانات (أيام)", "Data retention (days)")} desc={tr("بعد هذه المدة يمكن أرشفة بيانات العملاء غير النشطين", "Inactive customer data can be archived after this period")}>
                <Input type="number" value={s.privacy_data_retention_days} onChange={(v) => set("privacy_data_retention_days", parseInt(v) || 365)} />
              </Field>
            </Section>
          )}

          {tab === "maintenance" && (
            <Section title={tr("وضع الصيانة", "Maintenance mode")}>
              <div className="rounded-lg border border-amber-300/40 bg-amber-50/50 p-3 text-xs text-amber-800 dark:bg-amber-950/20">
                <AlertTriangle className="inline h-3.5 w-3.5" /> {tr("تفعيل هذا الوضع يخفي المتجر عن الزوار ويعرض رسالة الصيانة فقط.", "Enabling this mode hides the store from visitors and shows only the maintenance message.")}
              </div>
              <Toggle label={tr("تفعيل وضع الصيانة", "Enable maintenance mode")} checked={s.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} />
              <Field label={tr("رسالة الصيانة", "Maintenance message")}><Textarea value={s.maintenance_message} onChange={(v) => set("maintenance_message", v)} /></Field>
              <Field label={tr("عناوين IP المسموح لها بالدخول (مفصولة بفاصلة)", "Allowed IP addresses (comma separated)")} desc={tr("حتى يتمكن المطورون من المعاينة", "So developers can preview")}>
                <Input value={(s.maintenance_allowed_ips ?? []).join(", ")} onChange={(v) => set("maintenance_allowed_ips", v.split(",").map((x) => x.trim()).filter(Boolean))} />
              </Field>
            </Section>
          )}

          {tab === "backup" && (
            <Section title={tr("النسخ الاحتياطي", "Backup")}>
              <Toggle label={tr("تفعيل النسخ الاحتياطي التلقائي", "Enable automatic backup")} checked={s.backup_auto_enabled} onChange={(v) => set("backup_auto_enabled", v)} />
              <Field label={tr("تكرار النسخ", "Backup frequency")}>
                <select value={s.backup_frequency} onChange={(e) => set("backup_frequency", e.target.value)} className={inputCls}>
                  <option value="daily">{tr("يومي", "Daily")}</option>
                  <option value="weekly">{tr("أسبوعي", "Weekly")}</option>
                  <option value="monthly">{tr("شهري", "Monthly")}</option>
                </select>
              </Field>
              <Field label={tr("إيميل لاستلام النسخة الاحتياطية", "Email to receive the backup")}><Input type="email" value={s.backup_email} onChange={(v) => set("backup_email", v)} /></Field>
              {s.backup_last_run_at && (
                <p className="text-[11px] text-muted-foreground">
                  {tr("آخر نسخة: ", "Last backup: ")}{new Date(s.backup_last_run_at).toLocaleString(lang === "ar" ? "ar" : "en")}
                </p>
              )}
              <p className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {tr("💡 قاعدة البيانات يتم نسخها تلقائياً يومياً بواسطة lppme Cloud. يمكنك أيضاً تصدير البيانات يدوياً من صفحات التقارير.", "💡 The database is backed up automatically every day by lppme Cloud. You can also export data manually from the reports pages.")}
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
