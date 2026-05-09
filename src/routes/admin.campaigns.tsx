import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { campaignsConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/campaigns")({
  component: () => <AdminPage config={campaignsConfig} />,
});
