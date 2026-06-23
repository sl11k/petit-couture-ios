import { createFileRoute, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { webhookDetailConfig } from "@/features/admin/configs/detail.configs";

export const Route = createFileRoute("/admin/webhooks/$id")({
  component: WebhookDetailRoute,
});

function WebhookDetailRoute() {
  const { id } = useParams({ from: "/admin/webhooks/$id" });
  return <DetailPage config={webhookDetailConfig} id={id} />;
}
