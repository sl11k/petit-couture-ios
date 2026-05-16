import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { featuredCategoriesConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/featured-categories")({
  component: () => <AdminPage config={featuredCategoriesConfig} />,
});
