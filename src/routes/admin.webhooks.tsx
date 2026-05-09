import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/webhooks")({
  component: () => <ComingSoon title={{ ar: "Webhooks", en: "Webhooks" }} />,
});
