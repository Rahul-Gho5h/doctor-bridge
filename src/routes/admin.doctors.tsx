import { createFileRoute } from "@tanstack/react-router";
import { AdminDoctors } from "@/pages/admin/AdminDoctors";

export const Route = createFileRoute("/admin/doctors")({
  head: () => ({ meta: [{ title: "Doctors — Doctor Bridge" }] }),
  component: AdminDoctors,
});
