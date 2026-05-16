import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { announcementsConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/announcements")({
  component: () => <AdminPage config={announcementsConfig} />,
});
