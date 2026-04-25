import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { User, Lock, Bell, Stethoscope, Shield } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountTab } from "@/components/settings/AccountTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { PracticeTab } from "@/components/settings/PracticeTab";
import { PrivacyTab } from "@/components/settings/PrivacyTab";

const VALID_TABS = ["account", "security", "notifications", "practice", "privacy"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Doctor Bridge" }] }),
  validateSearch: z.object({
    tab: z.enum(VALID_TABS).optional(),
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab: searchTab } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<SettingsTab>(searchTab ?? "account");

  // When navigating here with ?tab=X (e.g. from the notification bell),
  // sync the active tab even if the component is already mounted.
  useEffect(() => {
    if (searchTab) setActiveTab(searchTab);
  }, [searchTab]);

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <PageHeader
          title="Settings"
          description="Manage your account, security, notifications and practice preferences."
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SettingsTab)}
        >
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="account">
              <User className="mr-1.5 h-3.5 w-3.5" />Account
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="mr-1.5 h-3.5 w-3.5" />Security
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-1.5 h-3.5 w-3.5" />Notifications
            </TabsTrigger>
            <TabsTrigger value="practice">
              <Stethoscope className="mr-1.5 h-3.5 w-3.5" />Practice
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="mr-1.5 h-3.5 w-3.5" />Privacy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <AccountTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
          <TabsContent value="practice">
            <PracticeTab />
          </TabsContent>
          <TabsContent value="privacy">
            <PrivacyTab />
          </TabsContent>
        </Tabs>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
