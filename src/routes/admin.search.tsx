import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/search")({
  component: () => <ComingSoon title={{ ar: "البحث", en: "Search" }} />,
});
