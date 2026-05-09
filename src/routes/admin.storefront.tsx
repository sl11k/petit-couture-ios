import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { storefrontConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/storefront")({
  component: () => <AdminPage config={storefrontConfig} />,
});
