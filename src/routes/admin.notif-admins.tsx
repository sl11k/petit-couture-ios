import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notifAdminRecipientsConfig } from "@/features/admin/configs/notif.config";
export const Route = createFileRoute("/admin/notif-admins")({
  component: () => <AdminPage config={notifAdminRecipientsConfig} />,
});
