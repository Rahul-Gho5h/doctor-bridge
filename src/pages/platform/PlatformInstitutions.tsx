/**
 * PlatformInstitutions — /platform/institutions
 *
 * Full institution management for platform auditors.
 * Shows all registered hospitals/clinics with per-institution analytics,
 * registration details, and document records.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, Building2, CheckCircle2, ChevronDown, ChevronUp,
  Clock, FileText, Image, Info, Phone, Mail, MapPin,
  RefreshCw, Stethoscope, Users, Wrench, X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
type EntityType = "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "DIAGNOSTIC_CENTER";

interface ClinicFull {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  entity_type: EntityType | null;
  gst_number: string | null;
  registration_number: string | null;
  license_number: string | null;
  logo: string | null;
  equipment: string[] | null;
  working_hours: { text?: string } | null;
  verification_status: VerificationStatus | null;
  platform_id: string | null;
  plan: string;
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
  is_active: boolean;
  // enriched
  admin_email?: string | null;
  admin_name?: string | null;
  doctor_count?: number;
  referral_count?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_LABELS: Record<string, string> = {
  HOSPITAL: "Hospital", CLINIC: "Clinic",
  NURSING_HOME: "Nursing Home", DIAGNOSTIC_CENTER: "Diagnostic Center",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: VerificationStatus | null }) {
  if (status === "ACTIVE")
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"><CheckCircle2 className="h-3 w-3" />Active</span>;
  if (status === "SUSPENDED")
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400"><AlertCircle className="h-3 w-3" />Suspended</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"><Clock className="h-3 w-3" />Pending</span>;
}

function MetaField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xs ${mono ? "font-mono" : ""} text-foreground`}>{value || "—"}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline detail panel
// ---------------------------------------------------------------------------

function InstitutionDetail({ clinic, onUpdate }: { clinic: ClinicFull; onUpdate: () => void }) {
  const equipment = Array.isArray(clinic.equipment) ? clinic.equipment as string[] : [];
  const isImageUrl = (url: string) => /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url) || url.startsWith("data:image");
  const [updating, setUpdating] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const handleUpdate = async (status: "ACTIVE" | "DECLINED") => {
    if (status === "DECLINED" && !declineReason) {
      toast.error("Please provide a reason for declining.");
      return;
    }
    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-approve-clinic", {
        body: { clinicId: clinic.id, status, reason: declineReason }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      toast.success(`Institution ${status === "ACTIVE" ? "approved" : "declined"} successfully. Email sent.`);
      setDeclineReason("");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update institution status.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="border-t bg-muted/20 px-6 py-6">
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Col 1: Identity & contact ── */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Registration details
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <MetaField label="Platform ID"      value={clinic.platform_id ?? "Not assigned"} mono />
            <MetaField label="GST Number"       value={clinic.gst_number ?? ""} mono />
            <MetaField label="Reg. Number"      value={clinic.registration_number ?? ""} mono />
            <MetaField label="License Number"   value={clinic.license_number ?? ""} mono />
            <MetaField label="Plan"             value={clinic.plan} />
            <MetaField label="Verified at"      value={fmt(clinic.verified_at)} />
            <MetaField label="Verified by"      value={clinic.verified_by ?? ""} />
            <MetaField label="Status"           value={clinic.verification_status ?? "PENDING"} />
          </div>

          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
            <Phone className="h-3.5 w-3.5" /> Contact
          </h4>
          <div className="space-y-1.5 text-xs">
            {clinic.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{clinic.email}</span>
              </div>
            )}
            {clinic.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{clinic.phone}</span>
              </div>
            )}
            {(clinic.address || clinic.city) && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{[clinic.address, clinic.city, clinic.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {clinic.admin_email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Admin: <span className="font-mono">{clinic.admin_email}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* ── Col 2: Activity & equipment ── */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Stethoscope className="h-3.5 w-3.5" /> Activity
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-bold">{clinic.doctor_count ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active doctors</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-bold">{clinic.referral_count ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Referrals sent</p>
            </div>
          </div>

          {clinic.working_hours?.text && (
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <Clock className="h-3.5 w-3.5" /> Working hours
              </h4>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">{clinic.working_hours.text}</p>
            </div>
          )}

          {equipment.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <Wrench className="h-3.5 w-3.5" /> Equipment
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {equipment.map((eq) => (
                  <span key={eq} className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">{eq}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Col 3: Documents ── */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Registration documents
          </h4>

          {/* Logo / letterhead */}
          {clinic.logo ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Institution logo / letterhead</p>
              {isImageUrl(clinic.logo) ? (
                <div className="overflow-hidden rounded-lg border bg-white p-3">
                  <img
                    src={clinic.logo}
                    alt={`${clinic.name} logo`}
                    className="max-h-24 max-w-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ) : (
                <a
                  href={clinic.logo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-primary hover:underline"
                >
                  <Image className="h-3.5 w-3.5" />
                  View uploaded file
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-center">
              <Image className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No logo uploaded</p>
            </div>
          )}

          {/* Textual registration records */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identity records on file</p>
            {[
              { label: "GST Certificate",         value: clinic.gst_number,          field: "GST Number" },
              { label: "Registration Certificate", value: clinic.registration_number, field: "Reg. No." },
              { label: "License",                  value: clinic.license_number,      field: "License No." },
            ].map(({ label, value, field }) => (
              <div key={label} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                {value ? (
                  <span className="font-mono text-[10px] text-muted-foreground">{value}</span>
                ) : (
                  <span className="text-[10px] italic text-muted-foreground/60">Not provided</span>
                )}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground italic">
            File document upload for registration certificates will be available once the hospital admin uploads them via their portal.
          </p>
        </div>
      </div>

      {clinic.verification_status === "PENDING" && (
        <div className="mt-8 border-t border-border/50 pt-6">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            <CheckCircle2 className="h-3.5 w-3.5" /> Administrative Actions
          </h4>
          <div className="flex flex-col gap-4 max-w-lg">
            <div className="flex gap-3">
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white" 
                onClick={() => handleUpdate("ACTIVE")}
                disabled={updating}
              >
                {updating ? "Processing..." : "Approve Institution"}
              </Button>
            </div>
            <div className="flex gap-3">
              <Input 
                placeholder="Reason for declining..." 
                value={declineReason} 
                onChange={(e) => setDeclineReason(e.target.value)}
                disabled={updating}
              />
              <Button 
                variant="destructive" 
                onClick={() => handleUpdate("DECLINED")}
                disabled={updating}
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function PlatformInstitutions() {
  const [clinics, setClinics]   = useState<ClinicFull[]>([]);
  const [filtered, setFiltered] = useState<ClinicFull[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clinicData, error } = await supabase
        .from("clinics")
        .select("id,name,slug,email,phone,address,city,state,entity_type,gst_number,registration_number,license_number,logo,equipment,working_hours,verification_status,platform_id,plan,created_at,verified_at,verified_by,is_active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (clinicData ?? []) as ClinicFull[];
      if (rows.length === 0) { setClinics([]); setFiltered([]); return; }

      const clinicIds = rows.map((r) => r.id);

      // admin users
      const { data: roleRows } = await supabase
        .from("user_roles").select("user_id,clinic_id").eq("role", "clinic_admin").in("clinic_id", clinicIds);
      const adminUserIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id))];
      const clinicAdminMap = new Map<string, string>(); // clinic_id → user_id
      for (const r of roleRows ?? []) if (!clinicAdminMap.has((r as any).clinic_id)) clinicAdminMap.set((r as any).clinic_id, (r as any).user_id);

      const { data: adminProfiles } = adminUserIds.length
        ? await supabase.from("profiles").select("id,first_name,last_name,email").in("id", adminUserIds)
        : { data: [] as any[] };
      const profileMap = new Map<string, any>((adminProfiles ?? []).map((p: any) => [p.id, p]));

      // doctor counts
      const { data: links } = await supabase
        .from("hospital_doctor_links").select("hospital_clinic_id").eq("status", "ACTIVE").in("hospital_clinic_id", clinicIds);
      const docCountMap = new Map<string, number>();
      for (const l of links ?? []) docCountMap.set((l as any).hospital_clinic_id, (docCountMap.get((l as any).hospital_clinic_id) ?? 0) + 1);

      // referral counts by originating clinic
      const { data: refs } = await supabase
        .from("referrals").select("originating_clinic_id").in("originating_clinic_id", clinicIds);
      const refCountMap = new Map<string, number>();
      for (const r of refs ?? []) refCountMap.set((r as any).originating_clinic_id, (refCountMap.get((r as any).originating_clinic_id) ?? 0) + 1);

      const enriched: ClinicFull[] = rows.map((c) => {
        const adminUserId = clinicAdminMap.get(c.id);
        const adminProfile = adminUserId ? profileMap.get(adminUserId) : null;
        return {
          ...c,
          equipment: Array.isArray(c.equipment) ? c.equipment : (c.equipment ? Object.values(c.equipment as object) : []),
          working_hours: c.working_hours as any,
          admin_email: adminProfile?.email ?? null,
          admin_name:  adminProfile ? `${adminProfile.first_name} ${adminProfile.last_name}` : null,
          doctor_count:  docCountMap.get(c.id) ?? 0,
          referral_count: refCountMap.get(c.id) ?? 0,
        };
      });

      setClinics(enriched);
      setFiltered(enriched);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load institutions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q
      ? clinics.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.state?.toLowerCase().includes(q) ||
          c.platform_id?.toLowerCase().includes(q) ||
          c.gst_number?.toLowerCase().includes(q)
        )
      : clinics
    );
  }, [search, clinics]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Institutions"
        description="Full registry of all onboarded and pending institutions on Doctor Bridge."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Search */}
        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city, platform ID, GST…"
            className="max-w-sm h-9"
          />
          {!loading && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} of {clinics.length} institutions
            </span>
          )}
        </div>

        {loading ? <TableSkeleton columns={8} rows={6} /> : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Platform ID</th>
                  <th className="px-4 py-3 text-left">Institution</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Doctors</th>
                  <th className="px-4 py-3 text-center">Referrals</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Registered</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">No institutions found.</td></tr>
                )}
                {filtered.map((c) => (
                  <>
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.platform_id ?? <span className="italic">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.entity_type ? ENTITY_LABELS[c.entity_type] : "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.verification_status} /></td>
                      <td className="px-4 py-3 text-center font-semibold">{c.doctor_count ?? 0}</td>
                      <td className="px-4 py-3 text-center font-semibold">{c.referral_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] font-normal">{c.plan}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(c.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId((p) => p === c.id ? null : c.id)}>
                          {expandedId === c.id
                            ? <><ChevronUp className="mr-1 h-3.5 w-3.5" />Close</>
                            : <><ChevronDown className="mr-1 h-3.5 w-3.5" />Details</>}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={9} className="p-0">
                          <InstitutionDetail clinic={c} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
