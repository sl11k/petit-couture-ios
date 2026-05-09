import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { integrationsConfig } from "@/features/admin/configs/phase3.config";

export const Route = createFileRoute("/admin/integrations")({
  component: () => <AdminPage config={integrationsConfig} />,
});
