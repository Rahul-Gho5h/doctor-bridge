import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Doctor Bridge" }] }),
  component: AdminDashboard,
});
