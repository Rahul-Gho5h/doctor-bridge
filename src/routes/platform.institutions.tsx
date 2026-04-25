import { createFileRoute } from "@tanstack/react-router";
import { PlatformInstitutions } from "@/pages/platform/PlatformInstitutions";

export const Route = createFileRoute("/platform/institutions")({
  head: () => ({ meta: [{ title: "Institutions — Platform Admin" }] }),
  component: PlatformInstitutions,
});
