import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { productDetailConfig } from "@/features/admin/configs/productDetail.config";

export const Route = createFileRoute("/admin/products/$id")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = useParams({ from: "/admin/products/$id" });
  return (
    <>
      <DetailPage config={productDetailConfig} id={id} />
      <Outlet />
    </>
  );
}
