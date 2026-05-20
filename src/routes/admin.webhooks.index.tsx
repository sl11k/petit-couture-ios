import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { webhooksConfig } from "@/features/admin/configs/phase3.config";

export const Route = createFileRoute("/admin/webhooks/")({
  component: () => <AdminPage config={webhooksConfig} />,
});
