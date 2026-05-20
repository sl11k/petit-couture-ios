import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { messagesConfig } from "@/features/admin/configs/phase3.config";

export const Route = createFileRoute("/admin/messages/")({
  component: () => <AdminPage config={messagesConfig} />,
});
