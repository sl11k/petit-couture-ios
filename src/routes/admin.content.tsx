import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/content")({
  component: () => <ComingSoonPage title="المحتوى" desc="إدارة الصفحات الثابتة والمدونة" features={["صفحات ثابتة", "مدونة", "FAQ", "الشروط والسياسات"]} />,
});
