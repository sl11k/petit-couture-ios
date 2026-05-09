import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { errorLogsConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/errors")({
  component: () => <AdminPage config={errorLogsConfig} />,
});
