import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notifDeliveryLogsConfig } from "@/features/admin/configs/notif.config";
export const Route = createFileRoute("/admin/notif-logs")({
  component: () => <AdminPage config={notifDeliveryLogsConfig} />,
});
