import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Search, Stethoscope, MapPin, Languages, CheckCircle2, Send, ChevronDown } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DoctorCardsSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CONDITIONS } from "@/lib/conditions";

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

function FindDoctors() {
  const router = useRouter();
  const [conditionCode, setConditionCode] = useState<string>("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState("ALL");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchPage = useCallback(async (from: number, append: boolean, condition: string, fetchAll = false) => {
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
    if (fetchAll) {
      q = q.range(0, 499); // fetch up to 500 when text-filtering
    } else {
      q = q.range(from, from + DOC_PAGE_SIZE - 1);
    }
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

  // Reset + reload when any filter changes
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

  // When city/search/specialty active we already fetched all — filter in-memory for instant UX
  const filtered = doctors.filter((d) => {
    const cityMatch = !city || (d.clinic?.city ?? "").toLowerCase().includes(city.toLowerCase());
    const term = search.toLowerCase();
    const name = `${d.profile?.first_name ?? ""} ${d.profile?.last_name ?? ""}`.toLowerCase();
    const subs = d.sub_specialties.join(" ").toLowerCase();
    const searchMatch = !term || name.includes(term) || subs.includes(term) || (d.profile?.specialization ?? "").toLowerCase().includes(term);
    const specMatch = specialtyFilter === "ALL" || (d.profile?.specialization ?? "").toLowerCase().includes(specialtyFilter.toLowerCase());
    return cityMatch && searchMatch && specMatch;
  });

  return (
    <ErrorBoundary>
    <DashboardLayout>
      <PageHeader
        title="Find specialists"
        description="Search verified doctors by condition, sub-specialty, or city."
      />

      <div className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4">
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
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Specialty</label>
          <div className="flex gap-1.5">
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="All specialties" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="ALL">All specialties</SelectItem>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {specialtyFilter !== "ALL" && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setSpecialtyFilter("ALL")}
                title="Clear specialty filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">City</label>
          <Input placeholder="e.g. Mumbai" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name or sub-specialty</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="e.g. Sharma, Echo" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <DoctorCardsSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={conditionCode !== "ALL" || specialtyFilter !== "ALL" || city || search ? "No specialists match your filters" : "No specialists yet"}
          description={
            conditionCode !== "ALL" || specialtyFilter !== "ALL" || city || search
              ? "Try clearing the condition filter, changing the city, or searching by a different name."
              : "Specialists will appear here once they complete their profile and set it to public."
          }
        />
      ) : (
        <div className="space-y-4">
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const remaining = Math.max(0, d.weekly_referral_cap - d.current_week_referrals);
            const full = !d.accepting_referrals || remaining === 0;
            return (
              <article key={d.id} className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-card">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">
                      Dr. {d.profile?.first_name} {d.profile?.last_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{d.profile?.specialization ?? "Specialist"}</p>
                  </div>
                  {d.nmc_verified && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-success/30 bg-success/15 px-2.5 py-1 text-xs font-medium text-success-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" /> NMC verified
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-muted-foreground">{d.qualifications.slice(0, 3).join(", ")}</p>

                {/* Tags — min-h keeps all cards the same height regardless of tag count */}
                <div className="mt-3 flex min-h-[3.5rem] flex-wrap content-start gap-1">
                  {d.sub_specialties.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-md bg-primary-soft px-2 py-0.5 text-xs text-accent-foreground">{s}</span>
                  ))}
                </div>

                {/* Stats — pushed to bottom via mt-auto */}
                <dl className="mt-auto pt-4 grid grid-cols-2 gap-y-1.5 text-xs text-muted-foreground">
                  <dt className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {d.clinic?.city ?? "—"}</dt>
                  <dt className="flex items-center gap-1.5"><Languages className="h-3 w-3" /> {d.languages_spoken.slice(0, 2).join(", ") || "—"}</dt>
                  <dt>Acceptance: <span className="font-medium text-foreground">{d.referral_acceptance_rate ?? "—"}%</span></dt>
                  <dt>Avg response: <span className="font-medium text-foreground">{d.avg_response_time_hours ?? "—"}h</span></dt>
                </dl>

                <div className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs">
                  {full ? (
                    <span className="font-medium text-destructive">At capacity this week</span>
                  ) : (
                    <span><span className="font-medium text-foreground">{remaining}</span> referral slots left this week</span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t pt-4">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to="/doctors/$doctorId" params={{ doctorId: d.id }}>View profile</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={full}
                    onClick={() => router.navigate({ to: "/referrals/new", search: { specialistId: d.id } })}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Refer
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {hasMore && !city.trim() && !search.trim() && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
            >
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
