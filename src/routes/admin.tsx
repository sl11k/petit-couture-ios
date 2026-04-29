import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  // All admin pages render their own AdminShell internally,
  // so this layout is intentionally minimal — just an Outlet
  // to render the matched child route.
  return <Outlet />;
}
