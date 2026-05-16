import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { bundlesConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/bundles")({
  component: () => <AdminPage config={bundlesConfig} />,
});
