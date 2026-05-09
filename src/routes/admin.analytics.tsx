import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/analytics")({
  component: () => <ComingSoon title={{ ar: "التحليلات", en: "Analytics" }} />,
});
