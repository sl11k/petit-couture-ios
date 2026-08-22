import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const Input = z.object({
  event_name: z.string().min(1).max(64),
  event_id: z.string().min(1).max(120),
  event_source_url: z.string().max(500).nullable().optional(),
  value: z.number().nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  content_name: z.string().max(200).nullable().optional(),
  content_type: z.string().max(40).nullable().optional(),
  order_id: z.string().max(120).nullable().optional(),
  search_string: z.string().max(200).nullable().optional(),
  num_items: z.number().nullable().optional(),
  contents: z
    .array(z.object({ id: z.string().max(120), quantity: z.number(), price: z.number().optional() }))
    .max(100)
    .optional(),
  user: z
    .object({
      email: z.string().max(255).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
      external_id: z.string().max(120).nullable().optional(),
      fbp: z.string().max(200).nullable().optional(),
      fbc: z.string().max(300).nullable().optional(),
      city: z.string().max(120).nullable().optional(),
      country: z.string().max(60).nullable().optional(),
    })
    .optional(),
});

/**
 * Mirrors a storefront pixel event to the Meta Conversions API.
 * Fire-and-forget: returns { ok:false, skipped } when Meta is not configured.
 */
export const trackMetaConversion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const token = process.env["META_CAPI_ACCESS_TOKEN"];
    if (!token) return { ok: false, skipped: "no_token" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendMetaCapiEvents } = await import("@/lib/meta-capi.server");

    let pixelId = process.env["META_PIXEL_ID"] || "";
    if (!pixelId) {
      const { data: row } = await supabaseAdmin
        .from("tracking_pixels")
        .select("pixel_id")
        .in("provider", ["meta", "instagram"])
        .eq("enabled", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      pixelId = (row?.pixel_id ?? "").trim();
    }
    if (!pixelId) return { ok: false, skipped: "no_pixel_id" as const };

    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const req = getRequest();
      ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        null;
      ua = req.headers.get("user-agent");
    } catch {
      /* no request context */
    }

    const res = await sendMetaCapiEvents(
      pixelId,
      token,
      [
        {
          event_name: data.event_name,
          event_id: data.event_id,
          event_source_url: data.event_source_url ?? null,
          value: data.value ?? null,
          currency: data.currency ?? null,
          content_name: data.content_name ?? null,
          content_type: data.content_type ?? null,
          order_id: data.order_id ?? null,
          search_string: data.search_string ?? null,
          num_items: data.num_items ?? null,
          contents: data.contents,
        },
      ],
      {
        ...(data.user ?? {}),
        client_ip_address: ip,
        client_user_agent: ua,
      },
      process.env["META_TEST_EVENT_CODE"] || null,
    );
    if (!res.ok) console.error("[meta-capi]", res.error);
    return res;
  });
