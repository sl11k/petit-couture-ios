import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/features/admin/components/ComingSoon";

export const Route = createFileRoute("/admin/home-builder")({
  component: () => <ComingSoon title={{ ar: "محرر الرئيسية", en: "Home builder" }} />,
});
