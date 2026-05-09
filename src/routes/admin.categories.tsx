import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { categoriesConfig } from "@/features/admin/configs/misc.config";

export const Route = createFileRoute("/admin/categories")({
  component: () => <AdminPage config={categoriesConfig} />,
});
