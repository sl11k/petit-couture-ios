import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/reports")({
  component: () => <ComingSoon title={{ ar: "التقارير", en: "Reports" }} />,
});
