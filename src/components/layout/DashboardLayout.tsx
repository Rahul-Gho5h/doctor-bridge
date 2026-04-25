import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Calendar, FileText, Search, Send, UserCircle,
  Receipt, UserCog, Package, BarChart3, Settings, LogOut, Menu, X,
  Building2, Inbox, MessageSquare, MessageSquareMore, ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, type AccountType } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/common/BrandLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useReminders } from "@/hooks/useReminders";
import { ClinicBanner } from "@/components/common/ClinicBanner";

import { toast } from "sonner";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  hideForRoles?: AppRole[];
  accountTypes?: AccountType[];
  hideForAccountTypes?: AccountType[];
}

interface NavSection { title: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  // ── Doctor / Hospital admin sections ────────────────────────────────────────
  { title: "Overview", items: [
    // Regular dashboard — hidden from clinic_admin (they get /admin/dashboard below)
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hideForRoles: ["clinic_admin"] },
  ]},
  { title: "Referral Network", items: [
    { to: "/doctors",     label: "Find Specialists",  icon: Search,          accountTypes: ["doctor", "hospital_admin"] },
    { to: "/referrals",   label: "Referrals",         icon: Send,            accountTypes: ["doctor", "hospital_admin"] },
    { to: "/discussions", label: "Case Discussions",  icon: MessageSquareMore, accountTypes: ["doctor"] },
    { to: "/messages",    label: "Messages",          icon: MessageSquare,   accountTypes: ["doctor", "hospital_admin"] },
  ]},
  { title: "Clinical", items: [
    { to: "/patients", label: "Patients", icon: Users,     hideForAccountTypes: ["hospital_admin"], hideForRoles: ["clinic_admin"] },
    { to: "/emr",      label: "EMR",      icon: FileText,  hideForAccountTypes: ["hospital_admin"], hideForRoles: ["clinic_admin"] },
  ]},
  { title: "My Practice", items: [
    { to: "/profile",      label: "My Profile",  icon: UserCircle, accountTypes: ["doctor"] },
    { to: "/availability", label: "Availability", icon: Calendar,  accountTypes: ["doctor"] },
    { to: "/cme",          label: "CME / CPD",   icon: BarChart3, accountTypes: ["doctor"] },
    { to: "/analytics",    label: "Analytics",   icon: BarChart3, hideForRoles: ["clinic_admin"] },
    { to: "/settings",     label: "Settings",    icon: Settings,  hideForAccountTypes: ["hospital_admin"], hideForRoles: ["clinic_admin"] },
  ]},
  { title: "Hospital", items: [
    { to: "/hospital/doctors", label: "My Doctors",           icon: Users,     accountTypes: ["hospital_admin"] },
    { to: "/affiliations",     label: "Affiliation Requests", icon: Inbox,     accountTypes: ["hospital_admin"] },
    { to: "/settings",         label: "Hospital Profile",     icon: Building2, accountTypes: ["hospital_admin"] },
    { to: "/analytics",        label: "Analytics",            icon: BarChart3, accountTypes: ["hospital_admin"] },
    { to: "/appointments",     label: "Appointments",         icon: Calendar,  accountTypes: ["hospital_admin"] },
    { to: "/billing",          label: "Billing",              icon: Receipt,   accountTypes: ["hospital_admin"] },
    { to: "/staff",            label: "Staff",                icon: UserCog,   accountTypes: ["hospital_admin"] },
    { to: "/inventory",        label: "Inventory",            icon: Package,   accountTypes: ["hospital_admin"] },
  ]},
  // ── Clinic Admin section — only visible to clinic_admin role ────────────────
  { title: "Overview", items: [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["clinic_admin"] },
    { to: "/admin/doctors",   label: "Doctors",   icon: Users,           roles: ["clinic_admin"] },
    { to: "/patients",        label: "Patients",  icon: Users,           roles: ["clinic_admin"] },
  ]},
  { title: "Reports", items: [
    { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["clinic_admin"] },
    { to: "/settings",  label: "Settings",  icon: Settings,  roles: ["clinic_admin"] },
  ]},
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, roles, loading, user } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [docVerified, setDocVerified] = useState<boolean | null>(null);

  // Derived role/account values — declared before any useEffect that references them
  const accountType: AccountType = profile?.account_type ?? "clinic_staff";
  const isClinicAdmin = roles.includes("clinic_admin");

  // Safety valve: if auth hasn't resolved in 8s, stop spinning and redirect
  useEffect(() => {
    if (!loading) { setTimedOut(false); return; }
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  // Auth guard: redirect unauthenticated users away (no flash of layout)
  useEffect(() => {
    if (!loading && !user) {
      router.navigate({ to: "/login", search: { redirect: pathname } as never });
    }
  }, [loading, user, router, pathname]);

  // Role guard: clinic_admin cannot access clinical / referral routes
  const CLINIC_ADMIN_BLOCKED = [
    "/referrals", "/emr", "/cme", "/appointments",
    "/availability", "/discussions", "/messages", "/doctors",
    "/dashboard",
  ];
  useEffect(() => {
    if (loading || !isClinicAdmin) return;
    const blocked = CLINIC_ADMIN_BLOCKED.some((prefix) => pathname.startsWith(prefix));
    if (blocked) router.navigate({ to: "/admin/dashboard" });
  }, [loading, isClinicAdmin, pathname, router]);

  // Check if a doctor has completed identity verification
  useEffect(() => {
    if (!user || !profile) return;
    if ((profile as any).account_type !== "doctor") return;
    supabase
      .from("doctor_profiles")
      .select("nmc_verified")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDocVerified(data.nmc_verified ?? false);
      });
  }, [user, profile]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Check for due follow-up reminders
  useReminders(user?.id);

  const visible = (item: NavItem) => {
    if (item.roles        && !item.roles.some((r) => roles.includes(r)))          return false;
    if (item.hideForRoles &&  item.hideForRoles.some((r) => roles.includes(r)))   return false;
    if (item.accountTypes && !item.accountTypes.includes(accountType))            return false;
    if (item.hideForAccountTypes && item.hideForAccountTypes.includes(accountType)) return false;
    return true;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/login" });
  };

  if (timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <div className="text-center text-sm">
          <p>Session could not be loaded.</p>
          <button
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => router.navigate({ to: "/login" })}
          >
            Sign in again
          </button>
        </div>
      </div>
    );
  }

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          Loading…
        </div>
      </div>
    );
  }

  const SidebarBody = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4 text-sidebar-foreground">
        <BrandLogo size="sm" to={isClinicAdmin ? "/admin/dashboard" : "/dashboard"} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => {
          const items = section.items.filter(visible);
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-5">
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.to);
                  return (
                    <li key={item.to + item.label}>
                      <Link
                        to={item.to}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-1 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-accent-foreground">
            {profile.first_name[0]}{profile.last_name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sidebar-foreground">
              {profile.first_name} {profile.last_name}
            </div>
            <span className="inline-block rounded-full border border-sidebar-foreground/20 bg-sidebar-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-sidebar-foreground/80">
              {accountType === "doctor" ? "Doctor" : accountType === "hospital_admin" ? "Hospital" : "Clinic"}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {SidebarBody}
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Clinic banner row (clinic name + defaults + actions) */}
        <div className="flex shrink-0 items-center gap-3 border-b bg-card px-4 md:px-8">
          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-0 [&>button]:hidden">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 z-10 rounded-md p-1 hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {SidebarBody}
            </SheetContent>
          </Sheet>
          <div className="flex-1 py-3">
            <div className="text-sm font-semibold text-primary">
              {isClinicAdmin
                ? "Clinic admin workspace"
                : accountType === "doctor"
                  ? "Independent practice"
                  : accountType === "hospital_admin"
                    ? "Hospital admin workspace"
                    : "Clinic workspace"}
            </div>
            <div className="text-xs text-muted-foreground">
              India defaults: INR, Asia/Kolkata, verified doctors only
            </div>
          </div>
          <div className="flex items-center gap-2 py-3">
            <NotificationBell />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hidden rounded-full border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground sm:inline-flex"
            >
              Logout
            </Button>
          </div>
        </div>
        {/* Onboarding banner: shown to doctors who haven't verified identity yet */}
        {docVerified === false && pathname !== "/onboarding" && (
          <div className="shrink-0 border-b bg-warning/10 px-4 py-2.5 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 shrink-0 text-warning-foreground" />
                <span className="font-medium text-warning-foreground">
                  Identity not verified
                </span>
                <span className="hidden text-muted-foreground sm:inline">
                  — your profile won't appear in the specialist directory until complete.
                </span>
              </div>
              <Link
                to="/onboarding"
                className="rounded-md bg-warning/20 px-3 py-1 text-xs font-semibold text-warning-foreground hover:bg-warning/30 transition-colors"
              >
                Complete setup →
              </Link>
            </div>
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="animate-fade-in p-4 md:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
