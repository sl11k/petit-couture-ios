import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notificationRulesConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/notification-rules")({
  component: () => <AdminPage config={notificationRulesConfig} />,
});
