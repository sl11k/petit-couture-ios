import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/payments")({
  component: () => <ComingSoon title={{ ar: "المدفوعات", en: "Payments" }} />,
});
