import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/audit-logins")({
  component: () => <ComingSoon title={{ ar: "محاولات الدخول", en: "Login attempts" }} />,
});
