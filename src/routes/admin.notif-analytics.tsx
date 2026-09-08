import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notifAnalyticsConfig } from "@/features/admin/configs/notif.config";
export const Route = createFileRoute("/admin/notif-analytics")({
  component: () => <AdminPage config={notifAnalyticsConfig} />,
});
