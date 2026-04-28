import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/returns")({
  component: () => <ComingSoonPage title="المرتجعات" desc="إدارة طلبات الإرجاع والاستبدال" features={["طلبات الإرجاع", "موافقة/رفض", "استرداد المبلغ", "تتبع الحالة"]} />,
});
