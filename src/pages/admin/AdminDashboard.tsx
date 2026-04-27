/**
 * AdminDashboard — /admin/dashboard
 *
 * Home page for CLINIC_ADMIN users.
 *  Section 1 — Institution status card (name, verification, platform ID, equipment)
 *  Section 2 — Stats row (active doctors, notice period, pending affiliations)
 *
 * The doctors table and onboard modal live on /admin/doctors (AdminDoctors.tsx).
 */

import { useEffect, useState } from "react";
import {
  AlertCircle, Building2, CheckCircle2, Clock, Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalDoctorLinks } from "@/hooks/useHospitalAdmin";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClinicDetail {
  id: string;
  name: string;
  entity_type: "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "DIAGNOSTIC_CENTER" | null;
  verification_status: "PENDING" | "ACTIVE" | "SUSPENDED" | null;
  platform_id: string | null;
  city: string | null;
  state: string | null;
  gst_number: string | null;
  registration_number: string | null;
  equipment: string[] | null;
}

// ---------------------------------------------------------------------------
// Section 1 helpers
// ---------------------------------------------------------------------------

function VerificationBadge({ status }: { status: ClinicDetail["verification_status"] }) {
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Active
      </span>
    );
  if (status === "SUSPENDED")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
        <AlertCircle className="h-3 w-3" /> Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <Clock className="h-3 w-3" /> Pending verification
    </span>
  );
}

function EntityBadge({ type }: { type: ClinicDetail["entity_type"] }) {
  const labels: Record<NonNullable<ClinicDetail["entity_type"]>, string> = {
    HOSPITAL:           "Hospital",
    CLINIC:             "Clinic",
    NURSING_HOME:       "Nursing Home",
    DIAGNOSTIC_CENTER:  "Diagnostic Center",
  };
  return (
    <Badge variant="outline" className="font-normal">
      {type ? labels[type] : "Institution"}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Institution status card
// ---------------------------------------------------------------------------

function InstitutionCard({ clinic }: { clinic: ClinicDetail }) {
  const equipmentList = Array.isArray(clinic.equipment) ? clinic.equipment as string[] : [];

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{clinic.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[clinic.city, clinic.state].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {clinic.entity_type && <EntityBadge type={clinic.entity_type} />}
          <VerificationBadge status={clinic.verification_status} />
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {[
          { label: "Platform ID",       value: clinic.platform_id        ?? "—" },
          { label: "GST Number",        value: clinic.gst_number         ?? "—" },
          { label: "Registration No.",  value: clinic.registration_number ?? "—" },
          { label: "Verification",      value: clinic.verification_status ?? "PENDING" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

      {/* Equipment tags */}
      {equipmentList.length > 0 && (
        <div className="border-t px-6 py-4">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Equipment
          </p>
          <div className="flex flex-wrap gap-1.5">
            {equipmentList.map((eq) => (
              <span
                key={eq}
                className="inline-flex rounded-full border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {eq}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Stats row
// ---------------------------------------------------------------------------

interface StatsData {
  activeDoctors: number;
  onNoticePeriod: number;
  pendingAffiliations: number;
}

function StatsRow({ stats, loading }: { stats: StatsData; loading: boolean }) {
  const items = [
    { label: "Active doctors",       value: stats.activeDoctors,       icon: Users,        to: "/admin/doctors"  as const },
    { label: "On notice period",     value: stats.onNoticePeriod,      icon: Clock,        to: "/admin/doctors"  as const },
    { label: "Pending affiliations", value: stats.pendingAffiliations, icon: AlertCircle,  to: "/affiliations"   as const },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon, to }) => (
        <Link
          key={label}
          to={to}
          className="rounded-xl border bg-card px-5 py-4 shadow-sm transition-colors hover:bg-muted/40 hover:border-primary/30"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{label}</p>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn("mt-2 text-3xl font-bold tracking-tight", loading && "animate-pulse text-muted")}>
            {loading ? "—" : value}
          </p>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminDashboard() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? "";

  const [clinic, setClinic]                   = useState<ClinicDetail | null>(null);
  const [clinicLoading, setClinicLoading]     = useState(true);
  const [pendingAffiliations, setPendingAffiliations] = useState(0);

  const { data: links = [] } = useHospitalDoctorLinks(clinicId);

  /* ── Fetch clinic detail ── */
  useEffect(() => {
    if (!clinicId) return;
    setClinicLoading(true);
    supabase
      .from("clinics")
      .select("id, name, entity_type, verification_status, platform_id, city, state, gst_number, registration_number, equipment")
      .eq("id", clinicId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setClinic(data as ClinicDetail);
        setClinicLoading(false);
      });
  }, [clinicId]);

  /* ── Fetch pending affiliation count ── */
  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from("affiliation_requests")
      .select("id", { count: "exact", head: true })
      .eq("hospital_clinic_id", clinicId)
      .eq("status", "PENDING")
      .then(({ count }) => setPendingAffiliations(count ?? 0));
  }, [clinicId]);

  const activeDoctors  = links.filter((l) => l.status === "ACTIVE").length;
  const onNoticePeriod = links.filter((l) => l.status === "NOTICE_PERIOD").length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Admin Dashboard"
        description="Overview of your institution and affiliated doctors."
      />

      <div className="space-y-6">
        {/* Section 1 — Institution status */}
        {clinicLoading ? (
          <div className="h-36 animate-pulse rounded-xl border bg-muted/40" />
        ) : clinic ? (
          <InstitutionCard clinic={clinic} />
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No institution found for your account.
          </div>
        )}

        {/* Section 2 — Stats */}
        <StatsRow
          stats={{ activeDoctors, onNoticePeriod, pendingAffiliations }}
          loading={clinicLoading}
        />
      </div>
    </DashboardLayout>
  );
}
