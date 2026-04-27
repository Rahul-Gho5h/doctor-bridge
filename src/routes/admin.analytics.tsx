import { createFileRoute } from "@tanstack/react-router";
import { AdminAnalytics } from "@/pages/admin/AdminAnalytics";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Institution Analytics — Doctor Bridge" }] }),
  component: AdminAnalytics,
});
