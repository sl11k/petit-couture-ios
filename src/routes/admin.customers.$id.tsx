import { createFileRoute, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { customerDetailConfig } from "@/features/admin/configs/customerDetail.config";

export const Route = createFileRoute("/admin/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = useParams({ from: "/admin/customers/$id" });
  return <DetailPage config={customerDetailConfig} id={id} />;
}
