import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/create-order")({
  component: () => <ComingSoon title={{ ar: "إنشاء طلب", en: "Create order" }} />,
});
