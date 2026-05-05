import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Search,
  UserCheck, CheckCircle2, XCircle, AlertTriangle, Clock,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/appointments")({
  head: () => ({ meta: [{ title: "Appointments — Doctor Bridge" }] }),
  component: AppointmentsPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type ApptStatus =
  | "SCHEDULED" | "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS"
  | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";

type ApptType = "IN_PERSON" | "TELEMEDICINE" | "HOME_VISIT" | "FOLLOW_UP" | "EMERGENCY";

interface Appt {
  id: string;
  scheduled_at: string;
  end_time: string;
  duration: number;
  status: ApptStatus;
  type: ApptType;
  reason: string | null;
  chief_complaint: string | null;
  notes: string | null;
  patient: { id: string; first_name: string; last_name: string; display_id: string } | null;
  doctor: { id: string; first_name: string; last_name: string; specialization: string | null } | null;
}

interface PatientHit {
  id: string;
  first_name: string;
  last_name: string;
  display_id: string;
}

interface DoctorRow {
  id: string;
  first_name: string;
  last_name: string;
  specialization: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekStart(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dow);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const TYPE_LABELS: Record<ApptType, string> = {
  IN_PERSON: "In-person", TELEMEDICINE: "Telemedicine",
  HOME_VISIT: "Home visit", FOLLOW_UP: "Follow-up", EMERGENCY: "Emergency",
};

const STATUS_ACTIONS: Partial<Record<ApptStatus, { label: string; next: ApptStatus; icon: React.ComponentType<{ className?: string }> }[]>> = {
  SCHEDULED:  [{ label: "Confirm",   next: "CONFIRMED",  icon: CheckCircle2 },
               { label: "Cancel",    next: "CANCELLED",  icon: XCircle }],
  CONFIRMED:  [{ label: "Check in",  next: "CHECKED_IN", icon: UserCheck },
               { label: "No-show",   next: "NO_SHOW",    icon: AlertTriangle },
               { label: "Cancel",    next: "CANCELLED",  icon: XCircle }],
  CHECKED_IN: [{ label: "Start",     next: "IN_PROGRESS",icon: Clock },
               { label: "Complete",  next: "COMPLETED",  icon: CheckCircle2 }],
  IN_PROGRESS:[{ label: "Complete",  next: "COMPLETED",  icon: CheckCircle2 }],
};

// ── Main component ────────────────────────────────────────────────────────────

function AppointmentsPage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<Appt | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const ws = useMemo(() => addDays(weekStart(new Date()), weekOffset * 7), [weekOffset]);
  const we = useMemo(() => addDays(ws, 6), [ws]);

  const load = useCallback(async () => {
    if (!profile?.clinic_id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select(`id,scheduled_at,end_time,duration,status,type,reason,chief_complaint,notes,
        patient:global_patients!appointments_patient_id_fkey(id,first_name,last_name,display_id),
        doctor:profiles!appointments_doctor_id_fkey(id,first_name,last_name,specialization)`)
      .eq("clinic_id", profile.clinic_id)
      .gte("scheduled_at", ws.toISOString())
      .lte("scheduled_at", addDays(we, 1).toISOString())
      .order("scheduled_at");
    setItems((data ?? []) as unknown as Appt[]);
    setLoading(false);
  }, [profile?.clinic_id, ws, we]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const buckets: Record<number, Appt[]> = {};
    for (let i = 0; i < 6; i++) buckets[i] = [];
    for (const a of items) {
      const diff = Math.floor((new Date(a.scheduled_at).getTime() - ws.getTime()) / 86_400_000);
      if (diff >= 0 && diff < 6) buckets[diff].push(a);
    }
    return buckets;
  }, [items, ws]);

  const today = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - ws.getTime()) / 86_400_000);
    return diff >= 0 && diff < 6 ? byDay[diff] ?? [] : [];
  }, [byDay, ws]);

  const transition = async (appt: Appt, next: ApptStatus) => {
    const patch: Record<string, unknown> = { status: next };
    const now = new Date().toISOString();
    if (next === "CHECKED_IN")  patch.checked_in_at = now;
    if (next === "IN_PROGRESS") patch.started_at = now;
    if (next === "COMPLETED")   patch.completed_at = now;
    if (next === "CANCELLED")   patch.cancelled_at = now;

    const { error } = await supabase.from("appointments").update(patch as never).eq("id", appt.id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.map((a) => a.id === appt.id ? { ...a, status: next } : a));
    if (selected?.id === appt.id) setSelected({ ...appt, status: next });
    toast.success(`Marked as ${next.replace(/_/g, " ").toLowerCase()}`);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Appointments"
        description="Schedule and manage patient appointments."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New appointment
          </Button>
        }
      />

      {/* Week navigation */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {fmtDate(ws)} – {fmtDate(we)}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setWeekOffset(0)}>
            Today
          </Button>
        )}
      </div>

      {!profile?.clinic_id && !loading ? (
        <EmptyState icon={Calendar} title="No clinic associated" description="This account is not linked to a clinic or hospital. Contact your administrator." />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Calendar} title="No appointments this week" description="Create an appointment or check a different week." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Week grid */}
          <div className="overflow-x-auto rounded-xl border bg-card p-4 shadow-card">
            <div className="grid min-w-[640px] grid-cols-6 gap-2">
              {DAYS.map((label, idx) => {
                const dayDate = addDays(ws, idx);
                const isToday = dayDate.toDateString() === new Date().toDateString();
                return (
                  <div key={label} className="min-h-[380px] rounded-xl bg-muted/30 p-2.5">
                    <div className={cn(
                      "mb-2.5 flex items-baseline gap-1.5 text-xs font-semibold",
                      isToday && "text-primary",
                    )}>
                      <span>{label}</span>
                      <span className={cn(
                        "rounded px-1 text-[10px]",
                        isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}>
                        {fmtDate(dayDate)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {byDay[idx]?.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setSelected(a)}
                          className={cn(
                            "w-full rounded-lg border bg-card p-2 text-left shadow-sm transition-colors hover:border-primary/40",
                            selected?.id === a.id && "border-primary ring-1 ring-primary",
                          )}
                        >
                          <div className="truncate text-[11px] font-semibold">
                            {a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : "Unknown patient"}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {fmtTime(a.scheduled_at)} · {TYPE_LABELS[a.type]}
                          </div>
                          <div className="mt-1">
                            <StatusBadge status={a.status} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel */}
          <aside className="space-y-4">
            {selected ? (
              <ApptDetail appt={selected} onTransition={(next) => transition(selected, next)} onClose={() => setSelected(null)} />
            ) : (
              <TodayQueue appts={today} onSelect={setSelected} />
            )}
          </aside>
        </div>
      )}

      {createOpen && (
        <CreateApptDialog
          clinicId={profile?.clinic_id ?? ""}
          userId={user?.id ?? ""}
          onCreated={(a) => { setItems((prev) => [...prev, a].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))); }}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}

// ── Appointment detail panel ──────────────────────────────────────────────────

function ApptDetail({
  appt, onTransition, onClose,
}: {
  appt: Appt;
  onTransition: (next: ApptStatus) => void;
  onClose: () => void;
}) {
  const actions = STATUS_ACTIONS[appt.status] ?? [];
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {appt.patient ? `${appt.patient.first_name} ${appt.patient.last_name}` : "Unknown patient"}
          </div>
          <div className="text-xs text-muted-foreground">{appt.patient?.display_id ?? "—"}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="space-y-1 text-sm">
        <Row label="Time" value={fmtTime(appt.scheduled_at)} />
        <Row label="Duration" value={`${appt.duration} min`} />
        <Row label="Type" value={TYPE_LABELS[appt.type]} />
        <Row label="Doctor" value={appt.doctor ? `Dr. ${appt.doctor.first_name} ${appt.doctor.last_name}` : "—"} />
        {appt.reason && <Row label="Reason" value={appt.reason} />}
        {appt.chief_complaint && <Row label="Chief complaint" value={appt.chief_complaint} />}
      </div>

      <div className="pt-1">
        <div className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</div>
        <StatusBadge status={appt.status} />
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {actions.map((a) => (
            <Button key={a.next} size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => onTransition(a.next)}>
              <a.icon className="h-3.5 w-3.5" /> {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Today's queue ────────────────────────────────────────────────────────────

function TodayQueue({ appts, onSelect }: { appts: Appt[]; onSelect: (a: Appt) => void }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="mb-3 text-sm font-semibold">Today's queue</h2>
      {appts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No appointments today.</p>
      ) : (
        <ul className="space-y-2">
          {appts.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onSelect(a)}
                className="w-full rounded-xl border bg-card p-3 text-left hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : "Unknown patient"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {fmtTime(a.scheduled_at)} · {a.reason ?? TYPE_LABELS[a.type]}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Create appointment dialog ─────────────────────────────────────────────────

function CreateApptDialog({
  clinicId, userId, onCreated, onClose,
}: {
  clinicId: string;
  userId: string;
  onCreated: (a: Appt) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientHit[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientHit | null>(null);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [type, setType] = useState<ApptType>("IN_PERSON");
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,specialization")
        .eq("account_type", "doctor")
        .order("first_name");
      setDoctors((data ?? []) as DoctorRow[]);
    })();
  }, []);

  const searchPatients = useCallback((q: string) => {
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setPatients([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("global_patients")
        .select("id,first_name,last_name,display_id")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,display_id.ilike.%${q}%`)
        .limit(8);
      setPatients((data ?? []) as PatientHit[]);
    }, 300);
  }, []);

  const submit = async () => {
    if (!selectedPatient) { toast.error("Select a patient"); return; }
    if (!doctorId)         { toast.error("Select a doctor");  return; }
    if (!clinicId)         { toast.error("No clinic associated with this account"); return; }

    setSaving(true);
    const start = new Date(date);
    const end = new Date(start.getTime() + Number(duration) * 60_000);

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        created_by_id: userId,
        patient_id: selectedPatient.id,
        doctor_id: doctorId,
        scheduled_at: start.toISOString(),
        end_time: end.toISOString(),
        duration: Number(duration),
        type: type as any,
        reason: reason.trim() || null,
        status: "SCHEDULED",
      })
      .select(`id,scheduled_at,end_time,duration,status,type,reason,chief_complaint,notes,
        patient:global_patients!appointments_patient_id_fkey(id,first_name,last_name,display_id),
        doctor:profiles!appointments_doctor_id_fkey(id,first_name,last_name,specialization)`)
      .single();

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Appointment created");
    onCreated(data as unknown as Appt);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
          <DialogDescription>Schedule a patient appointment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient search */}
          <div className="space-y-2">
            <Label>Patient *</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{selectedPatient.first_name} {selectedPatient.last_name} <span className="text-muted-foreground">({selectedPatient.display_id})</span></span>
                <button onClick={() => { setSelectedPatient(null); setQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by name or ID…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); searchPatients(e.target.value); }}
                />
                {patients.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPatient(p); setPatients([]); setQuery(""); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        {p.first_name} {p.last_name} <span className="text-muted-foreground">· {p.display_id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Doctor */}
          <div className="space-y-2">
            <Label>Doctor *</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name}{d.specialization ? ` · ${d.specialization}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Date & time */}
            <div className="space-y-2">
              <Label>Date & time *</Label>
              <Input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["15", "20", "30", "45", "60", "90"].map((m) => (
                    <SelectItem key={m} value={m}>{m} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ApptType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TYPE_LABELS) as [ApptType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason / chief complaint (optional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Follow-up post surgery, blood pressure check…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !selectedPatient || !doctorId}>
            {saving ? "Creating…" : "Create appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
