import { createFileRoute, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { integrationDetailConfig } from "@/features/admin/configs/detail.configs";

export const Route = createFileRoute("/admin/integrations/$id")({
  component: IntegrationDetailRoute,
});

function IntegrationDetailRoute() {
  const { id } = useParams({ from: "/admin/integrations/$id" });
  return <DetailPage config={integrationDetailConfig} id={id} />;
}
