import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notificationTemplatesConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/notification-templates")({
  component: () => <AdminPage config={notificationTemplatesConfig} />,
});
