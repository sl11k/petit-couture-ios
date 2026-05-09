import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/campaigns")({
  component: () => <ComingSoon title={{ ar: "الحملات", en: "Campaigns" }} />,
});
