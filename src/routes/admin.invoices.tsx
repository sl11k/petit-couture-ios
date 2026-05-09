import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/invoices")({
  component: () => <ComingSoon title={{ ar: "الفواتير", en: "Invoices" }} />,
});
