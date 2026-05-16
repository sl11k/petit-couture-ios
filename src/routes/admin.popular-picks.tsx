import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { popularPicksConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/popular-picks")({
  component: () => <AdminPage config={popularPicksConfig} />,
});
