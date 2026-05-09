import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2, User } from "lucide-react";
import { StatusBadge } from "@/features/admin/components/StatusBadge";

export const Route = createFileRoute("/admin/audit/$id")({
  component: AuditDetailPage,
});

const ENTITY_ROUTE: Record<string, string> = {
  orders: "/admin/orders",
  order: "/admin/orders",
  products: "/admin/products",
  product: "/admin/products",
  profiles: "/admin/customers",
  customer: "/admin/customers",
  user: "/admin/users",
  user_roles: "/admin/users",
  integrations: "/admin/integrations",
  integration: "/admin/integrations",
  coupons: "/admin/coupons",
  coupon: "/admin/coupons",
  marketing_campaigns: "/admin/campaigns",
  campaign: "/admin/campaigns",
  landing_pages: "/admin/landing-pages",
  webhook_endpoints: "/admin/webhooks",
  support_tickets: "/admin/support",
  site_settings: "/admin/settings",
  settings: "/admin/settings",
};

function entityHref(entity?: string | null, id?: string | null): string | null {
  if (!entity) return null;
  const base = ENTITY_ROUTE[entity];
  if (!base) return null;
  return id ? `${base}/${id}` : base;
}

function AuditDetailPage() {
  const { id } = useParams({ from: "/admin/audit/$id" });
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const Arrow = ar ? ArrowRight : ArrowLeft;

  useEffect(() => {
    supabase
      .from("audit_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setRow(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!row) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {ar ? "العنصر غير موجود" : "Item not found"}
        </p>
        <Link to="/admin/audit" className="mt-3 inline-block text-sm text-primary underline">
          {ar ? "العودة لسجل العمليات" : "Back to Audit Log"}
        </Link>
      </div>
    );
  }

  const eHref = entityHref(row.entity, row.entity_id);
  const changed = (row.metadata?.changed_fields ?? null) as Record<
    string,
    { old: any; new: any }
  > | null;
  const fmt = (v: any) =>
    v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

  return (
    <div>
      <Link
        to="/admin/audit"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Arrow className="h-3 w-3" /> {ar ? "سجل العمليات" : "Audit Log"}
      </Link>

      <PageHeader
        title={{ ar: row.action, en: row.action }}
        description={{
          ar: new Date(row.created_at).toLocaleString("ar"),
          en: new Date(row.created_at).toLocaleString("en"),
        }}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Summary */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">
              {ar ? "ملخص الحدث" : "Event summary"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={ar ? "الإجراء" : "Action"}>
                <StatusBadge value={row.action} />
              </Field>
              <Field label={ar ? "الوقت" : "Time"}>
                {new Date(row.created_at).toLocaleString(ar ? "ar" : "en")}
              </Field>
              <Field label={ar ? "الكيان" : "Entity"}>
                {row.entity ? (
                  eHref ? (
                    <a
                      href={eHref}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {row.entity}
                      {row.entity_id && (
                        <span className="font-mono text-xs">
                          • {String(row.entity_id).slice(0, 8)}…
                        </span>
                      )}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>
                      {row.entity}
                      {row.entity_id && ` • ${row.entity_id}`}
                    </span>
                  )
                ) : (
                  "—"
                )}
              </Field>
              <Field label="IP">
                <span className="font-mono text-xs">{row.ip_address ?? "—"}</span>
              </Field>
              {row.user_agent && (
                <Field label={ar ? "المتصفح" : "User agent"} span={2}>
                  <span className="break-all text-xs text-muted-foreground">
                    {row.user_agent}
                  </span>
                </Field>
              )}
            </div>
          </section>

          {/* Diff */}
          {changed && Object.keys(changed).length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {ar ? "الحقول المعدّلة" : "Changed fields"}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className={`p-2 ${ar ? "text-right" : "text-left"}`}>
                        {ar ? "الحقل" : "Field"}
                      </th>
                      <th className={`p-2 ${ar ? "text-right" : "text-left"}`}>
                        {ar ? "القيمة السابقة" : "Old"}
                      </th>
                      <th className={`p-2 ${ar ? "text-right" : "text-left"}`}>
                        {ar ? "القيمة الجديدة" : "New"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(changed).map(([k, v]) => (
                      <tr key={k} className="border-b border-border/50 last:border-0">
                        <td className="p-2 font-mono">{k}</td>
                        <td className="p-2 text-destructive">
                          <code className="break-all">{fmt(v.old)}</code>
                        </td>
                        <td className="p-2 text-emerald-600 dark:text-emerald-400">
                          <code className="break-all">{fmt(v.new)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Raw payloads */}
          {(row.old_data || row.new_data) && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {ar ? "البيانات الكاملة" : "Full payloads"}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {row.old_data && (
                  <div>
                    <div className="mb-1 text-[11px] uppercase text-muted-foreground">
                      {ar ? "قبل" : "Before"}
                    </div>
                    <pre className="max-h-80 overflow-auto rounded-md bg-muted/30 p-2 text-[11px] font-mono">
                      {JSON.stringify(row.old_data, null, 2)}
                    </pre>
                  </div>
                )}
                {row.new_data && (
                  <div>
                    <div className="mb-1 text-[11px] uppercase text-muted-foreground">
                      {ar ? "بعد" : "After"}
                    </div>
                    <pre className="max-h-80 overflow-auto rounded-md bg-muted/30 p-2 text-[11px] font-mono">
                      {JSON.stringify(row.new_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: Actor */}
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <User className="h-4 w-4" /> {ar ? "المستخدم" : "Actor"}
            </h3>
            {row.actor_email || row.actor_id ? (
              <div className="space-y-2 text-xs">
                <Field label={ar ? "البريد" : "Email"}>
                  {row.actor_email ?? "—"}
                </Field>
                <Field label={ar ? "المعرف" : "User ID"}>
                  <span className="break-all font-mono text-[11px]">
                    {row.actor_id ?? "—"}
                  </span>
                </Field>
                {row.actor_id && (
                  <Link
                    to="/admin/customers/$id"
                    params={{ id: row.actor_id }}
                    className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {ar ? "عرض ملف المستخدم" : "Open user profile"}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {ar ? "حدث من النظام" : "System event"}
              </p>
            )}
          </section>

          {row.actor_id && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {ar ? "نشاط هذا المستخدم" : "More by this actor"}
              </h3>
              <ActorRecent actorId={row.actor_id} excludeId={row.id} ar={ar} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

function ActorRecent({
  actorId,
  excludeId,
  ar,
}: {
  actorId: string;
  excludeId: string;
  ar: boolean;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    supabase
      .from("audit_logs")
      .select("id,action,entity,entity_id,created_at")
      .eq("actor_id", actorId)
      .neq("id", excludeId)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setRows(data ?? []));
  }, [actorId, excludeId]);

  if (rows === null) {
    return (
      <div className="flex justify-center py-3 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {ar ? "لا توجد أحداث أخرى" : "No other events"}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const href = entityHref(r.entity, r.entity_id);
        return (
          <Link
            key={r.id}
            to="/admin/audit/$id"
            params={{ id: r.id }}
            className="block rounded-md border border-border bg-background p-2 text-xs hover:bg-muted/30"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{r.action}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString(ar ? "ar" : "en")}
              </span>
            </div>
            {r.entity && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {r.entity}
                {r.entity_id ? ` • ${String(r.entity_id).slice(0, 8)}…` : ""}
                {href && " ↗"}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
