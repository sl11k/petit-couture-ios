import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { incompleteConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/incomplete")({
  component: () => <AdminPage config={incompleteConfig} />,
});
