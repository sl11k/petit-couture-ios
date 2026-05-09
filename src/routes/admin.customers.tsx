import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { customersConfig } from "@/features/admin/configs/misc.config";

export const Route = createFileRoute("/admin/customers")({
  component: () => <AdminPage config={customersConfig} />,
});
