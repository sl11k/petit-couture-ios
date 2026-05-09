import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/audit")({
  component: () => <ComingSoon title={{ ar: "سجل العمليات", en: "Audit log" }} />,
});
