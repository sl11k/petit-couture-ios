import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/support")({
  component: () => <ComingSoonPage title="خدمة العملاء" desc="نظام تذاكر الدعم" features={["تذاكر الدعم", "أولويات", "ردود جاهزة", "تقييم الخدمة"]} />,
});
