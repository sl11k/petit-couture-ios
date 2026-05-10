import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  registerOtoWebhookServer,
  listRegistrationsServer,
  listOtoDeliveriesServer,
  readSecretsStatus,
  sendLocalOtoTestServer,
  assertAdminUser,
} from "@/lib/oto-webhook.server";

const TYPE = z.enum(["orderStatus", "shipmentError", "newOrders"]);

export const otoSecretsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await assertAdminUser(userId);
    return readSecretsStatus();
  });

export const otoRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        webhookType: TYPE,
        endpointUrl: z.string().url().max(500),
        orderPrefix: z.string().max(50).optional(),
        timestampFormat: z.string().max(50).optional(),
        useSecret: z.boolean().optional(),
        useAuth: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdminUser(userId);
    return registerOtoWebhookServer({ ...data, userId });
  });

export const otoListRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await assertAdminUser(userId);
    return { items: await listRegistrationsServer() };
  });

export const otoListDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdminUser(userId);
    return { items: await listOtoDeliveriesServer(data.limit ?? 50) };
  });

export const otoSendLocalTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["orderStatus", "shipmentError"]),
        endpointUrl: z.string().url().max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdminUser(userId);
    return sendLocalOtoTestServer(data);
  });
