import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { loyaltyAccountsConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/loyalty")({
  component: () => <AdminPage config={loyaltyAccountsConfig} />,
});
