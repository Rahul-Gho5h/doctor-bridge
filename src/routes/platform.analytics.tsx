import { createFileRoute } from "@tanstack/react-router";
import { PlatformAnalytics } from "@/pages/platform/PlatformAnalytics";

export const Route = createFileRoute("/platform/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Platform Admin" }] }),
  component: PlatformAnalytics,
});
