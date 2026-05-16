import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { siteThemesConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/themes")({
  component: () => <AdminPage config={siteThemesConfig} />,
});
