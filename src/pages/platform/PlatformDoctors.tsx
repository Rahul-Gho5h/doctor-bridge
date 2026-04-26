/**
 * PlatformDoctors — /platform/doctors
 *
 * Platform-wide view of all doctors onboarded through hospital admins.
 * Shows onboarding timeline, verification status, and profile details.
 * Supports filter by institution, verification status, sort by multiple
 * columns, and grouped-by-institution view.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown, Award, BadgeCheck, Building2, ChevronDown,
  ChevronUp, Clock, LayoutList, Mail, Phone, RefreshCw, Search,
  Shield, ShieldAlert, Stethoscope, User, Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

type SortKey =
  | "name_asc" | "name_desc"
  | "joined_newest" | "joined_oldest"
  | "referrals_desc" | "referrals_asc"
  | "completeness_desc"
  | "specialty_asc"
  | "institution_asc"
  | "verified_first";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "joined_newest",    label: "Joined — Newest first" },
  { value: "joined_oldest",    label: "Joined — Oldest first" },
  { value: "name_asc",         label: "Name — A → Z" },
  { value: "name_desc",        label: "Name — Z → A" },
  { value: "institution_asc",  label: "Institution — A → Z" },
  { value: "referrals_desc",   label: "Referrals — High → Low" },
  { value: "referrals_asc",    label: "Referrals — Low → High" },
  { value: "completeness_desc",label: "Profile completeness — High → Low" },
  { value: "specialty_asc",    label: "Specialty — A → Z" },
  { value: "verified_first",   label: "Verified first" },
];

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

function applySortKey(a: DoctorRow, b: DoctorRow, key: SortKey): number {
  switch (key) {
    case "name_asc":
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    case "name_desc":
      return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`);
    case "joined_newest":
      return new Date(b.joined_hospital_at ?? b.created_at).getTime() - new Date(a.joined_hospital_at ?? a.created_at).getTime();
    case "joined_oldest":
      return new Date(a.joined_hospital_at ?? a.created_at).getTime() - new Date(b.joined_hospital_at ?? b.created_at).getTime();
    case "referrals_desc":
      return (b.total_referrals_received ?? 0) - (a.total_referrals_received ?? 0);
    case "referrals_asc":
      return (a.total_referrals_received ?? 0) - (b.total_referrals_received ?? 0);
    case "completeness_desc":
      return (b.profile_completeness ?? 0) - (a.profile_completeness ?? 0);
    case "specialty_asc":
      return (a.specialization ?? "").localeCompare(b.specialization ?? "");
    case "institution_asc":
      return (a.hospital_name ?? "zzz").localeCompare(b.hospital_name ?? "zzz");
    case "verified_first":
      return (b.nmc_verified ? 1 : 0) - (a.nmc_verified ? 1 : 0);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function DoctorDetail({ d }: { d: DoctorRow }) {
  const timeline: Array<{ label: string; date: string | null; icon: React.ReactNode }> = [
    { label: "Profile created",  date: d.created_at,        icon: <User      className="h-3.5 w-3.5" /> },
    { label: "Joined hospital",  date: d.joined_hospital_at, icon: <Building2 className="h-3.5 w-3.5" /> },
    { label: "NMC verified",     date: d.nmc_verified_at,    icon: <BadgeCheck className="h-3.5 w-3.5" /> },
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
// Doctor table row (shared between flat and grouped views)
// ---------------------------------------------------------------------------

function DoctorTableRow({
  d, colSpan, expanded, onToggle,
}: {
  d: DoctorRow;
  colSpan: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="font-medium">{d.first_name} {d.last_name}</div>
          <div className="text-xs text-muted-foreground">{d.email}</div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          <div>{d.specialization || d.sub_specialties[0] || "—"}</div>
          {d.sub_specialties.length > 1 && (
            <div className="text-xs text-muted-foreground/70">{d.sub_specialties.slice(0, 2).join(", ")}</div>
          )}
        </td>
        <td className="px-4 py-3">
          {d.hospital_name ? (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate max-w-[160px]">{d.hospital_name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Independent</span>
          )}
        </td>
        <td className="px-4 py-3">
          <VerBadge verified={d.nmc_verified} />
        </td>
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {fmt(d.joined_hospital_at ?? d.created_at)}
          </div>
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
        <td className="px-4 py-3 font-medium text-center">{d.total_referrals_received ?? 0}</td>
        <td className="px-4 py-3 text-center">
          <span className={`text-xs font-semibold ${(d.profile_completeness ?? 0) >= 80 ? "text-green-600" : (d.profile_completeness ?? 0) >= 50 ? "text-amber-600" : "text-rose-500"}`}>
            {d.profile_completeness ?? 0}%
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground inline" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground inline" />}
        </td>
      </tr>
      {expanded && (
        <tr key={`${d.user_id}-detail`}>
          <td colSpan={colSpan} className="p-0">
            <DoctorDetail d={d} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Table header
// ---------------------------------------------------------------------------

const TABLE_COLS = 9;

function TableHead() {
  return (
    <thead>
      <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <th className="px-4 py-3 text-left">Doctor</th>
        <th className="px-4 py-3 text-left">Specialty</th>
        <th className="px-4 py-3 text-left">Institution</th>
        <th className="px-4 py-3 text-left">NMC Status</th>
        <th className="px-4 py-3 text-left">Onboarded</th>
        <th className="px-4 py-3 text-left">Method</th>
        <th className="px-4 py-3 text-center">Referrals</th>
        <th className="px-4 py-3 text-center">Complete</th>
        <th className="px-4 py-3" />
      </tr>
    </thead>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PlatformDoctors() {
  const [doctors, setDoctors]   = useState<DoctorRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters & sort
  const [query, setQuery]                   = useState("");
  const [verFilter, setVerFilter]           = useState<"all" | "verified" | "unverified">("all");
  const [institutionFilter, setInstFilter]  = useState<string>("all");  // "all" | hospital_id | "independent"
  const [sortKey, setSortKey]               = useState<SortKey>("joined_newest");
  const [grouped, setGrouped]               = useState(false);

  // ── Data fetch ─────────────────────────────────────────────────────────────

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
      if (!dpRows || dpRows.length === 0) { setDoctors([]); setLoading(false); return; }

      const userIds = dpRows.map((r) => r.user_id);

      const [{ data: profileRows }, { data: linkRows }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, email, phone, specialization").in("id", userIds),
        supabase.from("hospital_doctor_links")
          .select("doctor_user_id, hospital_clinic_id, status, clinics(id, name, entity_type)")
          .in("doctor_user_id", userIds)
          .eq("status", "ACTIVE"),
      ]);

      const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));
      const linkMap    = new Map((linkRows ?? []).map((l) => [l.doctor_user_id, l]));

      const rows: DoctorRow[] = dpRows.map((dp) => {
        const prof = profileMap.get(dp.user_id);
        const link = linkMap.get(dp.user_id);
        return {
          ...dp,
          sub_specialties: (dp as any).sub_specialties ?? [],
          qualifications:  (dp as any).qualifications ?? [],
          first_name: prof?.first_name ?? "—",
          last_name:  prof?.last_name ?? "",
          email:      prof?.email ?? "—",
          phone:      prof?.phone ?? null,
          specialization: (prof as any)?.specialization ?? null,
          hospital_name: (link as any)?.clinics?.name ?? null,
          hospital_id:   link?.hospital_clinic_id ?? null,
          onboarding_method: link
            ? "admin_created"
            : dp.nmc_number
              ? "self_registered"
              : "unknown",
        };
      });

      setDoctors(rows);
    } catch (e: any) {
      setError(e.message ?? "Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  // ── Institution list derived from data ─────────────────────────────────────

  const institutionOptions = useMemo(() => {
    const seen = new Map<string, string>(); // id → name
    doctors.forEach((d) => {
      if (d.hospital_id && d.hospital_name) seen.set(d.hospital_id, d.hospital_name);
    });
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [doctors]);

  // ── Filtered + sorted list ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let res = doctors.filter((d) => {
      // text search
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
      // verification filter
      if (verFilter === "verified"   && !d.nmc_verified) return false;
      if (verFilter === "unverified" &&  d.nmc_verified) return false;
      // institution filter
      if (institutionFilter === "independent" && d.hospital_id !== null) return false;
      if (institutionFilter !== "all" && institutionFilter !== "independent" && d.hospital_id !== institutionFilter) return false;
      return true;
    });

    // sort
    res = [...res].sort((a, b) => applySortKey(a, b, sortKey));
    return res;
  }, [query, verFilter, institutionFilter, sortKey, doctors]);

  // ── Grouped structure (institution → doctors[]) ────────────────────────────

  const groups = useMemo<Array<{ key: string; label: string; rows: DoctorRow[] }>>(() => {
    if (!grouped) return [];
    const map = new Map<string, DoctorRow[]>();
    filtered.forEach((d) => {
      const key = d.hospital_id ?? "__independent__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries())
      .map(([key, rows]) => ({
        key,
        label: key === "__independent__" ? "Independent / Unaffiliated" : (rows[0].hospital_name ?? key),
        rows,
      }))
      .sort((a, b) => {
        if (a.key === "__independent__") return 1;
        if (b.key === "__independent__") return -1;
        return a.label.localeCompare(b.label);
      });
  }, [grouped, filtered]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total:        doctors.length,
    verified:     doctors.filter((d) => d.nmc_verified).length,
    institutions: institutionOptions.length,
    accepting:    doctors.filter((d) => d.accepting_referrals).length,
  };

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  // ── Render ─────────────────────────────────────────────────────────────────

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
          { label: "Total doctors",       value: stats.total,        icon: <Users      className="h-4 w-4" /> },
          { label: "NMC verified",        value: stats.verified,     icon: <BadgeCheck className="h-4 w-4 text-green-600" /> },
          { label: "Institutions",        value: stats.institutions,  icon: <Building2  className="h-4 w-4 text-blue-600" /> },
          { label: "Accepting referrals", value: stats.accepting,    icon: <Stethoscope className="h-4 w-4 text-purple-600" /> },
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

      {/* Filter + sort bar */}
      <div className="mb-4 space-y-3">
        {/* Row 1 — search + institution + verification */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, specialty, hospital, NMC…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Institution filter */}
          <Select value={institutionFilter} onValueChange={setInstFilter}>
            <SelectTrigger className="h-9 w-full sm:w-56 text-sm">
              <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="All institutions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All institutions</SelectItem>
              {institutionOptions.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
              <SelectItem value="independent">Independent / Unaffiliated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 2 — verification pills + sort + group toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Verification filter pills */}
          <div className="flex gap-1.5">
            {(["all", "verified", "unverified"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={verFilter === v ? "default" : "outline"}
                onClick={() => setVerFilter(v)}
                className="h-8 text-xs"
              >
                {v === "all" ? "All" : v === "verified" ? "✓ Verified" : "⚠ Unverified"}
              </Button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-auto min-w-[210px] text-xs gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Group by institution toggle */}
          <Button
            size="sm"
            variant={grouped ? "default" : "outline"}
            className="h-8 gap-1.5 text-xs"
            onClick={() => setGrouped((g) => !g)}
            title="Group doctors by institution"
          >
            <LayoutList className="h-3.5 w-3.5" />
            Group by institution
          </Button>
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
      ) : grouped ? (
        /* ── Grouped view ── */
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.key} className="rounded-xl border bg-card overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-semibold text-sm">{group.label}</span>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {group.rows.length} doctor{group.rows.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <TableHead />
                  <tbody className="divide-y">
                    {group.rows.map((d) => (
                      <DoctorTableRow
                        key={d.user_id}
                        d={d}
                        colSpan={TABLE_COLS}
                        expanded={expanded === d.user_id}
                        onToggle={() => toggle(d.user_id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="text-right text-xs text-muted-foreground pr-1">
            Showing {filtered.length} of {doctors.length} doctors across {groups.length} institution{groups.length !== 1 ? "s" : ""}
          </div>
        </div>
      ) : (
        /* ── Flat view ── */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHead />
              <tbody className="divide-y">
                {filtered.map((d) => (
                  <DoctorTableRow
                    key={d.user_id}
                    d={d}
                    colSpan={TABLE_COLS}
                    expanded={expanded === d.user_id}
                    onToggle={() => toggle(d.user_id)}
                  />
                ))}
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
