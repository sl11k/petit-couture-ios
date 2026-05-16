import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { faqItemsConfig } from "@/features/admin/configs/phase5.config";

export const Route = createFileRoute("/admin/faq")({
  component: () => <AdminPage config={faqItemsConfig} />,
});
