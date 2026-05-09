import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { productsConfig } from "@/features/admin/configs/products.config";

export const Route = createFileRoute("/admin/products")({
  component: () => <AdminPage config={productsConfig} />,
});
