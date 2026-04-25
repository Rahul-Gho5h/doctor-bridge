import { createFileRoute } from "@tanstack/react-router";
import { PlatformReports } from "@/pages/platform/PlatformReports";

export const Route = createFileRoute("/platform/reports")({
  head: () => ({ meta: [{ title: "Reports — Platform Admin" }] }),
  component: PlatformReports,
});
