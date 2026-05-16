import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { shippingCarriersConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/shipping-carriers")({
  component: () => <AdminPage config={shippingCarriersConfig} />,
});
