import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { User, Lock, Bell, Stethoscope, Shield, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountTab } from "@/components/settings/AccountTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { PracticeTab } from "@/components/settings/PracticeTab";
import { PrivacyTab } from "@/components/settings/PrivacyTab";
import { InstitutionTab } from "@/components/settings/InstitutionTab";
import { useAuth } from "@/hooks/useAuth";

const VALID_TABS = ["account", "security", "notifications", "practice", "privacy", "institution"] as const;
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
  const { roles, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(searchTab ?? "account");

  const isSuperAdmin = roles.includes("super_admin");
  const isClinicAdmin = roles.includes("clinic_admin");

  // When navigating here with ?tab=X (e.g. from the notification bell),
  // sync the active tab even if the component is already mounted.
  useEffect(() => {
    if (searchTab) setActiveTab(searchTab);
  }, [searchTab]);

  // Guard: if the active tab isn't visible for this role, reset to account
  useEffect(() => {
    if (isSuperAdmin && !["account", "security"].includes(activeTab)) {
      setActiveTab("account");
    }
  }, [isSuperAdmin, activeTab]);

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <PageHeader
          title="Settings"
          description={
            isSuperAdmin
              ? "Manage your account and security settings."
              : isClinicAdmin
                ? "Manage your account, institution settings and preferences."
                : "Manage your account, security, notifications and practice preferences."
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SettingsTab)}
        >
          <TabsList className="mb-4 flex-wrap">
            {/* Account — always shown */}
            <TabsTrigger value="account">
              <User className="mr-1.5 h-3.5 w-3.5" />Account
            </TabsTrigger>

            {/* Security — always shown */}
            <TabsTrigger value="security">
              <Lock className="mr-1.5 h-3.5 w-3.5" />Security
            </TabsTrigger>

            {/* Notifications — clinic_admin + doctor/staff; not super_admin */}
            {!isSuperAdmin && (
              <TabsTrigger value="notifications">
                <Bell className="mr-1.5 h-3.5 w-3.5" />Notifications
              </TabsTrigger>
            )}

            {/* Practice — doctor/staff only (not super_admin, not clinic_admin) */}
            {!isSuperAdmin && !isClinicAdmin && (
              <TabsTrigger value="practice">
                <Stethoscope className="mr-1.5 h-3.5 w-3.5" />Practice
              </TabsTrigger>
            )}

            {/* Institution — clinic_admin only */}
            {isClinicAdmin && (
              <TabsTrigger value="institution">
                <Building2 className="mr-1.5 h-3.5 w-3.5" />Institution
              </TabsTrigger>
            )}

            {/* Privacy — clinic_admin + doctor/staff; not super_admin */}
            {!isSuperAdmin && (
              <TabsTrigger value="privacy">
                <Shield className="mr-1.5 h-3.5 w-3.5" />Privacy
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="account">
            <AccountTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          {!isSuperAdmin && (
            <TabsContent value="notifications">
              <NotificationsTab />
            </TabsContent>
          )}
          {!isSuperAdmin && !isClinicAdmin && (
            <TabsContent value="practice">
              <PracticeTab />
            </TabsContent>
          )}
          {isClinicAdmin && (
            <TabsContent value="institution">
              <InstitutionTab />
            </TabsContent>
          )}
          {!isSuperAdmin && (
            <TabsContent value="privacy">
              <PrivacyTab />
            </TabsContent>
          )}
        </Tabs>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
