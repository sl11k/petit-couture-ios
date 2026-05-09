import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { landingPagesConfig } from "@/features/admin/configs/phase4.config";

export const Route = createFileRoute("/admin/landing-pages")({
  component: () => <AdminPage config={landingPagesConfig} />,
});
