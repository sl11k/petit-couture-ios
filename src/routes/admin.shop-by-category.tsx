import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { shopByCategoryConfig } from "@/features/admin/configs/nav.config";

export const Route = createFileRoute("/admin/shop-by-category")({
  component: () => <AdminPage config={shopByCategoryConfig} />,
});

