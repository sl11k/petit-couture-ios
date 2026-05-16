import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { shippingZonesConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/shipping-zones")({
  component: () => <AdminPage config={shippingZonesConfig} />,
});
