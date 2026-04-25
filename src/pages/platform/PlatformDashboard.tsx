/**
 * PlatformDashboard — /platform
 *
 * Internal Doctor Bridge admin panel. Accessible to super_admin users only.
 *
 * Pending tab  — lists PENDING clinics with Approve / Reject actions.
 * All tab      — full table of every clinic with inline expand.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, Building2, CheckCircle2, ChevronDown, ChevronUp,
  Clock, RefreshCw, ShieldCheck, Users, X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
type EntityType = "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "DIAGNOSTIC_CENTER";
type Plan = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";

interface ClinicRow {
  id: string;
  name: string;
  entity_type: EntityType | null;
  city: string | null;
  state: string | null;
  gst_number: string | null;
  registration_number: string | null;
  plan: Plan;
  verification_status: VerificationStatus | null;
  platform_id: string | null;
  created_at: string;
  // enriched client-side
  admin_email?: string | null;
  doctor_count?: number;
}

// ---------------------------------------------------------------------------
// Small display helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const ENTITY_LABELS: Record<string, string> = {
  HOSPITAL: "Hospital",
  CLINIC: "Clinic",
  NURSING_HOME: "Nursing Home",
  DIAGNOSTIC_CENTER: "Diagnostic Center",
};

function EntityBadge({ type }: { type: EntityType | null }) {
  return (
    <Badge variant="outline" className="font-normal text-xs">
      {type ? ENTITY_LABELS[type] ?? type : "Institution"}
    </Badge>
  );
}

function PlanBadge({ plan }: { plan: Plan }) {
  const colours: Record<Plan, string> = {
    FREE:       "bg-muted text-muted-foreground",
    STARTER:    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    GROWTH:     "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    ENTERPRISE: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${colours[plan] ?? colours.FREE}`}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: VerificationStatus | null }) {
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Active
      </span>
    );
  if (status === "SUSPENDED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
        <AlertCircle className="h-3 w-3" /> Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

/** Fetch all clinics with their admin email and active doctor count. */
async function fetchClinics(): Promise<ClinicRow[]> {
  const { data, error } = await supabase
    .from("clinics")
    .select("id,name,entity_type,city,state,gst_number,registration_number,plan,verification_status,platform_id,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as ClinicRow[];
  if (rows.length === 0) return rows;

  const clinicIds = rows.map((r) => r.id);

  // Fetch clinic_admin profiles for admin email
  const { data: admins } = await supabase
    .from("profiles")
    .select("clinic_id,email")
    .in("clinic_id", clinicIds);

  // Fetch admin roles to filter only clinic_admin users
  const adminEmails = admins ?? [];
  const adminUserIds = await supabase
    .from("user_roles")
    .select("user_id,clinic_id")
    .eq("role", "clinic_admin")
    .in("clinic_id", clinicIds);

  const adminRoleMap = new Map<string, string>(); // clinic_id → user_id
  for (const r of adminUserIds.data ?? []) {
    if (!adminRoleMap.has(r.clinic_id)) adminRoleMap.set(r.clinic_id, r.user_id);
  }

  // Match admin email by user_id
  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", Array.from(adminRoleMap.values()));

  const profileEmailMap = new Map<string, string>(); // user_id → email
  for (const p of adminProfiles ?? []) profileEmailMap.set(p.id, p.email);

  // Build clinic_id → admin_email map
  const clinicAdminEmailMap = new Map<string, string>();
  for (const [clinicId, userId] of adminRoleMap.entries()) {
    const email = profileEmailMap.get(userId);
    if (email) clinicAdminEmailMap.set(clinicId, email);
  }

  // Fetch active doctor counts
  const { data: links } = await supabase
    .from("hospital_doctor_links")
    .select("hospital_clinic_id")
    .eq("status", "ACTIVE")
    .in("hospital_clinic_id", clinicIds);

  const doctorCountMap = new Map<string, number>();
  for (const l of links ?? []) {
    doctorCountMap.set(l.hospital_clinic_id, (doctorCountMap.get(l.hospital_clinic_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    ...r,
    admin_email: clinicAdminEmailMap.get(r.id) ?? null,
    doctor_count: doctorCountMap.get(r.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Pending tab
// ---------------------------------------------------------------------------

function PendingTab({
  clinics,
  loading,
  onApproved,
  onRejected,
}: {
  clinics: ClinicRow[];
  loading: boolean;
  onApproved: (id: string, platformId: string) => void;
  onRejected: (id: string) => void;
}) {
  const { user } = useAuth();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const approve = async (clinic: ClinicRow) => {
    if (!user) return;
    setApprovingId(clinic.id);
    try {
      // 1. Generate platform ID via RPC
      const { data: generatedId, error: rpcErr } = await supabase.rpc("generate_platform_id", {
        entity_name: clinic.name,
        city: clinic.city ?? "",
        entity_type: clinic.entity_type ?? "CLINIC",
      });
      if (rpcErr || !generatedId) throw new Error(rpcErr?.message ?? "Platform ID generation failed");
      const platformId = generatedId as string;

      // 2. Update clinic
      const { error: clinicErr } = await supabase
        .from("clinics")
        .update({
          verification_status: "ACTIVE",
          platform_id: platformId,
          verified_at: new Date().toISOString(),
          verified_by: "platform_admin",
        })
        .eq("id", clinic.id);
      if (clinicErr) throw new Error(clinicErr.message);

      // 3. Activate the clinic admin's profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ is_active: true })
        .eq("clinic_id", clinic.id);
      if (profileErr) throw new Error(profileErr.message);

      toast.success(`Institution approved — Platform ID: ${platformId}`);
      onApproved(clinic.id, platformId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApprovingId(null);
    }
  };

  const reject = async (clinic: ClinicRow) => {
    const reason = rejectReason[clinic.id]?.trim();
    if (!reason) { toast.error("Enter a reason before rejecting."); return; }
    setRejectingId(clinic.id);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ verification_status: "SUSPENDED" })
        .eq("id", clinic.id);
      if (error) throw new Error(error.message);
      toast.success("Institution rejected");
      onRejected(clinic.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) return <TableSkeleton columns={6} rows={4} />;

  if (clinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center shadow-sm">
        <ShieldCheck className="mb-3 h-10 w-10 text-green-500" />
        <p className="font-semibold">All caught up</p>
        <p className="mt-1 text-sm text-muted-foreground">No institutions are awaiting verification.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clinics.map((clinic) => (
        <div key={clinic.id} className="rounded-xl border bg-card shadow-sm">
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-base">{clinic.name}</span>
                  <EntityBadge type={clinic.entity_type} />
                  <PlanBadge plan={clinic.plan} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {[clinic.city, clinic.state].filter(Boolean).join(", ")}
                  {clinic.admin_email && (
                    <span className="ml-3 text-xs font-mono">{clinic.admin_email}</span>
                  )}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">Registered {formatDate(clinic.created_at)}</span>
          </div>

          {/* Meta + actions */}
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">GST</dt>
                <dd className="font-mono text-xs mt-0.5">{clinic.gst_number || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reg. No.</dt>
                <dd className="font-mono text-xs mt-0.5">{clinic.registration_number || "—"}</dd>
              </div>
            </dl>

            <div className="flex items-end gap-3">
              {/* Reject inline reason */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Rejection reason</Label>
                <Input
                  value={rejectReason[clinic.id] ?? ""}
                  onChange={(e) => setRejectReason((prev) => ({ ...prev, [clinic.id]: e.target.value }))}
                  placeholder="e.g. Incomplete documents"
                  className="h-8 w-52 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={rejectingId === clinic.id || approvingId === clinic.id}
                onClick={() => reject(clinic)}
              >
                {rejectingId === clinic.id ? (
                  <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />Rejecting…</>
                ) : (
                  <><X className="mr-1.5 h-3.5 w-3.5" />Reject</>
                )}
              </Button>
              <Button
                size="sm"
                disabled={approvingId === clinic.id || rejectingId === clinic.id}
                onClick={() => approve(clinic)}
              >
                {approvingId === clinic.id ? (
                  <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />Approving…</>
                ) : (
                  <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve</>
                )}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// All institutions tab
// ---------------------------------------------------------------------------

function AllTab({ clinics, loading }: { clinics: ClinicRow[]; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) return <TableSkeleton columns={8} rows={6} />;

  if (clinics.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground shadow-sm">
        No institutions registered yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Platform ID</th>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">City</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Doctors</th>
            <th className="px-4 py-3 text-left">Plan</th>
            <th className="px-4 py-3 text-left">Registered</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clinics.map((c) => (
            <>
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {c.platform_id ?? <span className="italic">—</span>}
                </td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3"><EntityBadge type={c.entity_type} /></td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.verification_status} /></td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {c.doctor_count ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3"><PlanBadge plan={c.plan} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                  >
                    {expandedId === c.id
                      ? <><ChevronUp className="mr-1 h-3.5 w-3.5" />Close</>
                      : <><ChevronDown className="mr-1 h-3.5 w-3.5" />View</>}
                  </Button>
                </td>
              </tr>

              {/* Inline detail row */}
              {expandedId === c.id && (
                <tr key={`${c.id}-detail`}>
                  <td colSpan={9} className="bg-muted/20 px-6 py-5">
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      {[
                        { label: "Platform ID",      value: c.platform_id ?? "Not assigned" },
                        { label: "GST Number",       value: c.gst_number ?? "—" },
                        { label: "Registration No.", value: c.registration_number ?? "—" },
                        { label: "Admin email",      value: c.admin_email ?? "—" },
                        { label: "City",             value: c.city ?? "—" },
                        { label: "State",            value: c.state ?? "—" },
                        { label: "Plan",             value: c.plan },
                        { label: "Active doctors",   value: String(c.doctor_count ?? 0) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                          <p className="mt-0.5 font-mono text-xs">{value}</p>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

function StatsRow({ clinics, loading }: { clinics: ClinicRow[]; loading: boolean }) {
  const total    = clinics.length;
  const pending  = clinics.filter((c) => c.verification_status === "PENDING").length;
  const active   = clinics.filter((c) => c.verification_status === "ACTIVE").length;
  const doctors  = clinics.reduce((sum, c) => sum + (c.doctor_count ?? 0), 0);

  const items = [
    { label: "Total institutions", value: total,   colour: "text-foreground" },
    { label: "Pending approval",   value: pending, colour: "text-amber-600 dark:text-amber-400" },
    { label: "Active",             value: active,  colour: "text-green-600 dark:text-green-400" },
    { label: "Doctors on platform",value: doctors, colour: "text-foreground" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, colour }) => (
        <div key={label} className="rounded-xl border bg-card px-5 py-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${loading ? "animate-pulse text-muted" : colour}`}>
            {loading ? "—" : value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PlatformDashboard() {
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchClinics();
      setClinics(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load institutions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pending = clinics.filter((c) => c.verification_status === "PENDING");

  const handleApproved = (id: string, platformId: string) => {
    setClinics((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, verification_status: "ACTIVE", platform_id: platformId }
          : c
      )
    );
  };

  const handleRejected = (id: string) => {
    setClinics((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, verification_status: "SUSPENDED" } : c
      )
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Admin"
        description="Review and approve institution registrations for the Doctor Bridge network."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        <StatsRow clinics={clinics} loading={loading} />

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              {!loading && pending.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">
              All institutions {!loading && `(${clinics.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <PendingTab
              clinics={pending}
              loading={loading}
              onApproved={handleApproved}
              onRejected={handleRejected}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <AllTab clinics={clinics} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
