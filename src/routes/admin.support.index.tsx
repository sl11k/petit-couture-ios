import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { supportConfig } from "@/features/admin/configs/phase3.config";

export const Route = createFileRoute("/admin/support/")({
  component: () => <AdminPage config={supportConfig} />,
});
