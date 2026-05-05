import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Calendar, Clock, Save, PlusCircle, Trash2, Info, CalendarOff,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/availability")({
  head: () => ({ meta: [{ title: "Availability — Doctor Bridge" }] }),
  component: () => (
    <ErrorBoundary>
      <AvailabilityPage />
    </ErrorBoundary>
  ),
});

interface AvailabilityRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_min: number;
  max_slots: number;
  is_active: boolean;
  notes: string | null;
}

interface LeaveRow {
  id: string;
  leave_date: string;
  reason: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Default schedule when a day is first enabled
const DEFAULT_SLOT: Omit<AvailabilityRow, "id" | "day_of_week"> = {
  start_time: "09:00",
  end_time: "17:00",
  slot_duration_min: 30,
  max_slots: 10,
  is_active: true,
  notes: null,
};

function AvailabilityPage() {
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilityRow[]>([]);
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null); // day_of_week being saved

  // Leave dialog
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [savingLeave, setSavingLeave] = useState(false);

  // Referral settings (from doctor_profiles)
  const [acceptingReferrals, setAcceptingReferrals] = useState(true);
  const [referralCap, setReferralCap] = useState<number>(20);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: doc } = await supabase
        .from("doctor_profiles")
        .select("id,accepting_referrals,weekly_referral_cap")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!doc) { setLoading(false); return; }

      setDoctorId(doc.id);
      setAcceptingReferrals(doc.accepting_referrals ?? true);
      setReferralCap(doc.weekly_referral_cap ?? 20);

      const [{ data: avail }, { data: lv }] = await Promise.all([
        supabase.from("doctor_availability").select("*").eq("doctor_id", doc.id).order("day_of_week"),
        supabase.from("doctor_leave").select("*").eq("doctor_id", doc.id).order("leave_date"),
      ]);

      setSlots((avail ?? []) as AvailabilityRow[]);
      setLeave((lv ?? []) as LeaveRow[]);
      setLoading(false);
    })();
  }, [user]);

  // ── Toggle a day on/off ─────────────────────────────────────────────────────
  const toggleDay = async (dow: number) => {
    if (!doctorId) return;
    const existing = slots.find((s) => s.day_of_week === dow);
    if (existing) {
      // Toggle is_active
      const next = { ...existing, is_active: !existing.is_active };
      setSaving(dow);
      const { error } = await supabase
        .from("doctor_availability")
        .update({ is_active: next.is_active })
        .eq("id", existing.id);
      setSaving(null);
      if (error) { toast.error(error.message); return; }
      setSlots((prev) => prev.map((s) => s.id === existing.id ? next : s));
    } else {
      // Create a new row for this day
      setSaving(dow);
      const { data, error } = await supabase
        .from("doctor_availability")
        .insert({ doctor_id: doctorId, day_of_week: dow, ...DEFAULT_SLOT })
        .select()
        .single();
      setSaving(null);
      if (error) { toast.error(error.message); return; }
      setSlots((prev) => [...prev, data as AvailabilityRow].sort((a, b) => a.day_of_week - b.day_of_week));
    }
  };

  // ── Update a day's times ────────────────────────────────────────────────────
  const updateSlot = async (row: AvailabilityRow) => {
    setSaving(row.day_of_week);
    const { error } = await supabase
      .from("doctor_availability")
      .update({
        start_time: row.start_time,
        end_time: row.end_time,
        slot_duration_min: row.slot_duration_min,
        max_slots: row.max_slots,
        notes: row.notes,
      })
      .eq("id", row.id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${DAYS[row.day_of_week]} schedule saved`);
  };

  const patchLocal = (dow: number, patch: Partial<AvailabilityRow>) => {
    setSlots((prev) => prev.map((s) => s.day_of_week === dow ? { ...s, ...patch } : s));
  };

  // ── Save referral settings ──────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!doctorId) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("doctor_profiles")
      .update({ accepting_referrals: acceptingReferrals, weekly_referral_cap: referralCap })
      .eq("id", doctorId);
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Referral settings saved");
  };

  // ── Add leave ───────────────────────────────────────────────────────────────
  const addLeave = async () => {
    if (!doctorId || !leaveDate) return;
    setSavingLeave(true);

    const start = new Date(leaveDate);
    const end = leaveEndDate ? new Date(leaveEndDate) : new Date(leaveDate);
    
    if (end < start) {
      toast.error("End date cannot be before start date");
      setSavingLeave(false);
      return;
    }

    const payload: { doctor_id: string; leave_date: string; reason: string | null }[] = [];
    const current = new Date(start);
    while (current <= end) {
      payload.push({
        doctor_id: doctorId,
        leave_date: current.toISOString().slice(0, 10),
        reason: leaveReason.trim() || null
      });
      current.setDate(current.getDate() + 1);
    }

    const { data, error } = await supabase
      .from("doctor_leave")
      .upsert(payload)
      .select();

    setSavingLeave(false);
    if (error) { toast.error(error.message); return; }
    
    setLeave((prev) => {
      const datesAdded = payload.map(p => p.leave_date);
      const next = prev.filter((l) => !datesAdded.includes(l.leave_date));
      return [...next, ...(data as LeaveRow[])].sort((a, b) => a.leave_date.localeCompare(b.leave_date));
    });
    
    toast.success("Leave dates added");
    setLeaveOpen(false);
    setLeaveDate("");
    setLeaveEndDate("");
    setLeaveReason("");
  };

  const removeLeave = async (id: string) => {
    await supabase.from("doctor_leave").delete().eq("id", id);
    setLeave((prev) => prev.filter((l) => l.id !== id));
    toast.success("Leave date removed");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageHeader title="Availability" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </DashboardLayout>
    );
  }

  if (!doctorId) {
    return (
      <DashboardLayout>
        <PageHeader title="Availability" />
        <EmptyState
          icon={Calendar}
          title="Doctor profile required"
          description="Set up your doctor profile to manage your weekly schedule and availability."
        />
      </DashboardLayout>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcomingLeave = leave.filter((l) => l.leave_date >= today);
  const pastLeave = leave.filter((l) => l.leave_date < today);

  return (
    <DashboardLayout>
      <PageHeader
        title="Availability"
        description="Set your weekly schedule so referred patients and colleagues know when you're available."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* ── Weekly schedule ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Weekly schedule</h2>

          {DAYS.map((dayName, dow) => {
            const slot = slots.find((s) => s.day_of_week === dow);
            const isSaving = saving === dow;
            const isEnabled = slot?.is_active ?? false;

            return (
              <div
                key={dow}
                className={`rounded-xl border bg-card shadow-card transition-opacity ${!isEnabled && slot ? "opacity-60" : ""}`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                      {DAYS_SHORT[dow]}
                    </span>
                    <span className="font-semibold text-sm">{dayName}</span>
                    {slot && !isEnabled && (
                      <span className="text-xs text-muted-foreground">— Off</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isSaving && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    )}
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleDay(dow)}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Detail rows — only when enabled */}
                {slot && isEnabled && (
                  <div className="px-5 py-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Start time</Label>
                        <Input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => patchLocal(dow, { start_time: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">End time</Label>
                        <Input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => patchLocal(dow, { end_time: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Slot duration (min)</Label>
                        <Input
                          type="number"
                          min={10}
                          max={120}
                          step={5}
                          value={slot.slot_duration_min}
                          onChange={(e) => patchLocal(dow, { slot_duration_min: Number(e.target.value) })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Max patients / day</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={slot.max_slots}
                          onChange={(e) => patchLocal(dow, { max_slots: Number(e.target.value) })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Notes (optional)</Label>
                      <Input
                        value={slot.notes ?? ""}
                        onChange={(e) => patchLocal(dow, { notes: e.target.value || null })}
                        placeholder="e.g. Morning only — afternoons reserved for surgery"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {slot.start_time} – {slot.end_time}
                        {" · "}{Math.floor(((new Date(`2000-01-01T${slot.end_time}`) as any) - (new Date(`2000-01-01T${slot.start_time}`) as any)) / 60000 / slot.slot_duration_min)} slots
                        {" · "}{slot.max_slots} patients max
                      </p>
                      <Button size="sm" variant="outline" onClick={() => updateSlot(slot)} disabled={isSaving}>
                        <Save className="mr-1.5 h-3.5 w-3.5" /> Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4">
          <div className="sticky top-4 space-y-4">

            {/* Referral settings */}
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold mb-3">Referral settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Accepting referrals</p>
                    <p className="text-xs text-muted-foreground">Turn off to pause all incoming referrals</p>
                  </div>
                  <Switch
                    checked={acceptingReferrals}
                    onCheckedChange={setAcceptingReferrals}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Weekly referral cap</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={referralCap}
                    onChange={(e) => setReferralCap(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Max referrals you'll accept per week across all GPs</p>
                </div>
                <Button size="sm" className="w-full" disabled={savingSettings} onClick={saveSettings}>
                  <Save className="mr-1.5 h-3.5 w-3.5" />{savingSettings ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </div>

            {/* Leave / blocked dates */}
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Leave & blocked dates</h2>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setLeaveOpen(true)}>
                  <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>

              {upcomingLeave.length === 0 ? (
                <p className="text-xs text-muted-foreground">No upcoming leave dates.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingLeave.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium">{formatDate(l.leave_date)}</div>
                        {l.reason && <div className="text-[10px] text-muted-foreground">{l.reason}</div>}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeLeave(l.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {pastLeave.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[10px] text-muted-foreground select-none">
                    Past dates ({pastLeave.length})
                  </summary>
                  <ul className="mt-2 space-y-1 opacity-60">
                    {pastLeave.map((l) => (
                      <li key={l.id} className="text-xs text-muted-foreground">
                        {formatDate(l.leave_date)}{l.reason ? ` — ${l.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* Info tip */}
            <div className="rounded-xl border border-primary/20 bg-primary-soft p-4">
              <div className="flex items-start gap-2 text-xs text-accent-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="leading-relaxed">
                  This schedule is shared with the future patient appointment app. Referred patients will only be able to book during your active hours.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Add leave dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-muted-foreground" /> Block dates
            </DialogTitle>
            <DialogDescription>
              Mark a single date or a range as unavailable (holiday, conference, personal leave).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} min={today} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date (optional)</Label>
                <Input type="date" value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} min={leaveDate || today} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason (optional)</Label>
              <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="e.g. Conference, Public holiday" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
            <Button disabled={savingLeave || !leaveDate} onClick={addLeave}>
              {savingLeave ? "Adding…" : "Block dates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
