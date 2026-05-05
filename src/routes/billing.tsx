import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CreditCard, CheckCircle2, Clock, Users, FileText,
  Zap, Shield, Building2, Star, AlertCircle, ArrowRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing — Doctor Bridge" }] }),
  component: BillingPage,
});

type ClinicPlan = "TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

interface ClinicBillingInfo {
  plan: ClinicPlan;
  plan_expires_at: string | null;
  name: string;
}

interface UsageStats {
  referrals_this_month: number;
  active_doctors: number;
  total_patients: number;
}

const PLAN_META: Record<ClinicPlan, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  monthly_price: number | null;
  referral_cap: number | null;
  doctor_cap: number | null;
  features: string[];
}> = {
  TRIAL: {
    label: "Trial",
    color: "text-warning-foreground bg-warning/20 border-warning/30",
    icon: Clock,
    monthly_price: 0,
    referral_cap: 50,
    doctor_cap: 3,
    features: [
      "Up to 3 doctors",
      "50 referrals / month",
      "Basic doctor directory",
      "Email support",
    ],
  },
  STARTER: {
    label: "Starter",
    color: "text-info-foreground bg-info/15 border-info/30",
    icon: Zap,
    monthly_price: 49,
    referral_cap: 200,
    doctor_cap: 10,
    features: [
      "Up to 10 doctors",
      "200 referrals / month",
      "NMC verification",
      "Referral tracking",
      "Priority support",
    ],
  },
  PROFESSIONAL: {
    label: "Professional",
    color: "text-primary bg-primary/10 border-primary/20",
    icon: Shield,
    monthly_price: 149,
    referral_cap: 1000,
    doctor_cap: 50,
    features: [
      "Up to 50 doctors",
      "1 000 referrals / month",
      "Inventory management",
      "Advanced analytics",
      "Dedicated account manager",
      "API access",
    ],
  },
  ENTERPRISE: {
    label: "Enterprise",
    color: "text-success-foreground bg-success/15 border-success/30",
    icon: Building2,
    monthly_price: null,
    referral_cap: null,
    doctor_cap: null,
    features: [
      "Unlimited doctors",
      "Unlimited referrals",
      "Multi-branch support",
      "SSO / SAML",
      "SLA guarantee",
      "Custom integrations",
      "24 / 7 phone support",
    ],
  },
};

const PLAN_ORDER: ClinicPlan[] = ["TRIAL", "STARTER", "PROFESSIONAL", "ENTERPRISE"];

function PlanBadge({ plan }: { plan: ClinicPlan }) {
  const { label, color, icon: Icon } = PLAN_META[plan];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold", color)}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PlanCard({
  plan, current, onUpgrade,
}: {
  plan: ClinicPlan;
  current: boolean;
  onUpgrade?: () => void;
}) {
  const meta = PLAN_META[plan];
  const currentIdx = PLAN_ORDER.indexOf(plan);
  const isUpgrade = !current;

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-6 shadow-card flex flex-col",
        current && "ring-2 ring-primary",
      )}
    >
      {current && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Current plan
        </div>
      )}
      <div className="flex items-center gap-2">
        <meta.icon className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">{meta.label}</h3>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        {meta.monthly_price === null ? (
          <span className="text-2xl font-bold">Custom</span>
        ) : meta.monthly_price === 0 ? (
          <span className="text-2xl font-bold">Free</span>
        ) : (
          <>
            <span className="text-2xl font-bold">${meta.monthly_price}</span>
            <span className="text-sm text-muted-foreground">/ mo</span>
          </>
        )}
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {meta.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        className="mt-6 w-full"
        variant={current ? "outline" : "default"}
        disabled={current}
        onClick={onUpgrade}
      >
        {current ? "Current plan" : plan === "ENTERPRISE" ? (
          <><Star className="mr-1.5 h-4 w-4" /> Contact sales</>
        ) : (
          <><ArrowRight className="mr-1.5 h-4 w-4" /> Upgrade</>
        )}
      </Button>
    </div>
  );
}

function BillingPage() {
  const { profile } = useAuth();
  const [billing, setBilling] = useState<ClinicBillingInfo | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.clinic_id) { setLoading(false); return; }

    const clinicId = profile.clinic_id;
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [{ data: clinic }, { data: refs }, { data: docs }, { data: patients }] = await Promise.all([
        supabase.from("clinics").select("plan,plan_expires_at,name").eq("id", clinicId).maybeSingle(),
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("originating_clinic_id", clinicId).gte("created_at", monthStart),
        supabase.from("doctor_profiles").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      ]);

      setBilling(clinic as ClinicBillingInfo | null);
      setUsage({
        referrals_this_month: (refs as any)?.count ?? 0,
        active_doctors: (docs as any)?.count ?? 0,
        total_patients: (patients as any)?.count ?? 0,
      });
      setLoading(false);
    })();
  }, [profile?.clinic_id]);

  const plan = (billing?.plan ?? "TRIAL") as ClinicPlan;
  const meta = PLAN_META[plan];
  const expiresAt = billing?.plan_expires_at ? new Date(billing.plan_expires_at) : null;
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 14;

  return (
    <DashboardLayout>
      <PageHeader
        title="Billing"
        description="Manage your plan, monitor usage, and upgrade anytime."
      />

      {/* Trial expiry warning */}
      {plan === "TRIAL" && expiringSoon && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <p className="text-warning-foreground">
            Your trial expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>.
            Upgrade to keep uninterrupted access.
          </p>
        </div>
      )}

      {/* Current plan summary */}
      <div className="mb-6 rounded-xl border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active plan</p>
            <div className="mt-2 flex items-center gap-3">
              <PlanBadge plan={plan} />
              {billing?.name && <span className="text-sm text-muted-foreground">{billing.name}</span>}
            </div>
            {expiresAt && (
              <p className={cn("mt-1.5 text-xs", expiringSoon ? "text-warning-foreground font-medium" : "text-muted-foreground")}>
                {plan === "TRIAL" ? "Trial ends" : "Renews"} {expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {meta.monthly_price !== null && meta.monthly_price > 0 && (
              <div className="text-right hidden sm:block">
                <p className="text-2xl font-bold">${meta.monthly_price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground">billed monthly</p>
              </div>
            )}
            <Button variant="outline" size="sm">
              <CreditCard className="mr-1.5 h-4 w-4" /> Manage billing
            </Button>
          </div>
        </div>

        {/* Usage bars */}
        {usage && (
          <div className="mt-5 grid gap-4 sm:grid-cols-3 border-t pt-5">
            {[
              {
                label: "Referrals this month",
                used: usage.referrals_this_month,
                cap: meta.referral_cap,
                icon: FileText,
              },
              {
                label: "Doctors",
                used: usage.active_doctors,
                cap: meta.doctor_cap,
                icon: Users,
              },
              {
                label: "Patients",
                used: usage.total_patients,
                cap: null,
                icon: Users,
              },
            ].map(({ label, used, cap, icon: Icon }) => {
              const pct = cap ? Math.min(100, (used / cap) * 100) : null;
              const nearLimit = pct !== null && pct >= 80;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="flex items-center gap-1"><Icon className="h-3 w-3" />{label}</span>
                    <span className={cn("font-medium", nearLimit && "text-warning-foreground")}>
                      {used}{cap ? ` / ${cap}` : ""}
                    </span>
                  </div>
                  {cap && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct! >= 100 ? "bg-destructive" : pct! >= 80 ? "bg-warning" : "bg-success",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage stat cards */}
      {!loading && usage && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Referrals this month" value={usage.referrals_this_month} />
          <StatCard label="Active doctors" value={usage.active_doctors} />
          <StatCard label="Total patients" value={usage.total_patients} />
        </div>
      )}

      {/* Plan comparison */}
      <h2 className="mb-4 text-lg font-semibold">All plans</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((p) => (
          <PlanCard
            key={p}
            plan={p}
            current={p === plan}
            onUpgrade={p === "ENTERPRISE"
              ? () => window.open("mailto:sales@doctorbridge.com")
              : undefined}
          />
        ))}
      </div>

      {/* Invoice history placeholder */}
      <div className="mt-8 rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-base font-semibold">Invoice history</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan === "TRIAL"
            ? "No invoices yet — you're on the free trial."
            : "Your invoices will appear here once available."}
        </p>
      </div>
    </DashboardLayout>
  );
}
