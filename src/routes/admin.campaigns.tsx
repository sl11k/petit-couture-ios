import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/campaigns")({
  component: () => <ComingSoonPage title="العروض والحملات" desc="إنشاء عروض موسمية وحملات تسويقية" features={["عروض موسمية", "صفحات هبوط", "Banners", "حملات بريدية"]} />,
});
