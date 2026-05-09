import { createFileRoute, Link } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ShoppingBag, Plus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/create-order")({
  component: CreateOrderPage,
});

function CreateOrderPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return (
    <div>
      <PageHeader
        title={{ ar: "إنشاء طلب", en: "Create Order" }}
        description={{ ar: "أنشئ طلباً يدوياً لعميل", en: "Create a manual order for a customer" }}
      />
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-4 text-sm text-muted-foreground">
          {ar
            ? "إنشاء الطلبات اليدوية قيد التطوير. حالياً يمكنك إدارة الطلبات الموجودة."
            : "Manual order creation is in development. You can manage existing orders meanwhile."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
          >
            <ExternalLink className="h-3 w-3" />
            {ar ? "الذهاب للطلبات" : "Go to Orders"}
          </Link>
          <Link
            to="/admin/abandoned"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            {ar ? "السلال المتروكة" : "Abandoned carts"}
          </Link>
        </div>
      </div>
    </div>
  );
}
