import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { invoicesConfig } from "@/features/admin/configs/phase2.config";

export const Route = createFileRoute("/admin/invoices")({
  component: () => <AdminPage config={invoicesConfig} />,
});
