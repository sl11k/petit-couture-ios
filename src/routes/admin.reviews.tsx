import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { reviewsConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/reviews")({
  component: () => <AdminPage config={reviewsConfig} />,
});
