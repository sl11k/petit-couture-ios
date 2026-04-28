import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/messages")({
  component: () => <ComingSoonPage title="الرسائل" desc="رسائل العملاء والاستفسارات" features={["صندوق وارد موحد", "رد جماعي", "تصنيف", "أرشفة"]} />,
});
