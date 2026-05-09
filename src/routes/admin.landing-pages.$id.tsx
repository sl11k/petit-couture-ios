import { createFileRoute, useParams } from "@tanstack/react-router";
import { DetailPage } from "@/features/admin/components/DetailPage";
import { landingDetailConfig } from "@/features/admin/configs/detail.configs";

export const Route = createFileRoute("/admin/landing-pages/$id")({
  component: () => {
    const { id } = useParams({ from: "/admin/landing-pages/$id" });
    return <DetailPage config={landingDetailConfig} id={id} />;
  },
});
