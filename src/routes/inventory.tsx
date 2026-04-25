import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Doctor Bridge" }] }),
  component: () => (
    <DashboardLayout>
      <PageHeader title="Inventory" description="Medications, supplies, equipment." />
      <EmptyState icon={Construction} title="Coming next" description="Inventory module ships in the next update." />
    </DashboardLayout>
  ),
});
