import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/states")({
  component: () => <ComingSoon title={{ ar: "الحالات", en: "States" }} />,
});
