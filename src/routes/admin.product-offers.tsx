import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { productOffersConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/product-offers")({
  component: () => <AdminPage config={productOffersConfig} />,
});
