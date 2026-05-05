import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Search, Stethoscope, MapPin, Languages, CheckCircle2, Send,
  ChevronDown, X, SlidersHorizontal, ArrowUpDown,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DoctorCardsSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CONDITIONS } from "@/lib/conditions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/doctors/")({
  head: () => ({ meta: [{ title: "Find specialists — Doctor Bridge" }] }),
  component: FindDoctors,
});

interface DoctorRow {
  id: string;
  user_id: string;
  nmc_number: string;
  nmc_verified: boolean;
  qualifications: string[];
  sub_specialties: string[];
  condition_codes: string[];
  languages_spoken: string[];
  accepting_referrals: boolean;
  weekly_referral_cap: number;
  current_week_referrals: number;
  avg_response_time_hours: number | null;
  referral_acceptance_rate: number | null;
  total_referrals_received: number;
  teaching_hospital: string | null;
  academic_title: string | null;
  profile: { first_name: string; last_name: string; title: string | null; specialization: string | null; clinic_id: string } | null;
  clinic: { name: string; city: string | null; state: string | null } | null;
}

const DOC_PAGE_SIZE = 12;

const SPECIALTIES = [
  "General Medicine", "Cardiology", "Neurology", "Orthopaedics", "Gynaecology",
  "Paediatrics", "Dermatology", "Psychiatry", "Ophthalmology", "ENT",
  "Urology", "Nephrology", "Gastroenterology", "Pulmonology", "Oncology",
  "Endocrinology", "Radiology", "Anaesthesiology", "Surgery",
] as const;

const LANGUAGES = [
  "Hindi", "English", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Marathi", "Bengali", "Gujarati", "Punjabi", "Odia", "Urdu",
] as const;

type SortKey = "relevance" | "response" | "acceptance" | "capacity";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance",  label: "Relevance"         },
  { value: "response",   label: "Fastest response"  },
  { value: "acceptance", label: "Highest acceptance" },
  { value: "capacity",   label: "Most slots left"   },
];

/* ── Avatar helper ──────────────────────────────────────────── */
const AVATAR_PALETTE = [
  "bg-indigo-500", "bg-violet-500", "bg-teal-600",
  "bg-cyan-600", "bg-emerald-600", "bg-blue-600",
  "bg-rose-500", "bg-amber-600",
];
function avatarColor(initials: string) {
  const code = (initials.charCodeAt(0) || 0) + (initials.charCodeAt(1) || 0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

/* ── Doctor card ────────────────────────────────────────────── */
function DoctorCard({ d, onRefer }: { d: DoctorRow; onRefer: () => void }) {
  const firstName = d.profile?.first_name ?? "";
  const lastName  = d.profile?.last_name  ?? "";
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join("") || "?";
  const remaining = Math.max(0, d.weekly_referral_cap - d.current_week_referrals);
  const full      = !d.accepting_referrals || remaining === 0;
  const limited   = !full && remaining <= 2;
  const pct       = Math.min(100, (d.current_week_referrals / Math.max(1, d.weekly_referral_cap)) * 100);

  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated">
      {/* ── Header: avatar + name + availability ── */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
            avatarColor(initials),
          )}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold leading-tight">
                Dr. {firstName} {lastName}
              </h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {d.profile?.specialization ?? "Specialist"}
              </p>
            </div>

            {/* Availability pill */}
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                full
                  ? "bg-destructive/10 text-destructive"
                  : limited
                    ? "bg-warning/20 text-warning-foreground"
                    : "bg-success/15 text-success-foreground",
              )}
            >
              {full ? "Full" : limited ? "Limited" : "● Available"}
            </span>
          </div>

          {(d.clinic?.name || d.clinic?.city) && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {[d.clinic.name, d.clinic.city].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* ── NMC + qualification badges ── */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {d.nmc_verified && (
          <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success-foreground">
            <CheckCircle2 className="h-3 w-3" /> NMC
          </span>
        )}
        {d.qualifications.slice(0, 2).map((q) => (
          <span key={q} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {q}
          </span>
        ))}
      </div>

      {/* ── Sub-specialties ── */}
      <div className="mt-2.5 flex min-h-[2.5rem] flex-wrap content-start gap-1">
        {d.sub_specialties.slice(0, 4).map((s) => (
          <span key={s} className="rounded-md bg-primary-soft px-2 py-0.5 text-xs text-accent-foreground">
            {s}
          </span>
        ))}
      </div>

      {/* ── Stats ── */}
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
        <dd className="flex items-center gap-1 truncate">
          <Languages className="h-3 w-3 shrink-0" />
          {d.languages_spoken.slice(0, 2).join(", ") || "—"}
        </dd>
        <dd>
          Acceptance:{" "}
          <span className="font-medium text-foreground">
            {d.referral_acceptance_rate != null ? `${d.referral_acceptance_rate}%` : "—"}
          </span>
        </dd>
        <dd>
          Response:{" "}
          <span className="font-medium text-foreground">
            {d.avg_response_time_hours != null ? `${d.avg_response_time_hours}h` : "—"}
          </span>
        </dd>
        <dd>
          Total:{" "}
          <span className="font-medium text-foreground">{d.total_referrals_received}</span>
        </dd>
      </dl>

      {/* ── Capacity bar ── */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Weekly capacity</span>
          <span
            className={cn(
              "font-medium",
              full ? "text-destructive" : limited ? "text-warning-foreground" : "text-foreground",
            )}
          >
            {full
              ? "At capacity"
              : `${remaining} slot${remaining !== 1 ? "s" : ""} left`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              full ? "bg-destructive" : limited ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="mt-4 flex items-center gap-2 border-t pt-4">
        <Button asChild size="sm" variant="outline" className="flex-1">
          <Link to="/doctors/$doctorId" params={{ doctorId: d.id }}>View profile</Link>
        </Button>
        <Button size="sm" className="flex-1" disabled={full} onClick={onRefer}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Refer
        </Button>
      </div>
    </article>
  );
}

/* ── Toggle chip ────────────────────────────────────────────── */
function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────── */
function FindDoctors() {
  const router = useRouter();

  // Server-side filter params
  const [conditionCode, setConditionCode] = useState<string>("ALL");
  const [city, setCity]     = useState("");
  const [search, setSearch] = useState("");

  // Client-side filter / sort params
  const [specialtyFilter,  setSpecialtyFilter]  = useState("ALL");
  const [languageFilter,   setLanguageFilter]   = useState("ALL");
  const [availableOnly,    setAvailableOnly]    = useState(false);
  const [nmcOnly,          setNmcOnly]          = useState(false);
  const [sortBy,           setSortBy]           = useState<SortKey>("relevance");

  // Data
  const [doctors,     setDoctors]     = useState<DoctorRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [offset,      setOffset]      = useState(0);

  const fetchPage = useCallback(async (
    from: number, append: boolean, condition: string, fetchAll = false,
  ) => {
    let q = supabase
      .from("doctor_profiles")
      .select(`
        id,user_id,clinic_id,nmc_number,nmc_verified,qualifications,sub_specialties,condition_codes,
        languages_spoken,accepting_referrals,weekly_referral_cap,current_week_referrals,
        avg_response_time_hours,referral_acceptance_rate,total_referrals_received,
        teaching_hospital,academic_title
      `)
      .eq("is_public", true)
      .order("nmc_verified", { ascending: false });

    if (condition !== "ALL") q = q.contains("condition_codes", [condition]);
    q = fetchAll ? q.range(0, 499) : q.range(from, from + DOC_PAGE_SIZE - 1);

    const { data, error } = await q;
    if (error) { console.error(error); return; }

    const rows = data ?? [];
    setHasMore(rows.length === DOC_PAGE_SIZE);

    const userIds   = Array.from(new Set(rows.map((r: any) => r.user_id)));
    const clinicIds = Array.from(new Set(rows.map((r: any) => r.clinic_id).filter(Boolean)));

    const [profilesRes, clinicsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id,first_name,last_name,title,specialization,clinic_id").in("id", userIds)
        : Promise.resolve({ data: [] } as any),
      clinicIds.length
        ? supabase.from("clinics").select("id,name,city,state").in("id", clinicIds)
        : Promise.resolve({ data: [] } as any),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const clinicMap  = new Map((clinicsRes.data  ?? []).map((c: any) => [c.id, c]));

    const merged: DoctorRow[] = rows.map((r: any) => ({
      ...r,
      profile: profileMap.get(r.user_id)  ?? null,
      clinic:  clinicMap.get(r.clinic_id) ?? null,
    }));

    setDoctors((prev) => append ? [...prev, ...merged] : merged);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOffset(0);
    setDoctors([]);
    const useAll = !!(city.trim() || search.trim());
    fetchPage(0, false, conditionCode, useAll).then(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [conditionCode, city, search, fetchPage]);

  const loadMore = async () => {
    const next = offset + DOC_PAGE_SIZE;
    setLoadingMore(true);
    await fetchPage(next, true, conditionCode, false);
    setOffset(next);
    setLoadingMore(false);
  };

  // Client-side filter + sort
  const filtered = doctors
    .filter((d) => {
      const cityMatch  = !city || (d.clinic?.city ?? "").toLowerCase().includes(city.toLowerCase());
      const term       = search.toLowerCase();
      const name       = `${d.profile?.first_name ?? ""} ${d.profile?.last_name ?? ""}`.toLowerCase();
      const subs       = d.sub_specialties.join(" ").toLowerCase();
      const searchMatch = !term || name.includes(term) || subs.includes(term) || (d.profile?.specialization ?? "").toLowerCase().includes(term);
      const specMatch   = specialtyFilter === "ALL" || (d.profile?.specialization ?? "").toLowerCase().includes(specialtyFilter.toLowerCase());
      const langMatch   = languageFilter === "ALL" || d.languages_spoken.some((l) => l.toLowerCase() === languageFilter.toLowerCase());
      const availMatch  = !availableOnly || (d.accepting_referrals && d.current_week_referrals < d.weekly_referral_cap);
      const nmcMatch    = !nmcOnly || d.nmc_verified;
      return cityMatch && searchMatch && specMatch && langMatch && availMatch && nmcMatch;
    })
    .sort((a, b) => {
      if (sortBy === "response")   return (a.avg_response_time_hours ?? 999) - (b.avg_response_time_hours ?? 999);
      if (sortBy === "acceptance") return (b.referral_acceptance_rate ?? 0)  - (a.referral_acceptance_rate ?? 0);
      if (sortBy === "capacity") {
        const aR = Math.max(0, a.weekly_referral_cap - a.current_week_referrals);
        const bR = Math.max(0, b.weekly_referral_cap - b.current_week_referrals);
        return bR - aR;
      }
      return 0;
    });

  // Active filter count (for badge)
  const activeFilterCount = [
    conditionCode !== "ALL",
    specialtyFilter !== "ALL",
    city.trim() !== "",
    search.trim() !== "",
    languageFilter !== "ALL",
    availableOnly,
    nmcOnly,
  ].filter(Boolean).length;

  const clearAll = () => {
    setConditionCode("ALL");
    setSpecialtyFilter("ALL");
    setCity("");
    setSearch("");
    setLanguageFilter("ALL");
    setAvailableOnly(false);
    setNmcOnly(false);
    setSortBy("relevance");
  };

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <PageHeader
          title="Find specialists"
          description="Search verified doctors by condition, sub-specialty, or city."
        />

        {/* ── Filter bar ── */}
        <div className="mb-4 space-y-3 rounded-xl border bg-card p-4 shadow-card">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Condition */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Condition (ICD-10)</label>
              <Select value={conditionCode} onValueChange={setConditionCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="ALL">All conditions</SelectItem>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Specialty */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Specialty</label>
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger><SelectValue placeholder="All specialties" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="ALL">All specialties</SelectItem>
                  {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* City */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">City</label>
              <Input
                placeholder="e.g. Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            {/* Name/sub-specialty */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name or sub-specialty</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="e.g. Sharma, Echo"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── Quick filters row ── */}
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

            <Chip active={availableOnly} onClick={() => setAvailableOnly((v) => !v)}>
              ● Available only
            </Chip>
            <Chip active={nmcOnly} onClick={() => setNmcOnly((v) => !v)}>
              <CheckCircle2 className="h-3 w-3" /> NMC verified
            </Chip>

            {/* Language */}
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="h-7 w-auto gap-1.5 rounded-full border px-3 text-xs font-medium">
                <Languages className="h-3 w-3" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any language</SelectItem>
                {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear all
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">{activeFilterCount}</Badge>
              </button>
            )}

            {/* Sort — pushed to right */}
            <div className="ml-auto flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="h-7 w-auto gap-1.5 rounded-full border px-3 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Result count ── */}
        {!loading && (
          <p className="mb-4 text-sm text-muted-foreground">
            {filtered.length === 0
              ? "No specialists match your filters"
              : `${filtered.length} specialist${filtered.length !== 1 ? "s" : ""} found`}
          </p>
        )}

        {/* ── Content ── */}
        {loading ? (
          <DoctorCardsSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No specialists match your filters"
            description="Try turning off 'Available only', clearing the city, or broadening your condition filter."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d) => (
                <DoctorCard
                  key={d.id}
                  d={d}
                  onRefer={() => router.navigate({ to: "/referrals/new", search: { specialistId: d.id } })}
                />
              ))}
            </div>

            {hasMore && !city.trim() && !search.trim() && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1.5 h-4 w-4" />
                      Load more specialists
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </DashboardLayout>
    </ErrorBoundary>
  );
}
