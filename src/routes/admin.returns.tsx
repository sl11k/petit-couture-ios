import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/returns")({
  component: () => <ComingSoon title={{ ar: "المرتجعات", en: "Returns" }} />,
});
