import { createFileRoute, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { couponDetailConfig } from "@/features/admin/configs/detail.configs";

export const Route = createFileRoute("/admin/coupons/$id")({
  component: () => {
    const { id } = useParams({ from: "/admin/coupons/$id" });
    return <DetailPage config={couponDetailConfig} id={id} />;
  },
});
