import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/integrations")({
  component: () => <ComingSoonPage title="التكاملات" desc="ربط الخدمات الخارجية" features={["بوابات الدفع", "شركات الشحن", "Google Analytics", "Meta Pixel", "Mailchimp"]} />,
});
