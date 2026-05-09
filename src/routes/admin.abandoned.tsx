import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/abandoned")({
  component: () => <ComingSoon title={{ ar: "السلال المتروكة", en: "Abandoned carts" }} />,
});
