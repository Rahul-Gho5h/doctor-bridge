import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Stethoscope, Pill, FlaskConical, Activity, FileText, NotebookPen,
  History, Plus, Calendar, User as UserIcon, Pencil, Trash2, MoreVertical, Send,
  ShieldCheck, ShieldOff, CheckCircle2, XCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DetailSkeleton } from "@/components/common/Skeletons";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { age, formatDateTime, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { AttachmentList } from "@/components/patients/AttachmentList";
import { FileDropzone } from "@/components/patients/FileDropzone";
import { EditPatientDialog } from "@/components/patients/EditPatientDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { StoredAttachment } from "@/lib/storage";
import { deletePatientFile } from "@/lib/storage";

export const Route = createFileRoute("/patients/$patientId")({
  head: () => ({ meta: [{ title: "Patient — Doctor Bridge" }] }),
  component: PatientDetailPage,
});

type EncounterType = "VISIT" | "DIAGNOSIS" | "PRESCRIPTION" | "TEST" | "SURGERY" | "NOTE";

interface Patient {
  id: string; display_id: string; first_name: string; last_name: string;
  phone: string; email: string | null; date_of_birth: string; gender: string;
  blood_group: string | null; address: string | null;
  city: string | null; state: string | null; pincode: string | null;
  allergies: string[]; chronic_conditions: string[]; current_medications: string[];
  created_at: string;
}

interface Encounter {
  id: string; type: EncounterType; title: string; details: string | null;
  occurred_at: string; doctor_name: string; doctor_user_id: string;
  hospital_name: string | null; data: Record<string, unknown>;
  attachments: StoredAttachment[];
  created_at: string; updated_at: string;
}

interface EditLog {
  id: string; encounter_id: string; action: string;
  edited_by_name: string; created_at: string;
}

interface ConsentEntry {
  id: string;
  consent_type: "PROCEDURE" | "REFERRAL" | "DATA_SHARING" | "RESEARCH" | "OTHER";
  title: string;
  details: string | null;
  consent_method: "VERBAL" | "WRITTEN" | "DIGITAL";
  consented_by: "PATIENT" | "GUARDIAN" | "CAREGIVER";
  recorded_by_name: string;
  recorded_by_user_id: string;
  recorded_at: string;
  valid_until: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

const TYPE_META: Record<EncounterType, { label: string; icon: typeof Stethoscope; color: string }> = {
  VISIT:        { label: "Visit",        icon: Stethoscope,  color: "bg-info/15 text-info-foreground border-info/30" },
  DIAGNOSIS:    { label: "Diagnosis",    icon: Activity,     color: "bg-warning/15 text-warning-foreground border-warning/30" },
  PRESCRIPTION: { label: "Prescription", icon: Pill,         color: "bg-primary-soft text-accent-foreground border-primary/20" },
  TEST:         { label: "Test",         icon: FlaskConical, color: "bg-accent text-accent-foreground border-accent" },
  SURGERY:      { label: "Surgery",      icon: FileText,     color: "bg-destructive/10 text-destructive border-destructive/30" },
  NOTE:         { label: "Note",         icon: NotebookPen,  color: "bg-muted text-muted-foreground border-border" },
};

function PatientDetailPage() {
  const { patientId } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [{ data: p }, { data: enc }] = await Promise.all([
      supabase.from("global_patients").select("*").eq("id", patientId).maybeSingle(),
      supabase.from("patient_encounters").select("*").eq("global_patient_id", patientId).order("occurred_at", { ascending: false }),
    ]);
    setPatient(p as Patient | null);
    setEncounters((enc ?? []) as unknown as Encounter[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) {
    return (
      <DashboardLayout>
        <Link to="/patients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </Link>
        <DetailSkeleton />
      </DashboardLayout>
    );
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <Link to="/patients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </Link>
        <EmptyState
          icon={UserIcon}
          title="Patient not found"
          description="This patient record doesn't exist or you haven't been granted access yet."
          action={
            <Button asChild variant="outline">
              <Link to="/patients">Search registry</Link>
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <Link to="/patients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </Link>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

          {/* ── Left: profile card ─────────────────────────────────────────── */}
          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-accent-foreground">
                  {patient.first_name[0]}{patient.last_name[0]}
                </div>
                <div>
                  <h1 className="text-xl font-semibold">{patient.first_name} {patient.last_name}</h1>
                  <p className="font-mono text-xs text-muted-foreground">{patient.display_id}</p>
                </div>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Age / Sex"  value={`${age(patient.date_of_birth)}y · ${patient.gender}`} />
                <Row label="DOB"        value={formatDate(patient.date_of_birth)} />
                <Row label="Phone"      value={patient.phone} />
                {patient.email      && <Row label="Email"   value={patient.email} />}
                {patient.blood_group && <Row label="Blood"   value={patient.blood_group} />}
                <Row
                  label="Location"
                  value={[patient.city, patient.state, patient.pincode].filter(Boolean).join(", ") || "—"}
                />
                {patient.address && <Row label="Address" value={patient.address} />}
              </dl>

              <div className="mt-4 space-y-2">
                {/* Refer this patient shortcut */}
                <Button
                  className="w-full"
                  onClick={() =>
                    router.navigate({ to: "/referrals/new", search: { patientId: patient.id } })
                  }
                >
                  <Send className="mr-2 h-4 w-4" />
                  Refer this patient
                </Button>
                <EditPatientDialog patient={patient} onSaved={reload} />
              </div>
            </div>

            <ChipsCard title="Allergies"           items={patient.allergies}           tone="destructive" />
            <ChipsCard title="Chronic conditions"  items={patient.chronic_conditions}  tone="warning" />
            <ChipsCard title="Current medications" items={patient.current_medications} tone="info" />
          </aside>

          {/* ── Right: timeline ────────────────────────────────────────────── */}
          <div>
            <Tabs defaultValue="timeline">
              <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
                <TabsList>
                  <TabsTrigger value="timeline">Timeline ({encounters.length})</TabsTrigger>
                  <TabsTrigger value="consent">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />Consent log
                  </TabsTrigger>
                  <TabsTrigger value="audit">Edit history</TabsTrigger>
                  <TabsTrigger value="referrals">
                    <Send className="mr-1 h-3.5 w-3.5" />Referrals
                  </TabsTrigger>
                </TabsList>
                <EncounterDialog patientId={patient.id} onSaved={reload} />
              </div>

              <TabsContent value="timeline" className="mt-0">
                {encounters.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="No clinical entries yet"
                    description="Add the first visit, diagnosis, prescription, or test result for this patient."
                    action={<EncounterDialog patientId={patient.id} onSaved={reload} />}
                  />
                ) : (
                  <ol className="relative space-y-4 border-l-2 border-border pl-6">
                    {encounters.map((e) => {
                      const meta = TYPE_META[e.type];
                      const Icon = meta.icon;
                      const isAuthor = e.doctor_user_id === user?.id;
                      return (
                        <li key={e.id} className="relative">
                          <span className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-background ${meta.color}`}>
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="rounded-xl border bg-card p-4 shadow-card">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>
                                  {meta.label}
                                </span>
                                <h3 className="mt-1.5 font-semibold">{e.title}</h3>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="text-right text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />{formatDateTime(e.occurred_at)}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-1">
                                    <UserIcon className="h-3 w-3" />Dr. {e.doctor_name}
                                  </div>
                                  {e.hospital_name && <div className="mt-0.5">{e.hospital_name}</div>}
                                  {e.updated_at !== e.created_at && (
                                    <div className="mt-0.5 italic">edited {formatDateTime(e.updated_at)}</div>
                                  )}
                                </div>
                                {isAuthor && (
                                  <EncounterActions
                                    encounter={e}
                                    patientId={patient.id}
                                    onSaved={reload}
                                  />
                                )}
                              </div>
                            </div>
                            {e.details && <p className="mt-3 whitespace-pre-wrap text-sm">{e.details}</p>}
                            <EncounterDataView type={e.type} data={e.data} />
                            <AttachmentList attachments={e.attachments ?? []} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="consent" className="mt-0">
                <ConsentLogView patientId={patient.id} />
              </TabsContent>

              <TabsContent value="audit" className="mt-0">
                <AuditLogView patientId={patient.id} />
              </TabsContent>

              <TabsContent value="referrals" className="mt-0">
                <PatientReferralsView patientMrn={patient.display_id} patientId={patient.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DashboardLayout>
    </ErrorBoundary>
  );
}

// ── Encounter action menu (edit + delete with confirm dialog) ─────────────────

function EncounterActions({
  encounter, patientId, onSaved,
}: {
  encounter: Encounter;
  patientId: string;
  onSaved: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    setDeleting(true);
    for (const a of encounter.attachments ?? []) {
      try { await deletePatientFile(a.path); } catch { /* ignore */ }
    }
    const { error } = await supabase.from("patient_encounters").delete().eq("id", encounter.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Entry deleted");
    setDeleteOpen(false);
    onSaved();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <EncounterDialog patientId={patientId} onSaved={onSaved} editing={encounter}>
            <DropdownMenuItem onSelect={(ev) => ev.preventDefault()}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
          </EncounterDialog>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Delete entry
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">"{encounter.title}"</span>?
              This cannot be undone, but will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function ChipsCard({
  title, items, tone,
}: {
  title: string; items: string[]; tone: "destructive" | "warning" | "info";
}) {
  const toneCls =
    tone === "destructive" ? "bg-destructive/10 text-destructive"
    : tone === "warning"   ? "bg-warning/15 text-warning-foreground"
    :                        "bg-info/10 text-info-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length === 0
          ? <span className="text-xs text-muted-foreground">None recorded</span>
          : items.map((c) => (
              <span key={c} className={`rounded px-2 py-0.5 text-xs ${toneCls}`}>{c}</span>
            ))}
      </div>
    </div>
  );
}

function EncounterDataView({ type, data }: { type: EncounterType; data: Record<string, unknown> }) {
  if (!data || Object.keys(data).length === 0) return null;

  // VISIT: composite BP + labelled units
  if (type === "VISIT") {
    const entries: { label: string; value: string }[] = [];
    if (data.chief_complaint) entries.push({ label: "Chief complaint", value: data.chief_complaint as string });
    const bpSys = data.bp_systolic as string | undefined;
    const bpDia = data.bp_diastolic as string | undefined;
    if (bpSys && bpDia)  entries.push({ label: "Blood pressure", value: `${bpSys}/${bpDia} mmHg` });
    else if (bpSys)      entries.push({ label: "BP systolic",    value: `${bpSys} mmHg` });
    if (data.heart_rate)  entries.push({ label: "Heart rate",    value: `${data.heart_rate} bpm` });
    if (data.temperature) entries.push({ label: "Temperature",   value: `${data.temperature} °C` });
    if (data.weight)      entries.push({ label: "Weight",        value: `${data.weight} kg` });
    if (data.spo2)        entries.push({ label: "SpO₂",          value: `${data.spo2}%` });
    if (entries.length === 0) return null;
    return (
      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-3">
        {entries.map((f) => (
          <div key={f.label}>
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const fields: { label: string; key: string }[] =
    type === "PRESCRIPTION" ? [
      { label: "Medication", key: "medication" }, { label: "Dosage", key: "dosage" },
      { label: "Frequency", key: "frequency" },  { label: "Duration", key: "duration" },
    ] : type === "TEST" ? [
      { label: "Test", key: "test_name" }, { label: "Result", key: "result" },
    ] : type === "SURGERY" ? [
      { label: "Procedure", key: "procedure" }, { label: "Outcome", key: "outcome" },
      { label: "Precautions", key: "precautions" },
    ] : type === "DIAGNOSIS" ? [
      { label: "ICD-10", key: "icd10" }, { label: "Severity", key: "severity" },
    ] : [];

  const entries = fields
    .map((f) => ({ ...f, value: data[f.key] as string | undefined }))
    .filter((f) => f.value);
  if (entries.length === 0) return null;

  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs">
      {entries.map((f) => (
        <div key={f.key}>
          <dt className="text-muted-foreground">{f.label}</dt>
          <dd className="font-medium">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Patient referrals ─────────────────────────────────────────────────────────

interface PatientReferralRow {
  id: string;
  referral_number: string;
  primary_diagnosis: string;
  status: string;
  created_at: string;
  specialist_id: string;
  specialistName: string | null;
}

function PatientReferralsView({ patientMrn, patientId }: { patientMrn: string; patientId: string }) {
  const [refs, setRefs]     = useState<PatientReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      // Query referrals where patient_snapshot.mrn matches this patient's display_id
      const { data, error } = await supabase
        .from("referrals")
        .select("id,referral_number,primary_diagnosis,status,created_at,specialist_id")
        .eq("patient_snapshot->>mrn", patientMrn)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error || !data || data.length === 0) {
        setRefs([]);
        setLoading(false);
        return;
      }

      // Enrich with specialist names via doctor_profiles → profiles
      const specIds = Array.from(new Set(data.map((r: any) => r.specialist_id as string)));
      const { data: docs } = specIds.length
        ? await supabase.from("doctor_profiles").select("id,user_id").in("id", specIds)
        : { data: [] as any[] };
      const userIds = Array.from(new Set((docs ?? []).map((d: any) => d.user_id as string)));
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id,first_name,last_name").in("id", userIds)
        : { data: [] as any[] };

      const docMap  = new Map((docs  ?? []).map((d: any) => [d.id as string, d.user_id as string]));
      const profMap = new Map((profs ?? []).map((p: any) => [p.id as string, `Dr. ${p.first_name} ${p.last_name}`]));

      setRefs(data.map((r: any) => ({
        ...r,
        specialistName: profMap.get(docMap.get(r.specialist_id) ?? "") ?? null,
      })));
      setLoading(false);
    })();
  }, [patientMrn]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (refs.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="No referrals found"
        description="No referrals have been sent for this patient yet."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Ref #</th>
            <th className="px-4 py-3 text-left">Diagnosis</th>
            <th className="px-4 py-3 text-left">Specialist</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {refs.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.referral_number}</td>
              <td className="px-4 py-3 font-medium">{r.primary_diagnosis}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.specialistName ?? "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <Button asChild size="sm" variant="outline">
                  <Link to="/referrals/$referralId" params={{ referralId: r.id }}>Open</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────────

function AuditLogView({ patientId }: { patientId: string }) {
  const [logs, setLogs] = useState<EditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("encounter_edits")
        .select("id,encounter_id,action,edited_by_name,created_at")
        .eq("global_patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data ?? []) as EditLog[]);
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No edits recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">When</th>
            <th className="px-4 py-3 text-left">Who</th>
            <th className="px-4 py-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(l.created_at)}</td>
              <td className="px-4 py-2.5 font-medium">{l.edited_by_name}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                  l.action === "CREATE"  ? "bg-success/15 text-success-foreground"
                  : l.action === "UPDATE" ? "bg-info/15 text-info-foreground"
                  : "bg-destructive/10 text-destructive"
                }`}>
                  <History className="mr-1 h-3 w-3" />{l.action}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Add / Edit encounter dialog ─────────────────────────────────────────────*/

function EncounterDialog({
  patientId, onSaved, editing, children,
}: {
  patientId: string;
  onSaved: () => void;
  editing?: Encounter;
  children?: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<EncounterType>("VISIT");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [data, setData] = useState<Record<string, string>>({});
  const [hospitalName, setHospitalName] = useState("");
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setDetails(editing.details ?? "");
      setOccurredAt(new Date(editing.occurred_at).toISOString().slice(0, 16));
      setData((editing.data as Record<string, string>) ?? {});
      setHospitalName(editing.hospital_name ?? "");
      setAttachments(editing.attachments ?? []);
    } else {
      setType("VISIT"); setTitle(""); setDetails("");
      setOccurredAt(new Date().toISOString().slice(0, 16));
      setData({}); setHospitalName(""); setAttachments([]);
    }
  }, [open, editing]);

  useEffect(() => { if (!editing) setData({}); }, [type, editing]);

  const submit = async () => {
    if (!user || !profile) return;
    if (!title) { toast.error("Title is required"); return; }
    setBusy(true);

    if (editing) {
      const { error } = await supabase.from("patient_encounters").update({
        type, title, details: details || null,
        occurred_at: new Date(occurredAt).toISOString(),
        data, attachments, hospital_name: hospitalName || null,
      }).eq("id", editing.id);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Entry updated");
    } else {
      const { error } = await supabase.from("patient_encounters").insert({
        global_patient_id: patientId,
        doctor_user_id: user.id,
        doctor_name: `${profile.first_name} ${profile.last_name}`,
        hospital_clinic_id: profile.clinic_id,
        hospital_name: hospitalName || null,
        type, title, details: details || null,
        occurred_at: new Date(occurredAt).toISOString(),
        data, attachments,
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Entry added to timeline");
    }
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button><Plus className="mr-1.5 h-4 w-4" />Add entry</Button>}
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{editing ? "Edit timeline entry" : "New timeline entry"}</DialogTitle>
          <DialogDescription>
            Logged with your name, visible to other treating doctors. Every change is audited.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2 pb-2">
            <div>
              <Label className="mb-1.5 block text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as EncounterType)} disabled={!!editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as EncounterType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Date &amp; time</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow-up consultation" />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs">Hospital / Clinic name</Label>
              <Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="Where this took place" />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs">Details / Notes</Label>
              <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Clinical observations, instructions, precautions…" />
            </div>

            <TypedFields type={type} data={data} setData={setData} />

            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs">Attachments</Label>
              {user && (
                <FileDropzone
                  patientId={patientId}
                  uploadedBy={user.id}
                  value={attachments}
                  onChange={setAttachments}
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add to timeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypedFields({
  type, data, setData,
}: {
  type: EncounterType; data: Record<string, string>; setData: (d: Record<string, string>) => void;
}) {
  const set = (k: string, v: string) => setData({ ...data, [k]: v });

  if (type === "VISIT") return (
    <>
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block text-xs">Chief complaint</Label>
        <Input
          value={data.chief_complaint ?? ""}
          onChange={(e) => set("chief_complaint", e.target.value)}
          placeholder="e.g. Chest pain, shortness of breath"
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Vitals</Label>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="mb-1.5 block text-xs">BP systolic (mmHg)</Label>
          <Input type="number" value={data.bp_systolic ?? ""} onChange={(e) => set("bp_systolic", e.target.value)} placeholder="120" />
        </div>
        <div className="flex-1">
          <Label className="mb-1.5 block text-xs">BP diastolic (mmHg)</Label>
          <Input type="number" value={data.bp_diastolic ?? ""} onChange={(e) => set("bp_diastolic", e.target.value)} placeholder="80" />
        </div>
      </div>
      <Field label="Heart rate (bpm)"  v={data.heart_rate ?? ""}  on={(v) => set("heart_rate",  v)} placeholder="72" />
      <Field label="Temperature (°C)"  v={data.temperature ?? ""} on={(v) => set("temperature", v)} placeholder="37.0" />
      <Field label="Weight (kg)"       v={data.weight ?? ""}      on={(v) => set("weight",      v)} placeholder="70" />
      <Field label="SpO₂ (%)"          v={data.spo2 ?? ""}        on={(v) => set("spo2",        v)} placeholder="98" />
    </>
  );

  if (type === "PRESCRIPTION") return (
    <>
      <Field label="Medication" v={data.medication ?? ""} on={(v) => set("medication", v)} />
      <Field label="Dosage"     v={data.dosage ?? ""}     on={(v) => set("dosage", v)}     placeholder="e.g. 500mg" />
      <Field label="Frequency"  v={data.frequency ?? ""}  on={(v) => set("frequency", v)}  placeholder="e.g. BD after meals" />
      <Field label="Duration"   v={data.duration ?? ""}   on={(v) => set("duration", v)}   placeholder="e.g. 7 days" />
    </>
  );
  if (type === "TEST") return (
    <>
      <Field label="Test name"    v={data.test_name ?? ""} on={(v) => set("test_name", v)} />
      <Field label="Result / value" v={data.result ?? ""}  on={(v) => set("result", v)} />
    </>
  );
  if (type === "SURGERY") return (
    <>
      <Field label="Procedure" v={data.procedure ?? ""} on={(v) => set("procedure", v)} />
      <Field label="Outcome"   v={data.outcome ?? ""}   on={(v) => set("outcome", v)} />
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block text-xs">Post-op precautions</Label>
        <Textarea rows={2} value={data.precautions ?? ""} onChange={(e) => set("precautions", e.target.value)} />
      </div>
    </>
  );
  if (type === "DIAGNOSIS") return (
    <>
      <Field label="ICD-10 code" v={data.icd10 ?? ""}    on={(v) => set("icd10", v)}    placeholder="e.g. I10" />
      <Field label="Severity"    v={data.severity ?? ""}  on={(v) => set("severity", v)} placeholder="Mild / Moderate / Severe" />
    </>
  );
  return null;
}

function Field({
  label, v, on, placeholder,
}: {
  label: string; v: string; on: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ── Consent log ─────────────────────────────────────────────────────────────*/

const CONSENT_TYPE_LABELS: Record<ConsentEntry["consent_type"], string> = {
  PROCEDURE:    "Procedure",
  REFERRAL:     "Referral",
  DATA_SHARING: "Data sharing",
  RESEARCH:     "Research",
  OTHER:        "Other",
};

const CONSENT_TYPE_COLORS: Record<ConsentEntry["consent_type"], string> = {
  PROCEDURE:    "bg-primary-soft text-accent-foreground border-primary/20",
  REFERRAL:     "bg-info/10 text-info-foreground border-info/30",
  DATA_SHARING: "bg-warning/10 text-warning-foreground border-warning/30",
  RESEARCH:     "bg-accent text-accent-foreground border-border",
  OTHER:        "bg-muted text-muted-foreground border-border",
};

function ConsentLogView({ patientId }: { patientId: string }) {
  const { user, profile } = useAuth();
  const [consents, setConsents] = useState<ConsentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Add form state
  const [cType, setCType] = useState<ConsentEntry["consent_type"]>("PROCEDURE");
  const [cTitle, setCTitle] = useState("");
  const [cDetails, setCDetails] = useState("");
  const [cMethod, setCMethod] = useState<ConsentEntry["consent_method"]>("VERBAL");
  const [cConsentedBy, setCConsentedBy] = useState<ConsentEntry["consented_by"]>("PATIENT");
  const [cValidUntil, setCValidUntil] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("patient_consents")
      .select("id,consent_type,title,details,consent_method,consented_by,recorded_by_name,recorded_by_user_id,recorded_at,valid_until,revoked_at,revocation_reason")
      .eq("global_patient_id", patientId)
      .order("recorded_at", { ascending: false });
    setConsents((data ?? []) as ConsentEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId]);

  const addConsent = async () => {
    if (!user || !profile) return;
    if (!cTitle.trim()) { toast.error("Consent title is required."); return; }
    setSaving(true);
    const { error } = await supabase.from("patient_consents").insert({
      global_patient_id: patientId,
      consent_type: cType,
      title: cTitle.trim(),
      details: cDetails.trim() || null,
      consent_method: cMethod,
      consented_by: cConsentedBy,
      recorded_by_user_id: user.id,
      recorded_by_name: `Dr. ${profile.first_name} ${profile.last_name}`,
      valid_until: cValidUntil || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Consent recorded");
    setAddOpen(false);
    setCTitle(""); setCDetails(""); setCValidUntil("");
    setCType("PROCEDURE"); setCMethod("VERBAL"); setCConsentedBy("PATIENT");
    await load();
  };

  const revokeConsent = async () => {
    if (!revokeId) return;
    setSaving(true);
    const { error } = await supabase
      .from("patient_consents")
      .update({ revoked_at: new Date().toISOString(), revocation_reason: revokeReason.trim() || null })
      .eq("id", revokeId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Consent revoked");
    setRevokeId(null);
    setRevokeReason("");
    await load();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {consents.length === 0 ? "No consents recorded yet." : `${consents.length} consent record${consents.length === 1 ? "" : "s"}`}
        </p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />Record consent</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Record patient consent
              </DialogTitle>
              <DialogDescription>
                Log informed consent given by the patient or their representative.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type *</Label>
                  <Select value={cType} onValueChange={(v) => setCType(v as ConsentEntry["consent_type"])}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONSENT_TYPE_LABELS) as ConsentEntry["consent_type"][]).map((k) => (
                        <SelectItem key={k} value={k}>{CONSENT_TYPE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Method *</Label>
                  <Select value={cMethod} onValueChange={(v) => setCMethod(v as ConsentEntry["consent_method"])}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VERBAL">Verbal</SelectItem>
                      <SelectItem value="WRITTEN">Written</SelectItem>
                      <SelectItem value="DIGITAL">Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Consented by *</Label>
                <Select value={cConsentedBy} onValueChange={(v) => setCConsentedBy(v as ConsentEntry["consented_by"])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PATIENT">Patient (self)</SelectItem>
                    <SelectItem value="GUARDIAN">Legal guardian</SelectItem>
                    <SelectItem value="CAREGIVER">Caregiver / representative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Title / description *</Label>
                <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="e.g. Consent for appendectomy, Consent to share records with cardiologist" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Additional notes (optional)</Label>
                <Textarea rows={2} value={cDetails} onChange={(e) => setCDetails(e.target.value)} placeholder="Any conditions, limitations, or additional context…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valid until (optional)</Label>
                <Input type="date" value={cValidUntil} onChange={(e) => setCValidUntil(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button disabled={saving || !cTitle.trim()} onClick={addConsent}>
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                {saving ? "Saving…" : "Record consent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {consents.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No consents recorded</p>
          <p className="mt-1 text-xs text-muted-foreground">Record informed consent for procedures, referrals, and data sharing. Required under DPDP Act.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consents.map((c) => {
            const isRevoked = !!c.revoked_at;
            const isExpired = c.valid_until ? new Date(c.valid_until) < new Date() : false;
            const isActive = !isRevoked && !isExpired;
            return (
              <div
                key={c.id}
                className={`rounded-xl border bg-card p-4 shadow-card ${isRevoked ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${CONSENT_TYPE_COLORS[c.consent_type]}`}>
                      {CONSENT_TYPE_LABELS[c.consent_type]}
                    </span>
                    <div>
                      <div className="font-semibold text-sm">{c.title}</div>
                      {c.details && <p className="mt-0.5 text-xs text-muted-foreground">{c.details}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive && (
                      <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    )}
                    {isRevoked && (
                      <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        <XCircle className="h-3 w-3" /> Revoked
                      </span>
                    )}
                    {!isRevoked && isExpired && (
                      <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                        Expired
                      </span>
                    )}
                    {isActive && c.recorded_by_user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => { setRevokeId(c.id); setRevokeReason(""); }}
                      >
                        <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revoke
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span><span className="font-medium text-foreground/70">By:</span> {c.consented_by === "PATIENT" ? "Patient" : c.consented_by === "GUARDIAN" ? "Legal guardian" : "Caregiver"}</span>
                  <span><span className="font-medium text-foreground/70">Method:</span> {c.consent_method}</span>
                  <span><span className="font-medium text-foreground/70">Recorded:</span> {formatDateTime(c.recorded_at)} by {c.recorded_by_name}</span>
                  {c.valid_until && <span><span className="font-medium text-foreground/70">Valid until:</span> {formatDate(c.valid_until)}</span>}
                  {c.revoked_at && <span><span className="font-medium text-foreground/70">Revoked:</span> {formatDateTime(c.revoked_at)}{c.revocation_reason ? ` — ${c.revocation_reason}` : ""}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Revoke dialog */}
      <Dialog open={!!revokeId} onOpenChange={(o) => { if (!o) setRevokeId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" /> Revoke consent
            </DialogTitle>
            <DialogDescription>
              This marks the consent as no longer valid. It will remain in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason for revocation (optional)</Label>
            <Textarea rows={2} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="e.g. Patient withdrew consent verbally on follow-up visit." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={revokeConsent}>
              {saving ? "Revoking…" : "Confirm revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
