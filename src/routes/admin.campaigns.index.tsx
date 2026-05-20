import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { CampaignsAnalytics } from "@/features/admin/components/CampaignsAnalytics";
import { campaignsConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/campaigns/")({
  component: () => (
    <div>
      <CampaignsAnalytics />
      <AdminPage config={campaignsConfig} />
    </div>
  ),
});
