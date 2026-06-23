import { createFileRoute, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { campaignDetailConfig } from "@/features/admin/configs/detail.configs";

export const Route = createFileRoute("/admin/campaigns/$id")({
  component: CampaignDetailRoute,
});

function CampaignDetailRoute() {
  const { id } = useParams({ from: "/admin/campaigns/$id" });
  return <DetailPage config={campaignDetailConfig} id={id} />;
}
