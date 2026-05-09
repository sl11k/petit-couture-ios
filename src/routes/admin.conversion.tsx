import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/conversion")({
  component: () => <ComingSoon title={{ ar: "التحويل", en: "Conversion" }} />,
});
