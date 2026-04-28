import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/payments")({
  component: () => <ComingSoonPage title="المدفوعات" desc="إدارة المعاملات والاسترداد" features={["سجل المعاملات", "استرداد جزئي/كامل", "تسوية الدفعات", "تقارير ضريبية"]} />,
});
