import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getIncomingWebhookSecretServer,
  sendTestIncomingWebhookServer,
} from "@/lib/incoming-webhooks.server";

const KIND = z.enum(["shipping", "payment"]);

export const sendTestIncomingWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: KIND,
        payload: z.record(z.any()).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    return sendTestIncomingWebhookServer({
      kind: data.kind,
      payload: data.payload,
      userId,
    });
  });

export const revealIncomingWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: KIND,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    return getIncomingWebhookSecretServer({
      kind: data.kind,
      userId,
      claimedEmail: claims?.email,
    });
  });
