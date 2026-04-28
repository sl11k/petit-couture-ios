import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/storefront")({
  component: () => <ComingSoonPage title="واجهات الموقع" desc="تخصيص الصفحة الرئيسية والأقسام" features={["Hero Banners", "أقسام مميزة", "ترتيب الأقسام", "ألوان وتيمات"]} />,
});
