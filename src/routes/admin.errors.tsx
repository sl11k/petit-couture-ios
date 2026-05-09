import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/errors")({
  component: () => <ComingSoon title={{ ar: "الأخطاء", en: "Errors" }} />,
});
