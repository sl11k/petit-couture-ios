import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/help")({
  component: () => <ComingSoon title={{ ar: "المساعدة", en: "Help" }} />,
});
