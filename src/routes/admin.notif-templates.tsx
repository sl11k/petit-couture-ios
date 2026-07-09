import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notifTemplatesConfig } from "@/features/admin/configs/notif.config";
export const Route = createFileRoute("/admin/notif-templates")({
  component: () => <AdminPage config={notifTemplatesConfig} />,
});
