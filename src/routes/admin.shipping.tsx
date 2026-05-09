import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { shippingConfig } from "@/features/admin/configs/phase2.config";

export const Route = createFileRoute("/admin/shipping")({
  component: () => <AdminPage config={shippingConfig} />,
});
