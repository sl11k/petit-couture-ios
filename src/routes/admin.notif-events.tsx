import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { notifEventTypesConfig } from "@/features/admin/configs/notif.config";
export const Route = createFileRoute("/admin/notif-events")({
  component: () => <AdminPage config={notifEventTypesConfig} />,
});
