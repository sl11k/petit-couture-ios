import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { couponsConfig } from "@/features/admin/configs/phase2.config";

export const Route = createFileRoute("/admin/coupons/")({
  component: () => <AdminPage config={couponsConfig} />,
});
