import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { seasonPicksConfig } from "@/features/admin/configs/nav.config";

export const Route = createFileRoute("/admin/season-picks")({
  component: () => <AdminPage config={seasonPicksConfig} />,
});

