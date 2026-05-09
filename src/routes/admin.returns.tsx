import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { returnsConfig } from "@/features/admin/configs/phase2.config";

export const Route = createFileRoute("/admin/returns")({
  component: () => <AdminPage config={returnsConfig} />,
});
