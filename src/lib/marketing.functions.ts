import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

const filtersSchema = z.object({
  minOrders: z.number().int().min(0).max(1000).optional(),
  minSpent: z.number().min(0).max(10_000_000).optional(),
  lastOrderWithinDays: z.number().int().min(1).max(3650).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  onlyBuyers: z.boolean().optional(),
  limit: z.number().int().min(1).max(20000).optional(),
});

export type AudienceFilters = z.infer<typeof filtersSchema>;

async function assertMarketingAccess(context: any) {
  const roles = ["super_admin", "admin", "marketing_manager"] as const;
  for (const role of roles) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data === true) return role;
  }
  throw new Error("FORBIDDEN");
}

/** Build the consented-customer list (never bypasses consent or suppression). */
async function buildAudience(filters: AudienceFilters) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = filters.limit ?? 5000;

  // 1) Explicit marketing-email consent only
  const { data: consents, error: cErr } = await supabaseAdmin
    .from("customer_consents")
    .select("user_id, marketing_email, source, updated_at")
    .eq("marketing_email", true)
    .limit(20000);
  if (cErr) throw new Error(cErr.message);

  const consentMap = new Map<string, { source: string | null; at: string | null }>();
  for (const c of consents ?? []) {
    consentMap.set(c.user_id as string, {
      source: (c as any).source ?? null,
      at: (c as any).updated_at ?? null,
    });
  }
  if (consentMap.size === 0) return { members: [], skipped: { suppressed: 0, noEmail: 0 } };

  // 2) Profile contact info
  const ids = [...consentMap.keys()];
  const profiles: any[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, full_name, phone, city")
      .in("user_id", ids.slice(i, i + 500));
    if (error) throw new Error(error.message);
    profiles.push(...(data ?? []));
  }

  // 3) Suppression list (bounces / complaints / unsubscribes)
  const { data: suppressed } = await supabaseAdmin.from("suppressed_emails").select("email").limit(20000);
  const blocked = new Set((suppressed ?? []).map((s: any) => String(s.email).toLowerCase()));

  // 4) Paid order stats per customer
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("customer_email, user_id, total, created_at, payment_status")
    .eq("payment_status", "paid")
    .limit(20000);

  type Stat = { count: number; spent: number; last: string | null };
  const stats = new Map<string, Stat>();
  for (const o of orders ?? []) {
    const key = String((o as any).customer_email ?? "").toLowerCase();
    if (!key) continue;
    const prev = stats.get(key) ?? { count: 0, spent: 0, last: null };
    prev.count += 1;
    prev.spent += Number((o as any).total ?? 0);
    const created = (o as any).created_at as string;
    if (!prev.last || created > prev.last) prev.last = created;
    stats.set(key, prev);
  }

  const cutoff = filters.lastOrderWithinDays
    ? new Date(Date.now() - filters.lastOrderWithinDays * 86400000).toISOString()
    : null;

  let suppressedCount = 0;
  let noEmail = 0;
  const members: any[] = [];

  for (const p of profiles) {
    const email = String(p.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) { noEmail += 1; continue; }
    if (blocked.has(email)) { suppressedCount += 1; continue; }
    if (filters.city && String(p.city ?? "").trim() !== filters.city.trim()) continue;

    const st = stats.get(email) ?? { count: 0, spent: 0, last: null };
    if (filters.onlyBuyers && st.count === 0) continue;
    if (filters.minOrders && st.count < filters.minOrders) continue;
    if (filters.minSpent && st.spent < filters.minSpent) continue;
    if (cutoff && (!st.last || st.last < cutoff)) continue;

    const consent = consentMap.get(p.user_id);
    members.push({
      user_id: p.user_id,
      email,
      full_name: p.full_name ?? null,
      phone: p.phone ?? null,
      consent_source: consent?.source ?? "account_settings",
      consent_at: consent?.at ?? null,
      orders_count: st.count,
      total_spent: Number(st.spent.toFixed(2)),
      last_order_at: st.last,
    });
    if (members.length >= limit) break;
  }

  return { members, skipped: { suppressed: suppressedCount, noEmail } };
}

/** Preview how many consented customers match the filters. */
export const previewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filtersSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertMarketingAccess(context);
    const { members, skipped } = await buildAudience(data);
    return {
      total: members.length,
      skipped,
      sample: members.slice(0, 10).map((m) => ({
        email: m.email,
        full_name: m.full_name,
        orders_count: m.orders_count,
        total_spent: m.total_spent,
      })),
    };
  });

/** Persist a generated list snapshot. */
export const generateAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid.optional(),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(500).nullable().optional(),
      filters: filtersSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMarketingAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { members } = await buildAudience(data.filters);

    let audienceId = data.id;
    if (audienceId) {
      const { error } = await supabaseAdmin
        .from("campaign_audiences")
        .update({
          name: data.name,
          description: data.description ?? null,
          filters: data.filters as any,
          member_count: members.length,
          last_generated_at: new Date().toISOString(),
        })
        .eq("id", audienceId);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("campaign_audience_members").delete().eq("audience_id", audienceId);
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("campaign_audiences")
        .insert({
          name: data.name,
          description: data.description ?? null,
          filters: data.filters as any,
          member_count: members.length,
          last_generated_at: new Date().toISOString(),
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      audienceId = row!.id as string;
    }

    for (let i = 0; i < members.length; i += 500) {
      const chunk = members.slice(i, i + 500).map((m) => ({ ...m, audience_id: audienceId }));
      const { error } = await supabaseAdmin.from("campaign_audience_members").insert(chunk as any);
      if (error) throw new Error(error.message);
    }

    return { id: audienceId, count: members.length };
  });

// ---------------------------------------------------------------- Brevo

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

function brevoHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.BREVO_API_KEY;
  if (!lovableKey || !connectionKey) throw new Error("BREVO_NOT_CONNECTED");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
  };
}

async function brevo(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers: brevoHeaders() });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Brevo request failed [${res.status}] ${path}: ${text}`);
    throw new Error(`Brevo [${res.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Is the marketing provider connected? */
export const marketingProviderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMarketingAccess(context);
    if (!process.env.LOVABLE_API_KEY || !process.env.BREVO_API_KEY) {
      return { connected: false as const, provider: "brevo" as const };
    }
    try {
      const account = await brevo("/account");
      return {
        connected: true as const,
        provider: "brevo" as const,
        email: account?.email ?? null,
        company: account?.companyName ?? null,
      };
    } catch (e) {
      return { connected: false as const, provider: "brevo" as const, error: (e as Error).message };
    }
  });

/** Push a generated list to Brevo as a contact list. */
export const syncAudienceToProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ audienceId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMarketingAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: audience, error } = await supabaseAdmin
      .from("campaign_audiences")
      .select("id, name, provider_list_id")
      .eq("id", data.audienceId)
      .single();
    if (error || !audience) throw new Error(error?.message || "Audience not found");

    const { data: members } = await supabaseAdmin
      .from("campaign_audience_members")
      .select("email, full_name, phone")
      .eq("audience_id", data.audienceId)
      .limit(20000);
    if (!members?.length) throw new Error("EMPTY_AUDIENCE");

    let listId = audience.provider_list_id ? Number(audience.provider_list_id) : null;
    if (!listId) {
      const folders = await brevo("/contacts/folders?limit=10&offset=0");
      let folderId = folders?.folders?.[0]?.id;
      if (!folderId) {
        const folder = await brevo("/contacts/folders", {
          method: "POST",
          body: JSON.stringify({ name: "Lovable" }),
        });
        folderId = folder?.id;
      }
      const list = await brevo("/contacts/lists", {
        method: "POST",
        body: JSON.stringify({ name: `${audience.name} — ${audience.id.slice(0, 8)}`, folderId }),
      });
      listId = list?.id;
    }

    await brevo("/contacts/import", {
      method: "POST",
      body: JSON.stringify({
        listIds: [listId],
        updateExistingContacts: true,
        emailBlacklist: false,
        smsBlacklist: false,
        jsonBody: members.map((m: any) => ({
          email: m.email,
          attributes: {
            FIRSTNAME: (m.full_name ?? "").split(" ")[0] || undefined,
            LASTNAME: (m.full_name ?? "").split(" ").slice(1).join(" ") || undefined,
            SMS: m.phone || undefined,
          },
        })),
      }),
    });

    await supabaseAdmin
      .from("campaign_audiences")
      .update({ provider: "brevo", provider_list_id: String(listId), synced_at: new Date().toISOString() })
      .eq("id", data.audienceId);

    return { listId, count: members.length };
  });

/** Approve / reject a campaign request. */
export const reviewCampaignRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid,
      decision: z.enum(["approved", "rejected"]),
      reason: z.string().trim().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await assertMarketingAccess(context);
    if (role === "marketing_manager") throw new Error("FORBIDDEN");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("campaign_requests")
      .update({
        status: data.decision,
        rejection_reason: data.decision === "rejected" ? data.reason ?? null : null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .in("status", ["draft", "pending_review", "approved", "rejected"]);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Send an approved campaign through Brevo to the synced, consented list. */
export const sendCampaignRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid,
      senderName: z.string().trim().min(2).max(70),
      senderEmail: z.string().trim().email().max(190),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await assertMarketingAccess(context);
    if (role === "marketing_manager") throw new Error("FORBIDDEN");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error } = await supabaseAdmin
      .from("campaign_requests")
      .select("id, title, status, email_subject, email_body, audience_id, scheduled_at, sent_at")
      .eq("id", data.id)
      .single();
    if (error || !req) throw new Error(error?.message || "Request not found");
    if (req.status !== "approved") throw new Error("NOT_APPROVED");
    if (req.sent_at) throw new Error("ALREADY_SENT");
    if (!req.audience_id) throw new Error("NO_AUDIENCE");
    if (!req.email_subject || !req.email_body) throw new Error("MISSING_CONTENT");

    const { data: audience } = await supabaseAdmin
      .from("campaign_audiences")
      .select("id, provider_list_id, member_count")
      .eq("id", req.audience_id)
      .single();
    if (!audience?.provider_list_id) throw new Error("AUDIENCE_NOT_SYNCED");

    const scheduled = req.scheduled_at && new Date(req.scheduled_at).getTime() > Date.now()
      ? new Date(req.scheduled_at).toISOString()
      : null;

    const campaign = await brevo("/emailCampaigns", {
      method: "POST",
      body: JSON.stringify({
        name: `${req.title} — ${req.id.slice(0, 8)}`,
        subject: req.email_subject,
        sender: { name: data.senderName, email: data.senderEmail },
        htmlContent: req.email_body,
        recipients: { listIds: [Number(audience.provider_list_id)] },
        ...(scheduled ? { scheduledAt: scheduled } : {}),
      }),
    });

    if (!scheduled) {
      await brevo(`/emailCampaigns/${campaign.id}/sendNow`, { method: "POST" });
    }

    await supabaseAdmin
      .from("campaign_requests")
      .update({
        status: scheduled ? "scheduled" : "sent",
        provider: "brevo",
        provider_campaign_id: String(campaign.id),
        sent_at: scheduled ? null : new Date().toISOString(),
        sent_count: audience.member_count ?? 0,
      })
      .eq("id", req.id);

    return { ok: true as const, campaignId: campaign.id, scheduled: Boolean(scheduled) };
  });
