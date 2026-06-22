import { createFileRoute } from "@tanstack/react-router";
import { ThemeEditor } from "@/theme-customizer/ThemeEditor";

export const Route = createFileRoute("/admin/themes")({
  component: ThemeEditor,
});
