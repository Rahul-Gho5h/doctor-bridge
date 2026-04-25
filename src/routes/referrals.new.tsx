import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft, Send, Sparkles, RotateCcw,
  BookmarkPlus, LayoutTemplate, Trash2,
  Stethoscope, MessageCircleQuestion,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CONDITIONS } from "@/lib/conditions";
import { age } from "@/lib/format";
import { notifyUser } from "@/lib/notify";
import { toast } from "sonner";
import { FileDropzone } from "@/components/patients/FileDropzone";
import type { StoredAttachment } from "@/lib/storage";

const search = z.object({
  specialistId: z.string().optional(),
  patientId: z.string().optional(),
});

export const Route = createFileRoute("/referrals/new")({
  head: () => ({ meta: [{ title: "New referral — Doctor Bridge" }] }),
  validateSearch: search,
  component: NewReferralPage,
});

interface PatientLite {
  id: string; display_id: string; first_name: string; last_name: string;
  date_of_birth: string; gender: string; phone: string; chronic_conditions: string[];
  allergies: string[]; current_medications: string[];
}

interface DoctorLite {
  id: string; user_id: string; nmc_number: string;
  profile: { first_name: string; last_name: string; specialization: string | null } | null;
  clinic: { name: string } | null;
}

interface ReferralTemplate {
  id: string;
  name: string;
  specialist_id: string | null;
  condition_code: string | null;
  diagnosis: string | null;
  urgency: "ROUTINE" | "SEMI_URGENT" | "URGENT";
  clinical_summary: string | null;
  referral_reason: string | null;
  use_count: number;
}

function NewReferralPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { specialistId, patientId: prefilledPatientId } = Route.useSearch();

  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [specialists, setSpecialists] = useState<DoctorLite[]>([]);
  const [myDoctorProfileId, setMyDoctorProfileId] = useState<string | null>(null);
  const [originatingClinic, setOriginatingClinic] = useState<{ id: string; name: string } | null>(null);

  const [patientId, setPatientId] = useState<string>(prefilledPatientId ?? "");
  const [specialist, setSpecialist] = useState<string>(specialistId ?? "");
  const [conditionCode, setConditionCode] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [urgency, setUrgency] = useState<"ROUTINE" | "SEMI_URGENT" | "URGENT">("ROUTINE");
  const [summary, setSummary] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);

  // Referral type
  const [referralType, setReferralType] = useState<"REFERRAL" | "SECOND_OPINION">("REFERRAL");

  // Template state
  const [templates, setTemplates] = useState<ReferralTemplate[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    (async () => {
      const [{ data: pts }, { data: docs }, { data: meDoc }, { data: clinic }] = await Promise.all([
        supabase.from("global_patients").select("id,display_id,first_name,last_name,date_of_birth,gender,phone,chronic_conditions,allergies,current_medications").order("first_name"),
        supabase.from("doctor_profiles").select("id,user_id,clinic_id,nmc_number").eq("is_public", true),
        supabase.from("doctor_profiles").select("id").eq("user_id", user.id).maybeSingle(),
        profile.clinic_id
          ? supabase.from("clinics").select("id,name").eq("id", profile.clinic_id).maybeSingle()
          : Promise.resolve({ data: null } as { data: { id: string; name: string } | null }),
      ]);

      const docRows = (docs ?? []) as any[];
      const userIds = Array.from(new Set(docRows.map((d) => d.user_id)));
      const clinicIds = Array.from(new Set(docRows.map((d) => d.clinic_id).filter(Boolean)));
      const [{ data: profs }, { data: clinics }] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id,first_name,last_name,specialization").in("id", userIds)
          : Promise.resolve({ data: [] as any[] } as any),
        clinicIds.length
          ? supabase.from("clinics").select("id,name").in("id", clinicIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const profMap = new Map<string, any>((profs ?? []).map((p: any) => [p.id as string, p]));
      const clinicMap = new Map<string, any>((clinics ?? []).map((c: any) => [c.id as string, c]));

      const enrichedDocs: DoctorLite[] = docRows
        .filter((d) => d.user_id !== user.id)
        .map((d) => ({
          id: d.id,
          user_id: d.user_id,
          nmc_number: d.nmc_number,
          profile: (profMap.get(d.user_id) as DoctorLite["profile"]) ?? null,
          clinic: (clinicMap.get(d.clinic_id) as DoctorLite["clinic"]) ?? null,
        }));

      setPatients((pts ?? []) as PatientLite[]);
      setSpecialists(enrichedDocs);
      setMyDoctorProfileId(meDoc?.id ?? null);
      setOriginatingClinic(clinic);

      // Load templates for this doctor
      if (meDoc?.id) {
        const { data: tmpl } = await supabase
          .from("referral_templates")
          .select("id,name,specialist_id,condition_code,diagnosis,urgency,clinical_summary,referral_reason,use_count")
          .eq("doctor_id", meDoc.id)
          .order("use_count", { ascending: false });
        setTemplates((tmpl ?? []) as ReferralTemplate[]);
      }
    })();
  }, [user, profile]);

  const selectedPatient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);
  const conditionOpt = useMemo(() => CONDITIONS.find((c) => c.code === conditionCode), [conditionCode]);

  useEffect(() => {
    if (conditionOpt && !diagnosis) setDiagnosis(conditionOpt.name);
  }, [conditionOpt, diagnosis]);

  // ── Apply template ──────────────────────────────────────────────────────────
  const applyTemplate = async (tpl: ReferralTemplate) => {
    if (tpl.specialist_id) setSpecialist(tpl.specialist_id);
    if (tpl.condition_code) setConditionCode(tpl.condition_code);
    if (tpl.diagnosis) setDiagnosis(tpl.diagnosis);
    setUrgency(tpl.urgency);
    if (tpl.clinical_summary) { setSummary(tpl.clinical_summary); setAiDrafted(false); }
    if (tpl.referral_reason) { setReason(tpl.referral_reason); setAiDrafted(false); }
    toast.success(`Template "${tpl.name}" loaded`);

    // Increment use_count in background
    await supabase
      .from("referral_templates")
      .update({ use_count: tpl.use_count + 1 })
      .eq("id", tpl.id);
    setTemplates((prev) =>
      prev.map((t) => (t.id === tpl.id ? { ...t, use_count: t.use_count + 1 } : t)),
    );
  };

  // ── Save template ───────────────────────────────────────────────────────────
  const saveTemplate = async () => {
    if (!myDoctorProfileId) return;
    if (!saveTemplateName.trim()) { toast.error("Give your template a name."); return; }
    setSavingTemplate(true);
    const { data, error } = await supabase
      .from("referral_templates")
      .insert({
        doctor_id: myDoctorProfileId,
        name: saveTemplateName.trim(),
        specialist_id: specialist || null,
        condition_code: conditionCode || null,
        diagnosis: diagnosis || null,
        urgency,
        clinical_summary: summary || null,
        referral_reason: reason || null,
      })
      .select()
      .single();
    setSavingTemplate(false);
    if (error) { toast.error("Could not save template."); return; }
    setTemplates((prev) => [data as ReferralTemplate, ...prev]);
    setSaveTemplateName("");
    setShowSaveInput(false);
    toast.success(`Template "${saveTemplateName.trim()}" saved`);
  };

  // ── Delete template ─────────────────────────────────────────────────────────
  const deleteTemplate = async (id: string, name: string) => {
    await supabase.from("referral_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success(`Template "${name}" deleted`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myDoctorProfileId) { toast.error("Only doctors can send referrals. Your account doesn't have a doctor profile yet."); return; }
    if (!originatingClinic) { toast.error("Missing clinic context."); return; }
    if (!selectedPatient || !specialist || !diagnosis || !summary || !reason) { toast.error("Fill in all required fields."); return; }
    setSubmitting(true);

    const { data: refNum } = await supabase.rpc("generate_referral_number");
    const refNumber = refNum ?? `REF-${Date.now()}`;
    const patientAge = age(selectedPatient.date_of_birth) ?? 0;

    const { data: created, error } = await supabase.from("referrals").insert({
      referral_number: refNumber,
      referring_doctor_id: myDoctorProfileId,
      specialist_id: specialist,
      patient_snapshot: {
        name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        age: patientAge,
        gender: selectedPatient.gender,
        mrn: selectedPatient.display_id,
        phone: selectedPatient.phone,
        chronic_conditions: selectedPatient.chronic_conditions,
        allergies: selectedPatient.allergies ?? [],
        current_medications: selectedPatient.current_medications ?? [],
      },
      primary_diagnosis: diagnosis,
      diagnosis_code: conditionCode || null,
      urgency,
      clinical_summary: summary,
      referral_reason: reason,
      referral_type: referralType,
      status: "SENT",
      sent_at: new Date().toISOString(),
      originating_clinic_id: originatingClinic.id,
      originating_clinic_name: originatingClinic.name,
      expires_at: new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
      attached_documents: attachments as unknown as any,
    }).select().single();

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Referral ${refNumber} sent`);

    // Notify the specialist — fire-and-forget, never blocks navigation
    const selectedSpec = specialists.find((s) => s.id === specialist);
    if (selectedSpec?.user_id) {
      const gpName = profile
        ? `Dr. ${profile.first_name} ${profile.last_name}`
        : "A doctor";
      const urgencyLabel = { ROUTINE: "Routine", SEMI_URGENT: "Semi-urgent", URGENT: "Urgent" }[urgency];
      void notifyUser(selectedSpec.user_id, {
        type:    "NEW_REFERRAL",
        title:   referralType === "SECOND_OPINION"
          ? `Second opinion request from ${gpName}`
          : `New referral from ${gpName}`,
        message: `${selectedPatient.first_name} ${selectedPatient.last_name} · ${diagnosis} · ${urgencyLabel}`,
        data:    { referral_id: created.id },
      });
    }

    router.navigate({ to: "/referrals/$referralId", params: { referralId: created.id } });
  };

  const draftWithAI = async () => {
    if (!selectedPatient || !diagnosis.trim()) {
      toast.error("Select a patient and enter a primary diagnosis first.");
      return;
    }
    setDrafting(true);

    const { data: encounters } = await supabase
      .from("patient_encounters")
      .select("type,title,details,occurred_at,hospital_name")
      .eq("global_patient_id", selectedPatient.id)
      .order("occurred_at", { ascending: false })
      .limit(8);

    const selectedSpecialist = specialists.find((s) => s.id === specialist);
    const specialization = selectedSpecialist?.profile?.specialization ?? "specialist";
    const doctorName = profile ? `Dr. ${profile.first_name} ${profile.last_name}` : "the referring doctor";

    const { data, error } = await supabase.functions.invoke("draft-referral", {
      body: {
        patient: {
          name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
          age: selectedPatient.date_of_birth
            ? Math.floor((Date.now() - new Date(selectedPatient.date_of_birth).getTime()) / 31557600000)
            : 0,
          gender: selectedPatient.gender,
          chronic_conditions: selectedPatient.chronic_conditions ?? [],
        },
        diagnosis: diagnosis.trim(),
        condition_code: conditionCode || undefined,
        urgency,
        specialist_specialization: specialization,
        encounters: (encounters ?? []) as { type: string; title: string; details: string | null; occurred_at: string; hospital_name: string | null }[],
        referring_doctor_name: doctorName,
      },
    });

    setDrafting(false);

    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "AI drafting failed. Please write manually.");
      return;
    }

    if (data?.clinical_summary) setSummary(data.clinical_summary);
    if (data?.referral_reason) setReason(data.referral_reason);
    setAiDrafted(true);
    toast.success(data?.mock ? "Draft generated (template mode — add ANTHROPIC_API_KEY for AI)" : "AI draft ready — review and edit before sending");
  };

  if (!myDoctorProfileId && user && profile) {
    return (
      <DashboardLayout>
        <PageHeader title="Send a referral" />
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Only doctors with a verified NMC profile can send referrals. Your account is registered as <span className="font-medium text-foreground">{profile.title ?? "staff"}</span>. Please complete your doctor profile registration to access this feature.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <button
        onClick={() => router.history.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PageHeader
        title={referralType === "SECOND_OPINION" ? "Request a second opinion" : "Send a referral"}
        description={
          referralType === "SECOND_OPINION"
            ? "Ask a specialist for their independent view on diagnosis or treatment."
            : "Send a patient to a specialist with full clinical context."
        }
      />

      {/* Referral type toggle */}
      <div className="mb-6 inline-flex rounded-lg border bg-muted p-1 gap-1">
        <button
          type="button"
          onClick={() => setReferralType("REFERRAL")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            referralType === "REFERRAL"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Stethoscope className="h-4 w-4" /> Standard referral
        </button>
        <button
          type="button"
          onClick={() => setReferralType("SECOND_OPINION")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            referralType === "SECOND_OPINION"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircleQuestion className="h-4 w-4" /> Second opinion
        </button>
      </div>

      {referralType === "SECOND_OPINION" && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Second opinion mode:</strong> The specialist will be asked to review your findings independently and share their view — not to take over patient care. All fields still apply.
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="1. Patient">
            <div className="space-y-2">
              <Label>Select patient *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Choose patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} · {p.display_id} · {age(p.date_of_birth)}y
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPatient && (
              <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
                <div className="font-medium text-foreground">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                <div className="text-muted-foreground">{age(selectedPatient.date_of_birth)}y · {selectedPatient.gender} · {selectedPatient.phone}</div>
                {selectedPatient.chronic_conditions.length > 0 && (
                  <div className="mt-1 text-muted-foreground">
                    Chronic: <span className="text-foreground">{selectedPatient.chronic_conditions.join(", ")}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="2. Specialist">
            <div className="space-y-2">
              <Label>Refer to *</Label>
              <Select value={specialist} onValueChange={setSpecialist}>
                <SelectTrigger><SelectValue placeholder="Choose specialist" /></SelectTrigger>
                <SelectContent>
                  {specialists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Dr. {d.profile?.first_name} {d.profile?.last_name} — {d.profile?.specialization} · {d.clinic?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card title="3. Clinical details">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>ICD-10 condition</Label>
                  <Select value={conditionCode} onValueChange={setConditionCode}>
                    <SelectTrigger><SelectValue placeholder="Pick a condition" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgency *</Label>
                  <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROUTINE">Routine</SelectItem>
                      <SelectItem value="SEMI_URGENT">Semi-urgent</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Primary diagnosis *</Label>
                <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Acute kidney injury" />
              </div>

              {/* AI Draft button */}
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary-soft px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-accent-foreground">
                    <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                    AI-assisted drafting
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {!selectedPatient || !diagnosis.trim()
                      ? "Select a patient and enter a diagnosis to enable."
                      : "Auto-fill clinical summary & reason from the patient's EMR history."}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 gap-2">
                  {aiDrafted && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => { setSummary(""); setReason(""); setAiDrafted(false); }}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Clear
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={drafting || !selectedPatient || !diagnosis.trim()}
                    onClick={draftWithAI}
                  >
                    {drafting
                      ? <><span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent inline-block" />Drafting…</>
                      : <><Sparkles className="mr-1.5 h-3.5 w-3.5" />{aiDrafted ? "Re-draft" : "Draft with AI"}</>
                    }
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {referralType === "SECOND_OPINION" ? "Current findings & treatment plan *" : "Clinical summary *"}
                  </Label>
                  {aiDrafted && <span className="text-[10px] font-medium text-primary">✦ AI drafted — edit as needed</span>}
                </div>
                <Textarea
                  rows={5}
                  value={summary}
                  onChange={(e) => { setSummary(e.target.value); }}
                  placeholder={
                    referralType === "SECOND_OPINION"
                      ? "Describe your current diagnosis, treatment plan, and what you have already tried…"
                      : "Relevant history, vitals, current medications, recent labs…"
                  }
                  className={aiDrafted ? "border-primary/30 bg-primary-soft/20" : ""}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {referralType === "SECOND_OPINION" ? "Specific question for the specialist *" : "Reason for referral *"}
                  </Label>
                  {aiDrafted && <span className="text-[10px] font-medium text-primary">✦ AI drafted — edit as needed</span>}
                </div>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    referralType === "SECOND_OPINION"
                      ? "e.g. Do you agree with the diagnosis of X? Is the proposed surgery necessary given the current findings?"
                      : "What you'd like the specialist to do."
                  }
                  className={aiDrafted ? "border-primary/30 bg-primary-soft/20" : ""}
                />
              </div>
            </div>
          </Card>

          <Card title="4. Patient reports & attachments">
            <p className="mb-3 text-xs text-muted-foreground">
              Share lab reports, imaging, prescriptions, or any prior records with the specialist. Files are stored privately and accessible only to the referring doctor and the receiving specialist.
            </p>
            {selectedPatient ? (
              <FileDropzone
                patientId={selectedPatient.id}
                uploadedBy={user?.id ?? ""}
                value={attachments}
                onChange={setAttachments}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">Select a patient first to attach reports.</p>
            )}
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4">
          <div className="sticky top-4 space-y-4">

            {/* Send button */}
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <h3 className="font-semibold">Ready to send?</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                The specialist will be notified immediately and can accept, decline, or message you back.
              </p>
              <Button type="submit" className="mt-4 w-full" disabled={submitting}>
                <Send className="mr-1.5 h-4 w-4" /> {submitting ? "Sending…" : "Send referral"}
              </Button>
            </div>

            {/* ── Templates card ── */}
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Templates</h3>
                  {templates.length > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {templates.length}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowSaveInput((v) => !v)}
                >
                  <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
                  Save current
                </Button>
              </div>

              {/* Save-as-template input */}
              {showSaveInput && (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={saveTemplateName}
                    onChange={(e) => setSaveTemplateName(e.target.value)}
                    placeholder="Template name…"
                    className="h-8 text-xs"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveTemplate(); } }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={savingTemplate || !saveTemplateName.trim()}
                    onClick={saveTemplate}
                  >
                    {savingTemplate ? "…" : "Save"}
                  </Button>
                </div>
              )}

              {/* Template list */}
              {templates.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  No templates yet. Fill out a referral and click <span className="font-medium text-foreground">Save current</span> to create one.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {templates.map((tpl) => (
                    <li key={tpl.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => applyTemplate(tpl)}
                      >
                        <span className="block truncate text-xs font-medium text-foreground hover:text-primary">
                          {tpl.name}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {tpl.urgency === "URGENT" ? "🔴 Urgent" : tpl.urgency === "SEMI_URGENT" ? "🟡 Semi-urgent" : "🟢 Routine"}
                          {tpl.diagnosis ? ` · ${tpl.diagnosis}` : ""}
                          {tpl.use_count > 0 ? ` · used ${tpl.use_count}×` : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => deleteTemplate(tpl.id, tpl.name)}
                        title="Delete template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* AI drafting hint */}
            <div className="rounded-xl border border-primary/20 bg-primary-soft p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI drafting
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                In the clinical details section, select a patient + diagnosis then click <span className="font-medium text-foreground">Draft with AI</span> to auto-fill the summary from the patient's EMR. Always review before sending.
              </p>
            </div>
          </div>
        </aside>
      </form>
    </DashboardLayout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
