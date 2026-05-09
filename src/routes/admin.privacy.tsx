import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/privacy")({
  component: () => <ComingSoon title={{ ar: "الخصوصية", en: "Privacy" }} />,
});
