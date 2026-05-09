import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notificationsConfig } from "@/features/admin/configs/phase3.config";

export const Route = createFileRoute("/admin/notifications")({
  component: () => <AdminPage config={notificationsConfig} />,
});
