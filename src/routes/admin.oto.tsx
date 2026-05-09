import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/oto")({
  component: () => <ComingSoon title={{ ar: "OTO", en: "OTO" }} />,
});
