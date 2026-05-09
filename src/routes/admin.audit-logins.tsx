import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { auditLoginsConfig } from "@/features/admin/configs/phase3.config";

export const Route = createFileRoute("/admin/audit-logins")({
  component: () => <AdminPage config={auditLoginsConfig} />,
});
