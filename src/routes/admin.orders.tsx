import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { ordersConfig } from "@/features/admin/configs/orders.config";

export const Route = createFileRoute("/admin/orders")({
  component: () => <AdminPage config={ordersConfig} />,
});
