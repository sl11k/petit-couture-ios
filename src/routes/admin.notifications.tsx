import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/notifications")({
  component: () => <ComingSoonPage title="الإشعارات" desc="إشعارات Push والبريد والـ SMS" features={["إشعارات Push", "قوالب البريد", "SMS / WhatsApp", "تنبيهات النظام"]} />,
});
