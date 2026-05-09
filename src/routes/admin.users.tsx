import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { usersConfig } from "@/features/admin/configs/phase3.config";

export const Route = createFileRoute("/admin/users")({
  component: () => <AdminPage config={usersConfig} />,
});
