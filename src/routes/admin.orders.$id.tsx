import { createFileRoute, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { orderDetailConfig } from "@/features/admin/configs/orderDetail.config";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = useParams({ from: "/admin/orders/$id" });
  return <DetailPage config={orderDetailConfig} id={id} />;
}
