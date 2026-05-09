import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/users")({
  component: () => <ComingSoon title={{ ar: "المستخدمون", en: "Users" }} />,
});
