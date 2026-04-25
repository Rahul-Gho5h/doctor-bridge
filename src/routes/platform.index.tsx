import { createFileRoute } from "@tanstack/react-router";
import { PlatformDashboard } from "@/pages/platform/PlatformDashboard";

export const Route = createFileRoute("/platform/")({
  head: () => ({ meta: [{ title: "Platform Admin — Doctor Bridge" }] }),
  component: PlatformDashboard,
});
