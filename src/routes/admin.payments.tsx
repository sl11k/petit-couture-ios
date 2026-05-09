import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { paymentsConfig } from "@/features/admin/configs/phase2.config";

export const Route = createFileRoute("/admin/payments")({
  component: () => <AdminPage config={paymentsConfig} />,
});
