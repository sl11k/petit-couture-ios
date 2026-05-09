import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/security")({
  component: () => <ComingSoon title={{ ar: "الأمان", en: "Security" }} />,
});
