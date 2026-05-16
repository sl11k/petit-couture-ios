import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { shippingRatesConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/shipping-rates")({
  component: () => <AdminPage config={shippingRatesConfig} />,
});
