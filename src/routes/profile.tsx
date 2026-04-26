import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, KeyboardEvent } from "react";
import {
  UserCircle, Building2, Search, LogOut as LeaveIcon, Save, X,
  Briefcase, Stethoscope, Languages, ShieldCheck, ToggleLeft, ToggleRight,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PortfolioEditor } from "@/components/profile/PortfolioEditor";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My profile — Doctor Bridge" }] }),
  component: ProfilePage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface PersonalForm {
  first_name: string;
  last_name: string;
  title: string;
  specialization: string;
  bio: string;
  phone: string;
}

interface ClinicalForm {
  academic_title: string;
  teaching_hospital: string;
  qualifications: string[];
  sub_specialties: string[];
  condition_codes: string[];
  languages_spoken: string[];
  insurance_panels: string[];
}

interface AvailabilityForm {
  accepting_referrals: boolean;
  weekly_referral_cap: number;
}

interface DocProfile {
  id: string;
  nmc_number: string;
  nmc_verified: boolean;
  academic_title: string | null;
  teaching_hospital: string | null;
  qualifications: string[];
  sub_specialties: string[];
  condition_codes: string[];
  languages_spoken: string[];
  insurance_panels: string[];
  accepting_referrals: boolean;
  weekly_referral_cap: number;
  current_week_referrals: number;
  total_referrals_received: number;
  referral_acceptance_rate: number | null;
  avg_response_time_hours: number | null;
  unique_referring_doctors: number;
  profile_completeness: number;
  clinic_id: string | null;
}

interface AffReq {
  id: string;
  hospital_clinic_id: string;
  hospital_name: string;
  initiated_by: "DOCTOR" | "HOSPITAL";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  message: string | null;
  created_at: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { user, profile } = useAuth();
  const [doc, setDoc] = useState<DocProfile | null>(null);
  const [hospital, setHospital] = useState<{
    id: string; name: string; city: string | null;
    address: string | null; phone: string | null;
    working_hours: Record<string, string> | null;
    equipment: string[] | null;
    entity_type: string | null;
    verification_status: string | null;
  } | null>(null);
  const [requests, setRequests] = useState<AffReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [resignOpen, setResignOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    const { data: dp } = await supabase
      .from("doctor_profiles")
      .select(`
        id,nmc_number,nmc_verified,academic_title,teaching_hospital,
        qualifications,sub_specialties,condition_codes,languages_spoken,insurance_panels,
        accepting_referrals,weekly_referral_cap,current_week_referrals,
        total_referrals_received,referral_acceptance_rate,avg_response_time_hours,
        unique_referring_doctors,profile_completeness,clinic_id
      `)
      .eq("user_id", user.id)
      .maybeSingle();
    setDoc(dp as DocProfile | null);

    if (dp?.clinic_id) {
      const { data: h } = await supabase
        .from("clinics")
        .select("id,name,city,address,phone,working_hours,equipment,entity_type,verification_status")
        .eq("id", dp.clinic_id)
        .maybeSingle();
      setHospital(h as {
        id: string; name: string; city: string | null;
        address: string | null; phone: string | null;
        working_hours: Record<string, string> | null;
        equipment: string[] | null;
        entity_type: string | null;
        verification_status: string | null;
      } | null);
    } else {
      setHospital(null);
    }

    const { data: reqs } = await supabase
      .from("affiliation_requests")
      .select("id,hospital_clinic_id,hospital_name,initiated_by,status,message,created_at")
      .eq("doctor_user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((reqs ?? []) as AffReq[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const accept = async (id: string) => {
    const { error } = await supabase.rpc("accept_affiliation_request", { _request_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Joined hospital"); reload(); }
  };

  const reject = async (id: string) => {
    const { error } = await supabase.rpc("reject_affiliation_request", { _request_id: id, _reason: undefined });
    if (error) toast.error(error.message);
    else { toast.success("Request declined"); reload(); }
  };

  const resign = () => setResignOpen(true);

  const confirmResign = async () => {
    if (!user || !hospital) return;
    setResignOpen(false);
    const { error } = await supabase.rpc("detach_doctor_from_hospital", { _doctor_user_id: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Resigned. You are now independent."); reload(); }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="mb-6 h-9 w-48 rounded-lg bg-muted animate-pulse" />
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </DashboardLayout>
  );

  if (!doc) {
    return (
      <DashboardLayout>
        <PageHeader title="My profile" />
        <EmptyState icon={UserCircle} title="No doctor profile" description="Your account isn't registered as a doctor." />
      </DashboardLayout>
    );
  }

  const pending = requests.filter((r) => r.status === "PENDING" && r.initiated_by === "HOSPITAL");
  const sent    = requests.filter((r) => r.status === "PENDING" && r.initiated_by === "DOCTOR");

  return (
    <DashboardLayout>
      <PageHeader
        title="My profile"
        description="Edit your specialist profile, qualifications, and practice settings."
      />

      {/* Hospital invitation banners */}
      {pending.length > 0 && (
        <div className="mb-6 space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary-soft p-4 shadow-card">
              <div>
                <div className="font-medium">Hospital invitation: {r.hospital_name}</div>
                {r.message && <div className="mt-0.5 text-sm text-muted-foreground">{r.message}</div>}
                <div className="mt-0.5 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => reject(r.id)}>Decline</Button>
                <Button size="sm" onClick={() => accept(r.id)}>Accept</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fix 5: profile completeness bar */}
      <div className="mb-6 rounded-xl border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Profile completeness</span>
          <span className={`font-semibold tabular-nums ${
            (doc.profile_completeness ?? 0) >= 75 ? "text-success" :
            (doc.profile_completeness ?? 0) >= 40 ? "text-warning" : "text-destructive"
          }`}>
            {doc.profile_completeness ?? 0}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              (doc.profile_completeness ?? 0) >= 75 ? "bg-success" :
              (doc.profile_completeness ?? 0) >= 40 ? "bg-warning" : "bg-destructive"
            }`}
            style={{ width: `${doc.profile_completeness ?? 0}%` }}
          />
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="personal"><UserCircle className="mr-1.5 h-3.5 w-3.5" />Personal</TabsTrigger>
          <TabsTrigger value="clinical"><Stethoscope className="mr-1.5 h-3.5 w-3.5" />Clinical</TabsTrigger>
          <TabsTrigger value="availability"><ToggleRight className="mr-1.5 h-3.5 w-3.5" />Availability</TabsTrigger>
          <TabsTrigger value="hospital"><Building2 className="mr-1.5 h-3.5 w-3.5" />Hospital</TabsTrigger>
          <TabsTrigger value="portfolio"><Briefcase className="mr-1.5 h-3.5 w-3.5" />Portfolio</TabsTrigger>
        </TabsList>

        {/* ── Personal ── */}
        <TabsContent value="personal">
          <PersonalTab userId={user!.id} onSaved={reload} />
        </TabsContent>

        {/* ── Clinical ── */}
        <TabsContent value="clinical">
          <ClinicalTab doc={doc} onSaved={reload} />
        </TabsContent>

        {/* ── Availability ── */}
        <TabsContent value="availability">
          <AvailabilityTab doc={doc} onSaved={reload} />
        </TabsContent>

        {/* ── Hospital ── */}
        <TabsContent value="hospital">
          <div className="space-y-6">
            {/* Your institution — read-only details card (only when affiliated) */}
            {hospital && (
              <Card title="Your institution" icon={Building2}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</div>
                    <div className="mt-0.5 text-sm font-medium">{hospital.name}</div>
                  </div>
                  {hospital.entity_type && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</div>
                      <div className="mt-0.5 text-sm">{hospital.entity_type}</div>
                    </div>
                  )}
                  {hospital.address && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Address</div>
                      <div className="mt-0.5 text-sm">{hospital.address}</div>
                    </div>
                  )}
                  {(hospital.city || hospital.verification_status) && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">City</div>
                      <div className="mt-0.5 text-sm">{hospital.city ?? "—"}</div>
                    </div>
                  )}
                  {hospital.phone && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone</div>
                      <div className="mt-0.5 text-sm">{hospital.phone}</div>
                    </div>
                  )}
                  {hospital.working_hours?.text && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Working hours</div>
                      <div className="mt-0.5 text-sm">{hospital.working_hours.text}</div>
                    </div>
                  )}
                  {hospital.verification_status && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Verification</div>
                      <div className="mt-0.5 text-sm font-medium">{hospital.verification_status}</div>
                    </div>
                  )}
                </div>
                {hospital.equipment && hospital.equipment.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Equipment & facilities</div>
                    <div className="flex flex-wrap gap-1.5">
                      {hospital.equipment.map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  These details are managed by your institution admin. Contact them to request changes.
                </p>
              </Card>
            )}

            {/* Current affiliation */}
            <Card title="Current affiliation" icon={Building2}>
              {hospital ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold">{hospital.name}</div>
                      <div className="text-sm text-muted-foreground">{hospital.city ?? "—"}</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={resign}>
                    <LeaveIcon className="mr-2 h-4 w-4" />Resign
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                  <div>
                    <div className="font-medium">Independent doctor</div>
                    <div className="text-sm text-muted-foreground">Not affiliated with any hospital.</div>
                  </div>
                  <JoinHospitalDialog doctorUserId={user!.id} doctorProfileId={doc.id} onSent={reload} />
                </div>
              )}
            </Card>

            {/* Sent requests awaiting approval */}
            {sent.length > 0 && (
              <Card title="Awaiting hospital approval">
                <div className="space-y-2">
                  {sent.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm">
                      <div>
                        <div className="font-medium">{r.hospital_name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* NMC info */}
            <Card title="Verification" icon={ShieldCheck}>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">NMC Number</div>
                  <div className="mt-0.5 font-mono font-medium">{doc.nmc_number}</div>
                </div>
                {doc.nmc_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2.5 py-1 text-xs font-medium text-success-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning-foreground">
                    Pending verification
                  </span>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Portfolio ── */}
        <TabsContent value="portfolio">
          <PortfolioEditor />
        </TabsContent>
      </Tabs>

      <AlertDialog open={resignOpen} onOpenChange={setResignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resign from {hospital?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will become an independent doctor and lose your hospital affiliation. This can be reversed by re-applying.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, resign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// ─── Personal tab ─────────────────────────────────────────────────────────────

function PersonalTab({ userId, onSaved }: {
  userId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PersonalForm>({
    first_name: "", last_name: "", title: "",
    specialization: "", bio: "", phone: "",
  });
  const [email, setEmail]                 = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving]               = useState(false);

  // ── Fix 1: fetch all fields directly from the DB ─────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name,last_name,title,specialization,bio,phone,email")
        .eq("id", userId)
        .single();
      if (data) {
        const d = data as any;
        setForm({
          first_name:    d.first_name    ?? "",
          last_name:     d.last_name     ?? "",
          title:         d.title         ?? "",
          specialization: d.specialization ?? "",
          bio:           d.bio           ?? "",
          phone:         d.phone         ?? "",
        });
        setEmail(d.email ?? "");
      }
      setLoadingProfile(false);
    })();
  }, [userId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name:    form.first_name.trim(),
      last_name:     form.last_name.trim(),
      title:         form.title.trim()         || null,
      specialization: form.specialization.trim() || null,
      bio:           form.bio.trim()           || null,
      phone:         form.phone.trim()         || null,
    }).eq("id", userId);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Personal info saved"); onSaved(); }
  };

  const f = (k: keyof PersonalForm) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value })),
  });

  if (loadingProfile) {
    return (
      <Card title="Personal information" icon={UserCircle}>
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading…
        </div>
      </Card>
    );
  }

  return (
    <Card title="Personal information" icon={UserCircle}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name"><Input {...f("first_name")} /></Field>
        <Field label="Last name"><Input {...f("last_name")} /></Field>
        {/* Fix 2: email read-only display + phone field */}
        <Field label="Email">
          <Input value={email} onChange={() => {}} disabled />
        </Field>
        <Field label="Phone"><Input {...f("phone")} placeholder="+91 98765 43210" /></Field>
        <Field label="Title (e.g. Dr., Prof.)"><Input {...f("title")} placeholder="Dr." /></Field>
        <Field label="Specialization"><Input {...f("specialization")} placeholder="e.g. Cardiology" /></Field>
      </div>
      <Field label="Bio" className="mt-4">
        <Textarea {...f("bio")} rows={4} placeholder="Brief professional bio visible on your public profile…" />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1.5 h-4 w-4" />{saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Card>
  );
}

// ─── Clinical tab ─────────────────────────────────────────────────────────────

function ClinicalTab({ doc, onSaved }: { doc: DocProfile; onSaved: () => void }) {
  const [form, setForm] = useState<ClinicalForm>({
    academic_title:    doc.academic_title    ?? "",
    teaching_hospital: doc.teaching_hospital ?? "",
    qualifications:    doc.qualifications,
    sub_specialties:   doc.sub_specialties,
    condition_codes:   doc.condition_codes,
    languages_spoken:  doc.languages_spoken,
    insurance_panels:  doc.insurance_panels,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("doctor_profiles").update({
      academic_title:    form.academic_title.trim()    || null,
      teaching_hospital: form.teaching_hospital.trim() || null,
      qualifications:    form.qualifications,
      sub_specialties:   form.sub_specialties,
      condition_codes:   form.condition_codes,
      languages_spoken:  form.languages_spoken,
      insurance_panels:  form.insurance_panels,
    }).eq("id", doc.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Clinical profile saved"); onSaved(); }
  };

  const setArr = (key: keyof ClinicalForm) => (val: string[]) =>
    setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="space-y-6">
      <Card title="Titles & academia" icon={Stethoscope}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Academic title (e.g. Associate Professor)">
            <Input value={form.academic_title} onChange={(e) => setForm((p) => ({ ...p, academic_title: e.target.value }))} placeholder="Optional" />
          </Field>
          <Field label="Teaching hospital">
            <Input value={form.teaching_hospital} onChange={(e) => setForm((p) => ({ ...p, teaching_hospital: e.target.value }))} placeholder="Optional" />
          </Field>
        </div>
      </Card>

      <Card title="Qualifications & expertise" icon={Stethoscope}>
        <div className="space-y-4">
          <Field label="Qualifications (e.g. MBBS, MD, DNB)">
            <TagInput value={form.qualifications} onChange={setArr("qualifications")} placeholder="Type and press Enter" />
          </Field>
          <Field label="Sub-specialties">
            <TagInput value={form.sub_specialties} onChange={setArr("sub_specialties")} placeholder="Type and press Enter" />
          </Field>
          <Field label="Condition codes treated (ICD-10)">
            <TagInput value={form.condition_codes} onChange={setArr("condition_codes")} placeholder="e.g. I21, J45 — press Enter" />
          </Field>
        </div>
      </Card>

      <Card title="Languages & insurance" icon={Languages}>
        <div className="space-y-4">
          <Field label="Languages spoken">
            <TagInput
              value={form.languages_spoken}
              onChange={setArr("languages_spoken")}
              placeholder="Add language…"
              suggestions={["English", "Hindi", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Gujarati", "Malayalam"]}
            />
          </Field>
          <Field label="Insurance panels accepted">
            <TagInput
              value={form.insurance_panels}
              onChange={setArr("insurance_panels")}
              placeholder="Add insurer…"
              suggestions={["Star Health", "ICICI Lombard", "Niva Bupa", "Care Health", "HDFC Ergo", "Bajaj Allianz"]}
            />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1.5 h-4 w-4" />{saving ? "Saving…" : "Save clinical profile"}
        </Button>
      </div>
    </div>
  );
}

// ─── Availability tab ─────────────────────────────────────────────────────────

function AvailabilityTab({ doc, onSaved }: { doc: DocProfile; onSaved: () => void }) {
  const [form, setForm] = useState<AvailabilityForm>({
    accepting_referrals: doc.accepting_referrals,
    weekly_referral_cap: doc.weekly_referral_cap,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.weekly_referral_cap < 1) { toast.error("Weekly cap must be at least 1"); return; }
    setSaving(true);
    const { error } = await supabase.from("doctor_profiles").update({
      accepting_referrals: form.accepting_referrals,
      weekly_referral_cap: form.weekly_referral_cap,
    }).eq("id", doc.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Availability saved"); onSaved(); }
  };

  return (
    <Card title="Referral availability">
      <div className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Accepting referrals</div>
            <div className="text-sm text-muted-foreground">
              {form.accepting_referrals ? "You appear in the specialist directory and can receive new referrals." : "You are hidden from the directory and no new referrals can be sent to you."}
            </div>
          </div>
          <button
            onClick={() => setForm((p) => ({ ...p, accepting_referrals: !p.accepting_referrals }))}
            className="ml-4 shrink-0"
          >
            {form.accepting_referrals
              ? <ToggleRight className="h-8 w-8 text-primary" />
              : <ToggleLeft className="h-8 w-8 text-muted-foreground" />
            }
          </button>
        </div>

        {/* Weekly cap */}
        <Field label="Weekly referral cap">
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={200}
              value={form.weekly_referral_cap}
              onChange={(e) => setForm((p) => ({ ...p, weekly_referral_cap: Number(e.target.value) }))}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">referrals per week</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            This week: {doc.current_week_referrals} used · {Math.max(0, form.weekly_referral_cap - doc.current_week_referrals)} remaining
          </p>
        </Field>

        {/* Stats summary — Fix 4: added Referring doctors */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total received"    value={String(doc.total_referrals_received)} />
          <StatCard label="Acceptance rate"   value={doc.referral_acceptance_rate !== null ? `${doc.referral_acceptance_rate}%` : "—"} />
          <StatCard label="Avg response"      value={doc.avg_response_time_hours  !== null ? `${doc.avg_response_time_hours}h`  : "—"} />
          <StatCard label="Referring doctors" value={String(doc.unique_referring_doctors)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />{saving ? "Saving…" : "Save availability"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({ value, onChange, placeholder, suggestions }: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [input, setInput] = useState("");

  const add = (tag: string) => {
    const t = tag.trim();
    if (!t || value.includes(t)) { setInput(""); return; }
    onChange([...value, t]);
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && !input && value.length > 0) remove(value[value.length - 1]);
  };

  const filtered = suggestions?.filter((s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase())) ?? [];

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => { if (input.trim()) add(input); }}
          placeholder={value.length === 0 ? placeholder : ""}
        />
      </div>
      {filtered.length > 0 && input && (
        <div className="flex flex-wrap gap-1">
          {filtered.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── JoinHospitalDialog ───────────────────────────────────────────────────────

function JoinHospitalDialog({ doctorUserId, doctorProfileId, onSent }: {
  doctorUserId: string; doctorProfileId: string; onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);

  const search = async () => {
    setSearching(true);
    const { data } = await supabase.from("clinics").select("id,name,city").ilike("name", `%${query}%`).limit(10);
    setResults((data ?? []) as { id: string; name: string; city: string | null }[]);
    setSearching(false);
  };

  const sendRequest = async (hospital: { id: string; name: string }) => {
    const { error } = await supabase.from("affiliation_requests").insert({
      doctor_user_id: doctorUserId,
      doctor_profile_id: doctorProfileId,
      hospital_clinic_id: hospital.id,
      hospital_name: hospital.name,
      initiated_by: "DOCTOR",
      initiated_by_user_id: doctorUserId,
      message: message || null,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Request sent to ${hospital.name}`); setOpen(false); setMessage(""); onSent(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Search className="mr-2 h-4 w-4" />Join a hospital</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request to join a hospital</DialogTitle>
          <DialogDescription>Search by name. The hospital admin will need to approve your request.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Hospital name" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()} />
            <Button variant="outline" onClick={search} disabled={!query || searching}>Search</Button>
          </div>
          <div className="space-y-2">
            {results.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.city ?? "—"}</div>
                </div>
                <Button size="sm" onClick={() => sendRequest(h)}>Request</Button>
              </div>
            ))}
            {results.length === 0 && query && !searching && (
              <p className="text-center text-sm text-muted-foreground">No hospitals found.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Brief note for the hospital admin" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Card({ title, icon: Icon, children }: {
  title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}{title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children, className }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
