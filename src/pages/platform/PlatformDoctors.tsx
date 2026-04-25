/**
 * PlatformDoctors — /platform/doctors
 *
 * Platform-wide view of all doctors onboarded through hospital admins.
 * Shows onboarding timeline, verification status, and profile details.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Award, BadgeCheck, Building2, Calendar, ChevronDown, ChevronUp,
  Clock, Mail, Phone, RefreshCw, Search, Shield, ShieldAlert,
  Stethoscope, User, Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DoctorRow {
  user_id: string;
  sub_specialties: string[];
  qualifications: string[];
  nmc_number: string | null;
  nmc_verified: boolean | null;
  nmc_verified_at: string | null;
  is_public: boolean | null;
  accepting_referrals: boolean | null;
  profile_completeness: number | null;
  total_referrals_received: number | null;
  joined_hospital_at: string | null;
  created_at: string;
  // enriched from profiles
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  specialization: string | null;
  // enriched from hospital_doctor_links
  hospital_name: string | null;
  hospital_id: string | null;
  onboarding_method: "admin_created" | "self_registered" | "unknown";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function VerBadge({ verified }: { verified: boolean | null }) {
  if (verified) return (
    <Badge className="gap-1 bg-green-100 text-green-700 border-green-200">
      <BadgeCheck className="h-3 w-3" /> Verified
    </Badge>
  );
  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
      <ShieldAlert className="h-3 w-3" /> Unverified
    </Badge>
  );
}

function StatusDot({ active }: { active: boolean | null }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${active ? "bg-green-500" : "bg-gray-300"}`} />
  );
}

// ---------------------------------------------------------------------------
// Expandable detail panel
// ---------------------------------------------------------------------------

function DoctorDetail({ d }: { d: DoctorRow }) {
  const timeline: Array<{ label: string; date: string | null; icon: React.ReactNode }> = [
    { label: "Profile created", date: d.created_at, icon: <User className="h-3.5 w-3.5" /> },
    { label: "Joined hospital", date: d.joined_hospital_at, icon: <Building2 className="h-3.5 w-3.5" /> },
    { label: "NMC verified", date: d.nmc_verified_at, icon: <BadgeCheck className="h-3.5 w-3.5" /> },
  ].filter((t) => t.date);

  return (
    <div className="grid grid-cols-1 gap-6 p-4 bg-muted/30 md:grid-cols-3">
      {/* Profile */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{d.email}</span>
          </div>
          {d.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{d.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{[d.specialization, ...d.sub_specialties].filter(Boolean).join(" · ") || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{d.qualifications.length > 0 ? d.qualifications.join(", ") : "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span>NMC: {d.nmc_number || "—"}</span>
          </div>
        </div>
      </div>

      {/* Status flags */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status flags</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">NMC verified</span>
            <VerBadge verified={d.nmc_verified} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Public profile</span>
            <div className="flex items-center gap-1.5">
              <StatusDot active={d.is_public} />
              <span>{d.is_public ? "Yes" : "No"}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Accepting referrals</span>
            <div className="flex items-center gap-1.5">
              <StatusDot active={d.accepting_referrals} />
              <span>{d.accepting_referrals ? "Yes" : "No"}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Profile completeness</span>
            <span className="font-semibold">{d.profile_completeness ?? 0}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Referrals received</span>
            <span className="font-semibold">{d.total_referrals_received ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Onboarding method</span>
            <Badge variant="outline" className="capitalize text-xs">
              {d.onboarding_method === "admin_created"
                ? "Admin created"
                : d.onboarding_method === "self_registered"
                  ? "Self-registered"
                  : "Unknown"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Onboarding timeline */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Onboarding timeline</p>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline events yet.</p>
        ) : (
          <ol className="relative ml-1 space-y-3 border-l border-muted-foreground/20 pl-4">
            {timeline.map((t) => (
              <li key={t.label} className="space-y-0.5">
                <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-border bg-background flex items-center justify-center text-muted-foreground">
                  {t.icon}
                </div>
                <p className="text-xs font-medium">{t.label}</p>
                <p className="text-[11px] text-muted-foreground">{fmtTime(t.date ?? null)}</p>
              </li>
            ))}
          </ol>
        )}
        {d.hospital_name && (
          <div className="mt-3 rounded-md border border-muted bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">Institution: </span>
            <span className="font-medium">{d.hospital_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PlatformDoctors() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [filtered, setFiltered] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [verFilter, setVerFilter] = useState<"all" | "verified" | "unverified">("all");

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all doctor_profiles
      const { data: dpRows, error: dpErr } = await supabase
        .from("doctor_profiles")
        .select(`
          user_id, sub_specialties, qualifications,
          nmc_number, nmc_verified, nmc_verified_at,
          is_public, accepting_referrals, profile_completeness,
          total_referrals_received, joined_hospital_at, created_at
        `)
        .order("created_at", { ascending: false });

      if (dpErr) throw dpErr;
      if (!dpRows || dpRows.length === 0) { setDoctors([]); setFiltered([]); setLoading(false); return; }

      const userIds = dpRows.map((r) => r.user_id);

      // 2. Fetch profiles for name/email/phone
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, specialization")
        .in("id", userIds);

      // 3. Fetch hospital links (active)
      const { data: linkRows } = await supabase
        .from("hospital_doctor_links")
        .select("doctor_user_id, hospital_clinic_id, status, clinics(name)")
        .in("doctor_user_id", userIds)
        .eq("status", "ACTIVE");

      const profileMap = new Map(
        (profileRows ?? []).map((p) => [p.id, p])
      );
      const linkMap = new Map(
        (linkRows ?? []).map((l) => [l.doctor_user_id, l])
      );

      const rows: DoctorRow[] = dpRows.map((dp) => {
        const prof = profileMap.get(dp.user_id);
        const link = linkMap.get(dp.user_id);
        return {
          ...dp,
          sub_specialties: (dp as any).sub_specialties ?? [],
          qualifications: (dp as any).qualifications ?? [],
          first_name: prof?.first_name ?? "—",
          last_name: prof?.last_name ?? "",
          email: prof?.email ?? "—",
          phone: prof?.phone ?? null,
          specialization: (prof as any)?.specialization ?? null,
          hospital_name: (link as any)?.clinics?.name ?? null,
          hospital_id: link?.hospital_clinic_id ?? null,
          onboarding_method: link
            ? "admin_created"
            : dp.nmc_number
              ? "self_registered"
              : "unknown",
        };
      });

      setDoctors(rows);
      setFiltered(rows);
    } catch (e: any) {
      setError(e.message ?? "Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  // Apply search + verification filter
  useEffect(() => {
    const q = query.toLowerCase();
    let res = doctors.filter((d) => {
      if (q) {
        const name = `${d.first_name} ${d.last_name}`.toLowerCase();
        if (
          !name.includes(q) &&
          !d.email.toLowerCase().includes(q) &&
          !(d.specialization ?? "").toLowerCase().includes(q) &&
          !d.sub_specialties.some((s) => s.toLowerCase().includes(q)) &&
          !(d.hospital_name ?? "").toLowerCase().includes(q) &&
          !(d.nmc_number ?? "").toLowerCase().includes(q)
        ) return false;
      }
      if (verFilter === "verified" && !d.nmc_verified) return false;
      if (verFilter === "unverified" && d.nmc_verified) return false;
      return true;
    });
    setFiltered(res);
  }, [query, verFilter, doctors]);

  const stats = {
    total: doctors.length,
    verified: doctors.filter((d) => d.nmc_verified).length,
    adminCreated: doctors.filter((d) => d.onboarding_method === "admin_created").length,
    accepting: doctors.filter((d) => d.accepting_referrals).length,
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Doctors"
        subtitle="All doctors onboarded across the platform"
        action={
          <Button variant="outline" size="sm" onClick={fetchDoctors} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total doctors", value: stats.total, icon: <Users className="h-4 w-4" /> },
          { label: "NMC verified", value: stats.verified, icon: <BadgeCheck className="h-4 w-4 text-green-600" /> },
          { label: "Admin created", value: stats.adminCreated, icon: <Building2 className="h-4 w-4 text-blue-600" /> },
          { label: "Accepting referrals", value: stats.accepting, icon: <Stethoscope className="h-4 w-4 text-purple-600" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {s.icon}
            </div>
            <div>
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, specialty, hospital, NMC…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "verified", "unverified"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={verFilter === v ? "default" : "outline"}
              onClick={() => setVerFilter(v)}
              className="capitalize"
            >
              {v === "all" ? "All" : v === "verified" ? "Verified" : "Unverified"}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          No doctors found matching your filters.
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Doctor</th>
                  <th className="px-4 py-3 text-left">Specialty</th>
                  <th className="px-4 py-3 text-left">Institution</th>
                  <th className="px-4 py-3 text-left">NMC Status</th>
                  <th className="px-4 py-3 text-left">Onboarded</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Referrals</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((d) => {
                  const open = expanded === d.user_id;
                  return [
                    <tr
                      key={d.user_id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setExpanded(open ? null : d.user_id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{d.first_name} {d.last_name}</div>
                        <div className="text-xs text-muted-foreground">{d.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.specialization || d.sub_specialties[0] || "—"}
                        {d.sub_specialties.length > 1 && (
                          <div className="text-xs text-muted-foreground/70">{d.sub_specialties.slice(0, 2).join(", ")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {d.hospital_name ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{d.hospital_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Independent</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <VerBadge verified={d.nmc_verified} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmt(d.joined_hospital_at ?? d.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {d.onboarding_method === "admin_created"
                            ? "Admin"
                            : d.onboarding_method === "self_registered"
                              ? "Self"
                              : "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{d.total_referrals_received ?? 0}</td>
                      <td className="px-4 py-3">
                        {open
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </td>
                    </tr>,
                    open && (
                      <tr key={`${d.user_id}-detail`}>
                        <td colSpan={8} className="p-0">
                          <DoctorDetail d={d} />
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            Showing {filtered.length} of {doctors.length} doctors
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
