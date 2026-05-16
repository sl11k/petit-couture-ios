import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { productRelationsConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/product-relations")({
  component: () => <AdminPage config={productRelationsConfig} />,
});
