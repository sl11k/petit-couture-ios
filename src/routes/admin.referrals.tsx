import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { referralsConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/referrals")({
  component: () => <AdminPage config={referralsConfig} />,
});
