import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/performance")({
  component: () => <ComingSoon title={{ ar: "الأداء", en: "Performance" }} />,
});
