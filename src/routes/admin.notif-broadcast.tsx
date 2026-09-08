import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notifBroadcastConfig } from "@/features/admin/configs/notif.config";
export const Route = createFileRoute("/admin/notif-broadcast")({
  component: () => <AdminPage config={notifBroadcastConfig} />,
});
