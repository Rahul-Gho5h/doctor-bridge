import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { z } from "zod";
import { ArrowLeft, Check, X, Send, MessageSquare, ClipboardList, XCircle, Ban, Download, MessageCircleQuestion, CalendarClock, Bell, MessageSquareMore } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UrgencyBadge } from "@/components/common/UrgencyBadge";
import { DetailSkeleton } from "@/components/common/Skeletons";
import { EmptyState } from "@/components/common/EmptyState";
import { printReferralLetter } from "@/lib/printReferral";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime, relativeTime } from "@/lib/format";
import { notifyUser } from "@/lib/notify";
import { toast } from "sonner";

export const Route = createFileRoute("/referrals/$referralId")({
  head: () => ({ meta: [{ title: "Referral — Doctor Bridge" }] }),
  validateSearch: z.object({ from: z.enum(["sent", "received"]).optional() }),
  component: ReferralDetailPage,
});

interface ReferralFull {
  id: string;
  referral_number: string;
  status: string;
  urgency: "ROUTINE" | "SEMI_URGENT" | "URGENT";
  primary_diagnosis: string;
  diagnosis_code: string | null;
  clinical_summary: string;
  referral_reason: string;
  patient_snapshot: { name?: string; age?: number; gender?: string; mrn?: string; phone?: string; chronic_conditions?: string[] };
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  completed_at: string | null;
  decline_reason: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  outcome_recorded_at: string | null;
  referral_type: "REFERRAL" | "SECOND_OPINION" | null;
  appointment_date: string | null;
  appointment_notes: string | null;
  originating_clinic_name: string;
  referring_doctor_id: string;
  specialist_id: string;
  referring_doctor: { user_id: string; profile: { first_name: string; last_name: string } | null } | null;
  specialist: { user_id: string; profile: { first_name: string; last_name: string; specialization: string | null } | null } | null;
}

interface MessageRow {
  id: string; referral_id: string; sender_id: string; sender_name: string; sender_role: string;
  message: string; created_at: string;
}

function ReferralDetailPage() {
  const { referralId } = Route.useParams();
  const { from } = Route.useSearch();
  const { user, profile, roles } = useAuth();
  const router = useRouter();
  const [ref, setRef] = useState<ReferralFull | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const messagesBox = useRef<HTMLDivElement>(null);

  // Load + mark viewed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select(`
          id,referral_number,status,urgency,referral_type,primary_diagnosis,diagnosis_code,clinical_summary,referral_reason,
          patient_snapshot,created_at,sent_at,viewed_at,accepted_at,declined_at,completed_at,decline_reason,
          outcome,outcome_notes,outcome_recorded_at,appointment_date,appointment_notes,
          originating_clinic_name,referring_doctor_id,specialist_id
        `)
        .eq("id", referralId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { console.error(error); setLoading(false); return; }

      const docIds = [(data as any).referring_doctor_id, (data as any).specialist_id].filter(Boolean);
      const { data: docs } = await supabase.from("doctor_profiles").select("id,user_id").in("id", docIds);
      const userIds = (docs ?? []).map((d: any) => d.user_id);
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id,first_name,last_name,specialization").in("id", userIds)
        : { data: [] as any[] };

      const docMap = new Map((docs ?? []).map((d: any) => [d.id, d]));
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const refDoc = docMap.get((data as any).referring_doctor_id);
      const spDoc = docMap.get((data as any).specialist_id);

      const r: ReferralFull = {
        ...(data as any),
        referring_doctor: refDoc ? { user_id: refDoc.user_id, profile: profMap.get(refDoc.user_id) ?? null } : null,
        specialist: spDoc ? { user_id: spDoc.user_id, profile: profMap.get(spDoc.user_id) ?? null } : null,
      };
      setRef(r);

      const { data: msgs } = await supabase
        .from("referral_messages").select("*").eq("referral_id", referralId).order("created_at");
      if (!cancelled) {
        const rows = (msgs ?? []) as MessageRow[];
        setMessages(rows);
        // Seed the poll cursor so we only fetch new messages going forward
        const last = rows.at(-1);
        if (last) latestTsRef.current = last.created_at;
      }
      setLoading(false);

      // mark viewed if specialist views first time
      if (user && r.specialist?.user_id === user.id && !r.viewed_at && r.status === "SENT") {
        await supabase.from("referrals")
          .update({ viewed_at: new Date().toISOString(), status: "VIEWED" })
          .eq("id", referralId);
      }
    })();
    return () => { cancelled = true; };
  }, [referralId, user]);

  // Poll for new messages every 3 s.
  // postgres_changes on referral_messages doesn't deliver reliably when the RLS
  // policy uses a SECURITY DEFINER helper (auth.uid() is null in that context).
  // Polling is simple, reliable, and fast enough for clinical chat.
  const latestTsRef = useRef<string | null>(null);

  const pollMessages = useCallback(async () => {
    try {
      const since = latestTsRef.current;
      const query = supabase
        .from("referral_messages")
        .select("*")
        .eq("referral_id", referralId)
        .order("created_at");
      if (since) query.gt("created_at", since);
      const { data } = await query;
      if (!data || data.length === 0) return;
      setMessages((prev) => {
        let next = [...prev];
        for (const msg of data as MessageRow[]) {
          // Replace matching optimistic row, or append if new
          const optIdx = next.findIndex(
            (m) => m.id.startsWith("opt-") && m.sender_id === msg.sender_id && m.message === msg.message
          );
          if (optIdx !== -1) {
            next[optIdx] = msg;
          } else if (!next.some((m) => m.id === msg.id)) {
            next = [...next, msg];
          }
        }
        return next;
      });
      // Advance the cursor to the latest received timestamp
      const last = (data as MessageRow[]).at(-1);
      if (last) latestTsRef.current = last.created_at;
    } catch (err) {
      console.error("[pollMessages] error:", err);
    }
  }, [referralId]);

  useEffect(() => {
    if (loading) return; // don't start polling until initial load is done
    const id = setInterval(pollMessages, 3000);
    return () => clearInterval(id);
  }, [loading, pollMessages]);

  useEffect(() => {
    if (messagesBox.current) {
      messagesBox.current.scrollTo({ top: messagesBox.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  // Compute tab-back target even before ref loads (used in back link)
  const isSpecialistCheck = ref ? user?.id === ref.specialist?.user_id : false;

  if (loading) return <DashboardLayout><DetailSkeleton /></DashboardLayout>;
  if (!ref) return (
    <DashboardLayout>
      <Link to="/referrals" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All referrals
      </Link>
      <EmptyState
        icon={Send}
        title="Referral not found"
        description="This referral could not be found or you may not have permission to view it."
      />
    </DashboardLayout>
  );

  const isSpecialist = user?.id === ref.specialist?.user_id;
  const isReferrer = user?.id === ref.referring_doctor?.user_id;
  const role = isSpecialist ? "specialist" : isReferrer ? "referrer" : "viewer";

  const updateStatus = async (patch: Record<string, unknown>): Promise<boolean> => {
    const { error } = await supabase.from("referrals").update(patch as never).eq("id", ref.id);
    if (error) { toast.error(error.message); return false; }
    setRef({ ...ref, ...(patch as Partial<ReferralFull>) });
    toast.success("Updated");
    return true;
  };

  const accept = async () => {
    const ok = await updateStatus({ status: "ACCEPTED", accepted_at: new Date().toISOString() });
    if (!ok || !ref.referring_doctor?.user_id) return;
    const specName = `Dr. ${ref.specialist?.profile?.first_name ?? ""} ${ref.specialist?.profile?.last_name ?? ""}`.trim();
    void notifyUser(ref.referring_doctor.user_id, {
      type:    "REFERRAL_ACCEPTED",
      title:   "Referral accepted",
      message: `${specName} accepted your referral for ${ref.patient_snapshot?.name ?? "patient"}.`,
      data:    { referral_id: ref.id },
    });
  };

  const decline = async () => {
    if (!declineReason.trim()) { toast.error("Please provide a reason for declining."); return; }
    const reason = declineReason.trim();
    const ok = await updateStatus({ status: "DECLINED", declined_at: new Date().toISOString(), decline_reason: reason });
    setDeclineOpen(false);
    setDeclineReason("");
    if (!ok || !ref.referring_doctor?.user_id) return;
    const specName = `Dr. ${ref.specialist?.profile?.first_name ?? ""} ${ref.specialist?.profile?.last_name ?? ""}`.trim();
    void notifyUser(ref.referring_doctor.user_id, {
      type:    "REFERRAL_DECLINED",
      title:   "Referral declined",
      message: `${specName} declined your referral for ${ref.patient_snapshot?.name ?? "patient"}. Reason: ${reason}`,
      data:    { referral_id: ref.id },
    });
  };

  const cancel = async () => {
    setCancelling(true);
    const ok = await updateStatus({ status: "CANCELLED" });
    setCancelling(false);
    setCancelOpen(false);
    if (ok) {
      toast.success("Referral cancelled");
      router.navigate({ to: "/referrals" });
    }
  };

  const sendMessage = async () => {
    if (!draft.trim() || !user || !profile) return;
    const text = draft.trim();
    const senderName = `Dr. ${profile.first_name} ${profile.last_name}`;
    const senderRole = roles[0] ?? "doctor";

    // Optimistic: show message instantly in the UI
    const tempId = `opt-${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId, referral_id: ref.id, sender_id: user.id,
      sender_name: senderName, sender_role: senderRole,
      message: text, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);

    const { data: inserted, error } = await supabase
      .from("referral_messages")
      .insert({ referral_id: ref.id, sender_id: user.id, sender_name: senderName, sender_role: senderRole, message: text })
      .select()
      .single();

    setSending(false);
    if (error) {
      toast.error(error.message);
      // Roll back optimistic message and restore draft
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      return;
    }
    // Swap temp id with the real DB row (realtime may also fire; dedup handles it)
    if (inserted) {
      setMessages((prev) => prev.map((m) => m.id === tempId ? (inserted as MessageRow) : m));
    }

    // Notify the other party — fire-and-forget
    const recipientUserId = isSpecialist
      ? ref.referring_doctor?.user_id
      : ref.specialist?.user_id;
    if (recipientUserId) {
      void notifyUser(recipientUserId, {
        type:    "REFERRAL_MESSAGE",
        title:   `Message from ${senderName}`,
        message: text.length > 120 ? `${text.slice(0, 120)}…` : text,
        data:    { referral_id: ref.id },
      });
    }
  };

  return (
    <DashboardLayout>
      <Link
        to="/referrals"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All referrals
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{ref.primary_diagnosis}</h1>
            <UrgencyBadge urgency={ref.urgency} />
            {ref.referral_type === "SECOND_OPINION" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <MessageCircleQuestion className="h-3 w-3" /> Second opinion
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{ref.referral_number}</span>
            {ref.diagnosis_code && <span className="font-mono text-xs">· {ref.diagnosis_code}</span>}
            <StatusBadge status={ref.status} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => printReferralLetter(ref)}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>

          {isSpecialist && (ref.status === "SENT" || ref.status === "VIEWED" || ref.status === "ACKNOWLEDGED") && (
            <>
              <Button onClick={accept}><Check className="mr-1.5 h-4 w-4" /> Accept</Button>
              <Button variant="outline" onClick={() => setDeclineOpen(true)}>
                <X className="mr-1.5 h-4 w-4" /> Decline
              </Button>
            </>
          )}

          {isReferrer && (ref.status === "SENT" || ref.status === "VIEWED" || ref.status === "ACKNOWLEDGED" || ref.status === "ACCEPTED") && (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              <Ban className="mr-1.5 h-4 w-4" /> Cancel referral
            </Button>
          )}
        </div>

        {/* Decline dialog */}
        <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" /> Decline referral
              </DialogTitle>
              <DialogDescription>
                Let the referring doctor know why you're declining. This will be visible to them.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                rows={3}
                placeholder="e.g. Currently at capacity, please try Dr. Mehta at Apollo. / Patient requires a different subspecialty."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeclineOpen(false); setDeclineReason(""); }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={decline} disabled={!declineReason.trim()}>
                <XCircle className="mr-1.5 h-4 w-4" /> Confirm decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel dialog */}
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-destructive" /> Cancel referral
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this referral? The specialist will no longer be able to act on it. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                Keep referral
              </Button>
              <Button variant="destructive" onClick={cancel} disabled={cancelling}>
                <Ban className="mr-1.5 h-4 w-4" /> {cancelling ? "Cancelling…" : "Confirm cancel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Patient">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Row label="Name" value={ref.patient_snapshot?.name ?? "—"} />
              <Row label="Age / sex" value={`${ref.patient_snapshot?.age ?? "—"}y / ${ref.patient_snapshot?.gender ?? "—"}`} />
              <Row label="MRN" value={ref.patient_snapshot?.mrn ?? "—"} />
              <Row label="Phone" value={ref.patient_snapshot?.phone ?? "—"} />
            </dl>
            {ref.patient_snapshot?.chronic_conditions && ref.patient_snapshot.chronic_conditions.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-muted-foreground">Chronic conditions</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ref.patient_snapshot.chronic_conditions.map((c) => (
                    <span key={c} className="rounded-md bg-muted px-2 py-0.5 text-xs">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title={ref.referral_type === "SECOND_OPINION" ? "Current findings & treatment plan" : "Clinical summary"}>
            <p className="whitespace-pre-line text-sm">{ref.clinical_summary}</p>
          </Card>
          <Card title={ref.referral_type === "SECOND_OPINION" ? "Question for specialist" : "Reason for referral"}>
            {ref.referral_type === "SECOND_OPINION" && (
              <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>This is a second opinion request. Please review the findings independently and answer the question below.</span>
              </div>
            )}
            <p className="whitespace-pre-line text-sm">{ref.referral_reason}</p>
          </Card>

          <Card title="Conversation" icon={MessageSquare}>
            <div ref={messagesBox} className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation below.</p>
                </div>
              ) : messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="text-[11px] opacity-80">{m.sender_name} · {relativeTime(m.created_at)}</div>
                      <div className="mt-0.5 whitespace-pre-line">{m.message}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEnd} />
            </div>

            {role !== "viewer" && (
              <div className="mt-4 flex gap-2 border-t pt-4">
                <Textarea rows={2} placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <Button onClick={sendMessage} disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>

          {isSpecialist && ref.status === "ACCEPTED" && (
            <AppointmentForm
              referralId={ref.id}
              existingDate={ref.appointment_date}
              existingNotes={ref.appointment_notes}
              onSaved={(patch) => {
                setRef({ ...ref, ...patch });
                // Notify referring doctor
                if (ref.referring_doctor?.user_id) {
                  const specName = `Dr. ${ref.specialist?.profile?.first_name ?? ""} ${ref.specialist?.profile?.last_name ?? ""}`.trim();
                  const apptLabel = patch.appointment_date
                    ? new Date(patch.appointment_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                    : "a new time";
                  void import("@/lib/notify").then(({ notifyUser }) =>
                    notifyUser(ref.referring_doctor!.user_id, {
                      type: "APPOINTMENT_SCHEDULED",
                      title: "Appointment scheduled",
                      message: `${specName} scheduled an appointment for ${ref.patient_snapshot?.name ?? "your patient"} on ${apptLabel}.`,
                      data: { referral_id: ref.id },
                    })
                  );
                }
              }}
            />
          )}

          {/* Show appointment if already set */}
          {ref.appointment_date && (
            <Card title="Appointment" icon={CalendarClock}>
              <div className="space-y-1 text-sm">
                <div className="font-semibold text-sm">
                  {new Date(ref.appointment_date).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}
                </div>
                {ref.appointment_notes && (
                  <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm whitespace-pre-line">{ref.appointment_notes}</div>
                )}
              </div>
            </Card>
          )}

          {isSpecialist && (ref.status === "ACCEPTED" || ref.status === "APPOINTMENT_BOOKED") && (
            <OutcomeForm referralId={ref.id} onSaved={(patch) => setRef({ ...ref, ...patch })} />
          )}

          {ref.outcome && (
            <Card title="Outcome" icon={ClipboardList}>
              <div className="space-y-2 text-sm">
                <Row label="Outcome" value={ref.outcome.replace(/_/g, " ")} />
                <Row label="Recorded" value={formatDateTime(ref.outcome_recorded_at)} />
                {ref.outcome_notes && (
                  <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">{ref.outcome_notes}</div>
                )}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Parties">
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Referring</div>
                <div className="mt-0.5 font-medium">Dr. {ref.referring_doctor?.profile?.first_name} {ref.referring_doctor?.profile?.last_name}</div>
                <div className="text-xs text-muted-foreground">{ref.originating_clinic_name}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Specialist</div>
                <div className="mt-0.5 font-medium">Dr. {ref.specialist?.profile?.first_name} {ref.specialist?.profile?.last_name}</div>
                <div className="text-xs text-muted-foreground">{ref.specialist?.profile?.specialization}</div>
              </div>
            </div>
          </Card>

          <Card title="Timeline">
            <ol className="space-y-3 text-sm">
              <Step label="Created" at={ref.created_at} />
              <Step label="Sent" at={ref.sent_at} />
              <Step label="Viewed by specialist" at={ref.viewed_at} />
              <Step label="Accepted" at={ref.accepted_at} />
              <Step label="Declined" at={ref.declined_at} />
              <Step label="Appointment scheduled" at={ref.appointment_date} />
              <Step label="Completed" at={ref.completed_at} />
            </ol>
          </Card>

          {/* Follow-up reminder — available on any active referral */}
          {role !== "viewer" && ref.status !== "COMPLETED" && ref.status !== "DECLINED" && (
            <ReminderForm referralId={ref.id} userId={user?.id ?? ""} />
          )}

          {/* Case discussion shortcut */}
          <Link
            to="/discussions"
            className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm shadow-card hover:border-primary/40 transition-colors"
          >
            <MessageSquareMore className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">Case discussions</div>
              <div className="text-xs text-muted-foreground">Invite other specialists to collaborate</div>
            </div>
          </Link>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function AppointmentForm({
  referralId, existingDate, existingNotes, onSaved,
}: {
  referralId: string;
  existingDate: string | null;
  existingNotes: string | null;
  onSaved: (patch: Partial<ReferralFull>) => void;
}) {
  const [date, setDate] = useState(() => {
    if (existingDate) return new Date(existingDate).toISOString().slice(0, 16);
    // Default: next working day at 10:00
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState(existingNotes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const patch: Record<string, unknown> = {
      appointment_date: new Date(date).toISOString(),
      appointment_notes: notes.trim() || null,
      status: "APPOINTMENT_BOOKED",
      appointment_booked_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("referrals").update(patch as never).eq("id", referralId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved(patch as Partial<ReferralFull>);
    toast.success("Appointment date set — referring doctor notified");
  };

  return (
    <Card title="Schedule appointment" icon={CalendarClock}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Propose an appointment date for this patient. The referring doctor will be notified.
        </p>
        <div className="space-y-2">
          <Label>Date & time *</Label>
          <Input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
        </div>
        <div className="space-y-2">
          <Label>Instructions for patient / GP (optional)</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Patient should fast 8 hrs before. Bring latest CBC and lipid panel."
          />
        </div>
        <Button onClick={submit} disabled={saving}>
          <CalendarClock className="mr-1.5 h-4 w-4" />
          {saving ? "Saving…" : existingDate ? "Update appointment" : "Set appointment"}
        </Button>
      </div>
    </Card>
  );
}

function OutcomeForm({ referralId, onSaved }: { referralId: string; onSaved: (patch: Partial<ReferralFull>) => void }) {
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!outcome) { toast.error("Pick an outcome"); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { outcome, outcome_notes: notes || null, outcome_recorded_at: now, status: "COMPLETED", completed_at: now };
    const { error } = await supabase.from("referrals").update(patch as never).eq("id", referralId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved(patch as Partial<ReferralFull>);
    toast.success("Outcome recorded");
  };

  return (
    <Card title="Record outcome" icon={ClipboardList}>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TREATED_AND_DISCHARGED">Treated and discharged</SelectItem>
              <SelectItem value="ONGOING_TREATMENT">Ongoing treatment</SelectItem>
              <SelectItem value="REFERRED_FURTHER">Referred further</SelectItem>
              <SelectItem value="DECLINED_BY_PATIENT">Declined by patient</SelectItem>
              <SelectItem value="TREATMENT_NOT_REQUIRED">Treatment not required</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save outcome"}</Button>
      </div>
    </Card>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}

function Step({ label, at }: { label: string; at: string | null }) {
  return (
    <li className={`flex items-start gap-2 ${at ? "" : "opacity-40"}`}>
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${at ? "bg-primary" : "bg-muted-foreground/30"}`} />
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{at ? formatDateTime(at) : "Pending"}</div>
      </div>
    </li>
  );
}

function ReminderForm({ referralId, userId }: { referralId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [message, setMessage] = useState("Follow up on referral outcome");
  const [type, setType] = useState<string>("FOLLOW_UP");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("follow_up_reminders").insert({
      referral_id: referralId,
      created_by: userId,
      remind_at: new Date(remindAt).toISOString(),
      reminder_type: type,
      message: message.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reminder set — you'll be notified on the due date");
    setOpen(false);
  };

  return (
    <section className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-muted-foreground" /> Follow-up reminder
        </h2>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
          Set reminder
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Get notified when it's time to check on the outcome of this referral.
      </p>

      {open && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FOLLOW_UP">Follow-up check</SelectItem>
                <SelectItem value="OUTCOME_DUE">Outcome due</SelectItem>
                <SelectItem value="APPOINTMENT_REMINDER">Appointment reminder</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Remind me on</Label>
            <Input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Message *</Label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What to remind you about…"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button size="sm" disabled={saving || !message.trim()} onClick={save} className="flex-1">
              <Bell className="mr-1 h-3.5 w-3.5" />{saving ? "…" : "Set"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
