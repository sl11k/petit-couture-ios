import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Megaphone, Plus, Search, Edit2, Trash2, Play, Pause, X, Save,
  TrendingUp, Mail, Image as ImageIcon, MessageSquare, Tag, Users,
} from "lucide-react";

export const Route = createFileRoute("/admin/campaigns")({ component: CampaignsAdmin });

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  campaign_type: "banner" | "email" | "sms" | "popup";
  status: "draft" | "active" | "paused" | "completed";
  starts_at: string | null;
  ends_at: string | null;
  coupon_code: string | null;
  target_audience: "all" | "vip" | "new" | "inactive";
  banner_image_url: string | null;
  banner_link_url: string | null;
  email_subject: string | null;
  email_body: string | null;
  sent_count: number;
  open_count: number;
  click_count: number;
  conversion_count: number;
  revenue_attributed: number;
  created_at: string;
};

const EMPTY: Omit<Campaign, "id" | "created_at" | "sent_count" | "open_count" | "click_count" | "conversion_count" | "revenue_attributed"> = {
  name: "", description: "", campaign_type: "banner", status: "draft",
  starts_at: null, ends_at: null, coupon_code: null,
  target_audience: "all", banner_image_url: null, banner_link_url: null,
  email_subject: null, email_body: null,
};

const TYPE_ICONS = { banner: ImageIcon, email: Mail, sms: MessageSquare, popup: Megaphone } as const;

function CampaignsAdmin() {
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  const { isSuperAdmin, can } = useUserRole();
  const allowed = isSuperAdmin || can("marketing.manage");

  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Campaign["status"]>("all");
  const [editing, setEditing] = useState<(Campaign | (typeof EMPTY & { id?: string })) | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Campaign[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        return c.name.toLowerCase().includes(s) || (c.coupon_code ?? "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [items, q, statusFilter]);

  const stats = useMemo(() => {
    const active = items.filter((c) => c.status === "active").length;
    const totalRevenue = items.reduce((s, c) => s + Number(c.revenue_attributed || 0), 0);
    const totalConversions = items.reduce((s, c) => s + (c.conversion_count || 0), 0);
    const totalSent = items.reduce((s, c) => s + (c.sent_count || 0), 0);
    return { active, totalRevenue, totalConversions, totalSent };
  }, [items]);

  async function save() {
    if (!editing || !allowed) return;
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      description: editing.description,
      campaign_type: editing.campaign_type,
      status: editing.status,
      starts_at: editing.starts_at,
      ends_at: editing.ends_at,
      coupon_code: editing.coupon_code,
      target_audience: editing.target_audience,
      banner_image_url: editing.banner_image_url,
      banner_link_url: editing.banner_link_url,
      email_subject: editing.email_subject,
      email_body: editing.email_body,
    };
    let error;
    if ("id" in editing && editing.id) {
      ({ error } = await supabase.from("marketing_campaigns").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("marketing_campaigns").insert(payload));
    }
    setSaving(false);
    if (error) { flash(error.message); return; }
    flash(ar ? "تم الحفظ" : "Saved");
    setEditing(null);
    void load();
  }

  async function setStatus(c: Campaign, status: Campaign["status"]) {
    if (!allowed) return;
    await supabase.from("marketing_campaigns").update({ status }).eq("id", c.id);
    void load();
  }

  async function remove(c: Campaign) {
    if (!allowed) return;
    if (!confirm(ar ? `حذف "${c.name}"؟` : `Delete "${c.name}"?`)) return;
    await supabase.from("marketing_campaigns").delete().eq("id", c.id);
    void load();
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={ar ? "حملات نشطة" : "Active campaigns"}
            value={stats.active.toString()}
            icon={Play}
            tone="green"
          />
          <StatCard
            label={ar ? "إيرادات منسوبة" : "Attributed revenue"}
            value={`${stats.totalRevenue.toFixed(0)} SAR`}
            icon={TrendingUp}
            tone="primary"
          />
          <StatCard
            label={ar ? "تحويلات" : "Conversions"}
            value={stats.totalConversions.toString()}
            icon={Tag}
            tone="blue"
          />
          <StatCard
            label={ar ? "إجمالي الإرسال" : "Total sent"}
            value={stats.totalSent.toLocaleString()}
            icon={Users}
          />
        </div>

        {/* Toolbar */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {ar ? "العروض والحملات" : "Campaigns"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {ar
                  ? "إنشاء حملات تسويقية: بانرات، إيميلات، SMS وعروض موسمية مع تتبع الأداء."
                  : "Create marketing campaigns: banners, emails, SMS, and seasonal promos with tracking."}
              </p>
            </div>
            {allowed && (
              <button
                onClick={() => setEditing({ ...EMPTY })}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> {ar ? "حملة جديدة" : "New campaign"}
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className={`pointer-events-none absolute ${isRTL ? "right-2.5" : "left-2.5"} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? "ابحث بالاسم أو الكوبون…" : "Search name or coupon…"}
                className={`w-full rounded-md border border-border bg-background py-2 ${isRTL ? "pr-8 pl-3" : "pl-8 pr-3"} text-sm focus:outline-none focus:ring-1 focus:ring-primary`}
              />
            </div>
            <div className="flex rounded-md border border-border p-0.5">
              {(["all","active","paused","draft","completed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f as any)}
                  className={`px-3 py-1 text-xs rounded ${statusFilter===f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {ar
                    ? f==="all" ? "الكل" : f==="active" ? "نشط" : f==="paused" ? "متوقف" : f==="draft" ? "مسودة" : "منتهي"
                    : f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {ar ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{ar ? "لا توجد حملات." : "No campaigns yet."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((c) => {
              const Icon = TYPE_ICONS[c.campaign_type] ?? Megaphone;
              const ctr = c.sent_count > 0 ? ((c.click_count / c.sent_count) * 100).toFixed(1) : "0";
              const cvr = c.click_count > 0 ? ((c.conversion_count / c.click_count) * 100).toFixed(1) : "0";
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-foreground">{c.name}</h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge status={c.status} ar={ar} />
                          {c.coupon_code && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                              {c.coupon_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {allowed && (
                      <div className="flex shrink-0 gap-1">
                        {c.status === "active" ? (
                          <button onClick={() => setStatus(c, "paused")} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title={ar ? "إيقاف" : "Pause"}>
                            <Pause className="h-3.5 w-3.5" />
                          </button>
                        ) : c.status === "paused" || c.status === "draft" ? (
                          <button onClick={() => setStatus(c, "active")} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title={ar ? "تفعيل" : "Activate"}>
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <button onClick={() => setEditing(c)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title={ar ? "تعديل" : "Edit"}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(c)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title={ar ? "حذف" : "Delete"}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {c.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  )}

                  {/* Metrics */}
                  <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                    <Metric label={ar ? "إرسال" : "Sent"} value={c.sent_count.toLocaleString()} />
                    <Metric label={ar ? "نقرات" : "Clicks"} value={c.click_count.toLocaleString()} />
                    <Metric label="CTR" value={`${ctr}%`} />
                    <Metric label="CVR" value={`${cvr}%`} />
                  </div>

                  {(c.starts_at || c.ends_at) && (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {c.starts_at && new Date(c.starts_at).toLocaleDateString(ar ? "ar" : "en")}
                      {" — "}
                      {c.ends_at ? new Date(c.ends_at).toLocaleDateString(ar ? "ar" : "en") : (ar ? "مفتوح" : "Open")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex" dir={isRTL ? "rtl" : "ltr"}>
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setEditing(null)} />
          <div className={`relative ml-auto h-full w-full max-w-2xl overflow-y-auto bg-card shadow-2xl ${isRTL ? "mr-auto ml-0" : ""}`}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
              <h3 className="text-base font-semibold">
                {"id" in editing && editing.id ? (ar ? "تعديل حملة" : "Edit campaign") : (ar ? "حملة جديدة" : "New campaign")}
              </h3>
              <button onClick={() => !saving && setEditing(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <Field label={ar ? "اسم الحملة" : "Campaign name"}>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label={ar ? "الوصف" : "Description"}>
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label={ar ? "النوع" : "Type"}>
                  <select
                    value={editing.campaign_type}
                    onChange={(e) => setEditing({ ...editing, campaign_type: e.target.value as any })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="banner">{ar ? "بانر" : "Banner"}</option>
                    <option value="email">{ar ? "بريد إلكتروني" : "Email"}</option>
                    <option value="sms">SMS</option>
                    <option value="popup">{ar ? "نافذة منبثقة" : "Popup"}</option>
                  </select>
                </Field>
                <Field label={ar ? "الجمهور" : "Audience"}>
                  <select
                    value={editing.target_audience}
                    onChange={(e) => setEditing({ ...editing, target_audience: e.target.value as any })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">{ar ? "كل العملاء" : "All customers"}</option>
                    <option value="vip">{ar ? "كبار العملاء" : "VIP"}</option>
                    <option value="new">{ar ? "عملاء جدد" : "New"}</option>
                    <option value="inactive">{ar ? "غير نشطين" : "Inactive"}</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label={ar ? "الحالة" : "Status"}>
                  <select
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="draft">{ar ? "مسودة" : "Draft"}</option>
                    <option value="active">{ar ? "نشط" : "Active"}</option>
                    <option value="paused">{ar ? "متوقف" : "Paused"}</option>
                    <option value="completed">{ar ? "منتهي" : "Completed"}</option>
                  </select>
                </Field>
                <Field label={ar ? "البداية" : "Starts"}>
                  <input
                    type="datetime-local"
                    value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""}
                    onChange={(e) => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label={ar ? "النهاية" : "Ends"}>
                  <input
                    type="datetime-local"
                    value={editing.ends_at ? editing.ends_at.slice(0, 16) : ""}
                    onChange={(e) => setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label={ar ? "كود الكوبون (اختياري)" : "Coupon code (optional)"}>
                <input
                  value={editing.coupon_code ?? ""}
                  onChange={(e) => setEditing({ ...editing, coupon_code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER20"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </Field>

              {(editing.campaign_type === "banner" || editing.campaign_type === "popup") && (
                <>
                  <Field label={ar ? "رابط الصورة" : "Banner image URL"}>
                    <input
                      value={editing.banner_image_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, banner_image_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label={ar ? "رابط النقر" : "Click URL"}>
                    <input
                      value={editing.banner_link_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, banner_link_url: e.target.value })}
                      placeholder="/category/new-arrivals"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Field>
                </>
              )}

              {(editing.campaign_type === "email" || editing.campaign_type === "sms") && (
                <>
                  {editing.campaign_type === "email" && (
                    <Field label={ar ? "موضوع الإيميل" : "Email subject"}>
                      <input
                        value={editing.email_subject ?? ""}
                        onChange={(e) => setEditing({ ...editing, email_subject: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </Field>
                  )}
                  <Field label={ar ? "النص" : "Body"}>
                    <textarea
                      value={editing.email_body ?? ""}
                      onChange={(e) => setEditing({ ...editing, email_body: e.target.value })}
                      rows={5}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Field>
                </>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
              <button onClick={() => !saving && setEditing(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={save}
                disabled={saving || !editing.name}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? (ar ? "جاري الحفظ…" : "Saving…") : (ar ? "حفظ" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </AdminShell>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "green" | "primary" | "blue" }) {
  const toneCls = tone === "green" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300"
    : tone === "blue" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
    : tone === "primary" ? "bg-primary/10 text-primary"
    : "bg-muted text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${toneCls}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] text-muted-foreground">{label}</div>
          <div className="text-base font-semibold text-foreground">{value}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, ar }: { status: Campaign["status"]; ar: boolean }) {
  const map = {
    draft: { cls: "bg-muted text-muted-foreground", labelAr: "مسودة", labelEn: "Draft" },
    active: { cls: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300", labelAr: "نشط", labelEn: "Active" },
    paused: { cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", labelAr: "متوقف", labelEn: "Paused" },
    completed: { cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", labelAr: "منتهي", labelEn: "Completed" },
  };
  const m = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${m.cls}`}>{ar ? m.labelAr : m.labelEn}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
