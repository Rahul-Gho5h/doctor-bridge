import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, Languages, GraduationCap, Building2, Send, MessageSquare, Briefcase, Stethoscope } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CONDITIONS } from "@/lib/conditions";
import { PortfolioDisplay } from "@/components/profile/PortfolioDisplay";
import { toast } from "sonner";
import { DetailSkeleton } from "@/components/common/Skeletons";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/doctors/$doctorId")({
  head: () => ({ meta: [{ title: "Doctor profile — Doctor Bridge" }] }),
  component: DoctorProfilePage,
});

interface FullDoctor {
  id: string;
  user_id: string;
  nmc_number: string;
  nmc_verified: boolean;
  qualifications: string[];
  sub_specialties: string[];
  condition_codes: string[];
  hospital_affiliations: { name: string; role?: string; since?: number }[];
  languages_spoken: string[];
  insurance_panels: string[];
  accepting_referrals: boolean;
  weekly_referral_cap: number;
  current_week_referrals: number;
  avg_response_time_hours: number | null;
  referral_acceptance_rate: number | null;
  total_referrals_received: number;
  unique_referring_doctors: number;
  teaching_hospital: string | null;
  academic_title: string | null;
  profile: { first_name: string; last_name: string; title: string | null; specialization: string | null; bio: string | null } | null;
  clinic: { name: string; city: string | null; state: string | null; address: string | null } | null;
}

function DoctorProfilePage() {
  const { doctorId } = Route.useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<FullDoctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("doctor_profiles")
        .select(`
          id,user_id,clinic_id,nmc_number,nmc_verified,qualifications,sub_specialties,condition_codes,
          hospital_affiliations,languages_spoken,insurance_panels,accepting_referrals,
          weekly_referral_cap,current_week_referrals,avg_response_time_hours,
          referral_acceptance_rate,total_referrals_received,unique_referring_doctors,
          teaching_hospital,academic_title
        `)
        .eq("id", doctorId)
        .maybeSingle();
      if (error) { console.error(error); setLoading(false); return; }
      if (!data) { setLoading(false); return; }

      const d = data as { user_id: string; clinic_id: string | null } & Record<string, unknown>;
      const [{ data: prof }, { data: cl }] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name,title,specialization,bio").eq("id", d.user_id).maybeSingle(),
        d.clinic_id
          ? supabase.from("clinics").select("name,city,state,address").eq("id", d.clinic_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setDoc({ ...(data as unknown as FullDoctor), profile: prof ?? null, clinic: cl ?? null });
      setLoading(false);
    })();
  }, [doctorId]);

  if (loading) return <DashboardLayout><DetailSkeleton /></DashboardLayout>;
  if (!doc) return (
    <DashboardLayout>
      <EmptyState
        icon={Stethoscope}
        title="Specialist not found"
        description="This doctor profile could not be found or may no longer be available."
      />
    </DashboardLayout>
  );

  const remaining = Math.max(0, doc.weekly_referral_cap - doc.current_week_referrals);
  const full = !doc.accepting_referrals || remaining === 0;

  return (
    <DashboardLayout>
      <Link to="/doctors" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Dr. {doc.profile?.first_name} {doc.profile?.last_name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {doc.profile?.title ?? doc.academic_title ?? "Specialist"} · {doc.profile?.specialization}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">NMC #{doc.nmc_number}</p>
            </div>
            {doc.nmc_verified && (
              <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/15 px-2.5 py-1 text-xs font-medium text-success-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> NMC verified
              </span>
            )}
          </div>

          {doc.profile?.bio && <p className="mt-4 text-sm">{doc.profile.bio}</p>}

          <Section title="Qualifications" icon={GraduationCap}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {doc.qualifications.map((q) => <li key={q}>{q}</li>)}
            </ul>
          </Section>

          <Section title="Sub-specialties">
            <div className="flex flex-wrap gap-1.5">
              {doc.sub_specialties.map((s) => (
                <span key={s} className="rounded-md bg-primary-soft px-2.5 py-1 text-xs text-accent-foreground">{s}</span>
              ))}
            </div>
          </Section>

          <Section title="Conditions treated">
            <div className="flex flex-wrap gap-1.5">
              {doc.condition_codes.map((code) => {
                const c = CONDITIONS.find((x) => x.code === code);
                return (
                  <span key={code} className="rounded-md border bg-card px-2.5 py-1 text-xs">
                    <span className="font-mono font-medium">{code}</span>
                    {c && <span className="ml-1.5 text-muted-foreground">{c.name}</span>}
                  </span>
                );
              })}
            </div>
          </Section>

          <Section title="Hospital affiliations" icon={Building2}>
            <ul className="space-y-2 text-sm">
              {doc.hospital_affiliations.map((h, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <div className="font-medium">{h.name}</div>
                    {h.role && <div className="text-xs text-muted-foreground">{h.role}{h.since ? ` · since ${h.since}` : ""}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Languages" icon={Languages}>
            <p className="text-sm">{doc.languages_spoken.join(", ")}</p>
          </Section>

          <Section title="Insurance panels">
            <p className="text-sm">{doc.insurance_panels.join(", ") || "—"}</p>
          </Section>

          <Section title="Portfolio" icon={Briefcase}>
            <PortfolioDisplay doctorUserId={doc.user_id} />
          </Section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capacity this week</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-semibold">{remaining}</span>
              <span className="text-sm text-muted-foreground">/ {doc.weekly_referral_cap} slots</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (doc.current_week_referrals / doc.weekly_referral_cap) * 100)}%` }}
              />
            </div>
            <Button
              className="mt-4 w-full"
              disabled={full}
              onClick={() => router.navigate({ to: "/referrals/new", search: { specialistId: doc.id } })}
            >
              <Send className="mr-1.5 h-4 w-4" /> {full ? "At capacity" : "Send referral"}
            </Button>
            <Button
              variant="outline"
              className="mt-2 w-full"
              onClick={() => router.navigate({ to: "/messages", search: { to: doc.user_id, thread: undefined } })}
            >
              <MessageSquare className="mr-1.5 h-4 w-4" /> Message doctor
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Total referrals received" value={String(doc.total_referrals_received)} />
              <Row label="Unique referring doctors" value={String(doc.unique_referring_doctors)} />
              <Row label="Acceptance rate" value={`${doc.referral_acceptance_rate ?? "—"}%`} />
              <Row label="Avg response time" value={`${doc.avg_response_time_hours ?? "—"} h`} />
            </dl>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Practice</div>
            <div className="mt-2 text-sm font-medium">{doc.clinic?.name}</div>
            <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{[doc.clinic?.address, doc.clinic?.city, doc.clinic?.state].filter(Boolean).join(", ")}</span>
            </div>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t pt-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
