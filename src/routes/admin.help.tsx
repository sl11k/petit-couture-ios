import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/help")({
  component: () => <ComingSoonPage title="الدعم الفني" desc="مساعدة ودليل استخدام لوحة الإدارة" features={["دليل الاستخدام", "فيديوهات تعليمية", "تواصل مع الدعم", "الأسئلة الشائعة"]} />,
});
