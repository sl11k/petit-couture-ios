import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/inventory")({
  component: () => <ComingSoon title={{ ar: "المخزون", en: "Inventory" }} />,
});
