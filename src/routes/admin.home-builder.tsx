import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { homeBuilderConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/home-builder")({
  component: () => <AdminPage config={homeBuilderConfig} />,
});
