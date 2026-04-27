import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/appointments")({
  head: () => ({ meta: [{ title: "Appointments — Doctor Bridge" }] }),
  component: AppointmentsPage,
});

interface Appt {
  id: string; scheduled_at: string; duration: number; status: string; type: string; reason: string | null;
  patient: { first_name: string; last_name: string; display_id: string } | null;
  doctor: { first_name: string; last_name: string; specialization: string | null } | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function AppointmentsPage() {
  const [items, setItems] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("appointments")
        .select(`id,scheduled_at,duration,status,type,reason,
          patient:global_patients!inner(first_name,last_name,display_id),
          doctor:profiles!appointments_doctor_id_fkey(first_name,last_name,specialization)`)
        .order("scheduled_at");
      setItems((data ?? []) as unknown as Appt[]);
      setLoading(false);
    })();
  }, []);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const byDay = useMemo(() => {
    const buckets: Record<number, Appt[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (const a of items) {
      const d = new Date(a.scheduled_at);
      const diff = Math.floor((d.getTime() - weekStart.getTime()) / 86_400_000);
      if (diff >= 0 && diff < 5) buckets[diff].push(a);
    }
    return buckets;
  }, [items, weekStart]);

  const todays = items.slice(0, 12);

  return (
    <DashboardLayout>
      <PageHeader
        title="Appointments"
        description="View and manage scheduled appointments."
        actions={
          <Button onClick={() => setApptDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />New appointment
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Calendar} title="No appointments" description="New appointments will appear here." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Week grid */}
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <div className="grid grid-cols-5 gap-3">
              {DAYS.map((label, idx) => (
                <div key={label} className="min-h-[420px] rounded-xl bg-muted/30 p-3">
                  <div className="mb-3 text-sm font-semibold tracking-tight">{label}</div>
                  <div className="space-y-2">
                    {byDay[idx]?.length ? byDay[idx].map((a) => (
                      <div key={a.id} className="rounded-lg border bg-card p-2.5 shadow-sm">
                        <div className="truncate text-xs font-semibold">
                          {a.patient?.first_name} {a.patient?.last_name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(a.scheduled_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-dashed bg-card/40 p-3 text-center text-[11px] text-muted-foreground">
                        Free
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's queue */}
          <aside className="rounded-xl border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-sm font-semibold">Today's queue</h2>
            <ul className="space-y-3">
              {todays.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {a.patient?.first_name} {a.patient?.last_name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.reason ?? a.type.replace(/_/g, " ")}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}


      <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New appointment</DialogTitle>
            <DialogDescription>Appointment scheduling is coming soon. For now, appointments are created via referral acceptances.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApptDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
