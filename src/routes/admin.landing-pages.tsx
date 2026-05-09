import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/landing-pages")({
  component: () => <ComingSoon title={{ ar: "صفحات الهبوط", en: "Landing pages" }} />,
});
