import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { loyaltyTransactionsConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/loyalty-transactions")({
  component: () => <AdminPage config={loyaltyTransactionsConfig} />,
});
