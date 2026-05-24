import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { warehousesConfig } from "@/features/admin/configs/warehouses.config";

export const Route = createFileRoute("/admin/warehouses")({
  component: () => <AdminPage config={warehousesConfig} />,
});
