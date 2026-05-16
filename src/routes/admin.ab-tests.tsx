import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { abTestsConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/ab-tests")({
  component: () => <AdminPage config={abTestsConfig} />,
});
