import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notifQueueConfig } from "@/features/admin/configs/notif.config";
export const Route = createFileRoute("/admin/notif-queue")({
  component: () => <AdminPage config={notifQueueConfig} />,
});
