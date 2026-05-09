import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { searchLogsConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/search")({
  component: () => <AdminPage config={searchLogsConfig} />,
});
