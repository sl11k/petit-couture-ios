import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/incomplete")({
  component: () => <ComingSoon title={{ ar: "غير مكتملة", en: "Incomplete" }} />,
});
