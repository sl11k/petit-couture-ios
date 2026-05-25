import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { headerNavConfig } from "@/features/admin/configs/nav.config";

export const Route = createFileRoute("/admin/header-nav")({
  component: () => <AdminPage config={headerNavConfig} />,
});

