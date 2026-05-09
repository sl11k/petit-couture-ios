import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/support")({
  component: () => <ComingSoon title={{ ar: "الدعم", en: "Support" }} />,
});
