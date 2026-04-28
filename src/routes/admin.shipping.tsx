import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/admin/ComingSoonPage";

export const Route = createFileRoute("/admin/shipping")({
  component: () => <ComingSoonPage title="الشحن" desc="شركات الشحن وبوالص الشحنات" features={["شركات شحن متعددة", "إنشاء بوليصة شحن", "تتبع الشحنات", "أسعار حسب المنطقة"]} />,
});
