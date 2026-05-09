import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { contentConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/content")({
  component: () => <AdminPage config={contentConfig} />,
});
