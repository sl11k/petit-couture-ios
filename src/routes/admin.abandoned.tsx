import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { abandonedConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/abandoned")({
  component: () => <AdminPage config={abandonedConfig} />,
});
