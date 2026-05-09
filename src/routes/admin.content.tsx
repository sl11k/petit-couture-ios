import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/content")({
  component: () => <ComingSoon title={{ ar: "صفحات", en: "Pages" }} />,
});
