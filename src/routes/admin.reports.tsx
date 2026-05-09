import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { reportsConfig } from "@/features/admin/configs/phase2.config";

export const Route = createFileRoute("/admin/reports")({
  component: () => <AdminPage config={reportsConfig} />,
});
