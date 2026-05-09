import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { helpConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/help")({
  component: () => <AdminPage config={helpConfig} />,
});
