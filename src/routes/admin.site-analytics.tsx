import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/site-analytics")({
  component: () => <ComingSoon title={{ ar: "تحليلات الموقع", en: "Site analytics" }} />,
});
