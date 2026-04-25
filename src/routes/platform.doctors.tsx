import { createFileRoute } from "@tanstack/react-router";
import { PlatformDoctors } from "@/pages/platform/PlatformDoctors";

export const Route = createFileRoute("/platform/doctors")({
  head: () => ({ meta: [{ title: "Doctors — Platform Admin" }] }),
  component: PlatformDoctors,
});
