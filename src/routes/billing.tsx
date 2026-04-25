import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing — Doctor Bridge" }] }),
  component: () => (
    <DashboardLayout>
      <PageHeader title="Billing" description="Invoices, payments, services." />
      <EmptyState icon={Construction} title="Coming next" description="Billing module ships in the next update." />
    </DashboardLayout>
  ),
});
