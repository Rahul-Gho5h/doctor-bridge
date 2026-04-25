/**
 * /cme — CME / CPD Activity Tracker
 *
 * Doctors log continuing medical education credits.
 * NMC India requires 30 CME credits per 5-year renewal cycle (≥ 6/yr target).
 * This page shows progress toward that goal and a log of all activities.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  GraduationCap, Plus, Trash2, Award, BookOpen, Mic2,
  Monitor, Users, FileText, Globe,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/cme")({
  head: () => ({ meta: [{ title: "CME / CPD — Doctor Bridge" }] }),
  component: () => (
    <ErrorBoundary>
      <CmePage />
    </ErrorBoundary>
  ),
});

type ActivityType =
  | "CONFERENCE" | "WORKSHOP" | "WEBINAR" | "JOURNAL_CLUB"
  | "CASE_PRESENTATION" | "ONLINE_COURSE" | "PUBLICATION" | "OTHER";

interface CmeActivity {
  id: string;
  activity_type: ActivityType;
  title: string;
  organizer: string | null;
  location: string | null;
  activity_date: string;
  credits: number;
  notes: string | null;
  verified: boolean;
  created_at: string;
}

const TYPE_META: Record<ActivityType, { label: string; icon: typeof GraduationCap; color: string }> = {
  CONFERENCE:        { label: "Conference",          icon: Mic2,       color: "bg-primary-soft text-accent-foreground border-primary/20" },
  WORKSHOP:          { label: "Workshop",            icon: Users,      color: "bg-info/10 text-info-foreground border-info/30" },
  WEBINAR:           { label: "Webinar",             icon: Monitor,    color: "bg-warning/10 text-warning-foreground border-warning/30" },
  JOURNAL_CLUB:      { label: "Journal club",        icon: BookOpen,   color: "bg-accent text-accent-foreground border-border" },
  CASE_PRESENTATION: { label: "Case presentation",   icon: FileText,   color: "bg-muted text-muted-foreground border-border" },
  ONLINE_COURSE:     { label: "Online course",       icon: Globe,      color: "bg-success/10 text-success-foreground border-success/30" },
  PUBLICATION:       { label: "Publication",         icon: BookOpen,   color: "bg-destructive/10 text-destructive border-destructive/30" },
  OTHER:             { label: "Other",               icon: GraduationCap, color: "bg-muted text-muted-foreground border-border" },
};

// NMC 5-year cycle: 30 credits (≈ 6/yr)
const CYCLE_YEARS = 5;
const TOTAL_TARGET = 30;
const ANNUAL_TARGET = 6;

function CmePage() {
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [activities, setActivities] = useState<CmeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add form
  const [aType, setAType] = useState<ActivityType>("CONFERENCE");
  const [aTitle, setATitle] = useState("");
  const [aOrganizer, setAOrganizer] = useState("");
  const [aLocation, setALocation] = useState("");
  const [aDate, setADate] = useState(() => new Date().toISOString().slice(0, 10));
  const [aCredits, setACredits] = useState("1");
  const [aNotes, setANotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (docId: string) => {
    const { data } = await supabase
      .from("cme_activities")
      .select("id,activity_type,title,organizer,location,activity_date,credits,notes,verified,created_at")
      .eq("doctor_id", docId)
      .order("activity_date", { ascending: false });
    setActivities((data ?? []) as CmeActivity[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: doc } = await supabase
        .from("doctor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!doc) { setLoading(false); return; }
      setDoctorId(doc.id);
      await load(doc.id);
    })();
  }, [user]);

  const addActivity = async () => {
    if (!doctorId) return;
    const credits = parseFloat(aCredits);
    if (!aTitle.trim() || isNaN(credits) || credits <= 0) {
      toast.error("Title and valid credits are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("cme_activities").insert({
      doctor_id: doctorId,
      activity_type: aType,
      title: aTitle.trim(),
      organizer: aOrganizer.trim() || null,
      location: aLocation.trim() || null,
      activity_date: aDate,
      credits,
      notes: aNotes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Activity logged");
    setAddOpen(false);
    setATitle(""); setAOrganizer(""); setALocation(""); setACredits("1"); setANotes("");
    await load(doctorId);
  };

  const deleteActivity = async (id: string) => {
    setDeleting(id);
    await supabase.from("cme_activities").delete().eq("id", id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
    setDeleting(null);
    toast.success("Activity removed");
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const thisYearCredits = activities
    .filter((a) => new Date(a.activity_date).getFullYear() === currentYear)
    .reduce((s, a) => s + Number(a.credits), 0);

  const totalCredits = activities.reduce((s, a) => s + Number(a.credits), 0);
  // Assume 5-year cycle starting from oldest activity year
  const oldestYear = activities.length > 0
    ? Math.min(...activities.map((a) => new Date(a.activity_date).getFullYear()))
    : currentYear - 4;
  const cycleStart = Math.max(currentYear - CYCLE_YEARS + 1, oldestYear);
  const cycleCredits = activities
    .filter((a) => new Date(a.activity_date).getFullYear() >= cycleStart)
    .reduce((s, a) => s + Number(a.credits), 0);
  const cycleProgress = Math.min(100, (cycleCredits / TOTAL_TARGET) * 100);
  const annualProgress = Math.min(100, (thisYearCredits / ANNUAL_TARGET) * 100);

  const byType: Record<string, number> = {};
  for (const a of activities) {
    byType[a.activity_type] = (byType[a.activity_type] ?? 0) + Number(a.credits);
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageHeader title="CME / CPD" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (!doctorId) {
    return (
      <DashboardLayout>
        <PageHeader title="CME / CPD" />
        <EmptyState
          icon={GraduationCap}
          title="Doctor profile required"
          description="This page is only available to doctors with a completed and verified profile."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="CME / CPD"
        description="Log and track your Continuing Medical Education credits. NMC India requires 30 credits per 5-year renewal cycle."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Log activity
          </Button>
        }
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> Log CME activity
            </DialogTitle>
            <DialogDescription>
              Record a conference, workshop, webinar, or any other CME activity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Type *</Label>
                <Select value={aType} onValueChange={(v) => setAType(v as ActivityType)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_META) as ActivityType[]).map((k) => (
                      <SelectItem key={k} value={k}>{TYPE_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Credits *</Label>
                <Input
                  type="number" min="0.5" max="50" step="0.5"
                  value={aCredits}
                  onChange={(e) => setACredits(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title / event name *</Label>
              <Input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="e.g. Annual Cardiology Congress 2025" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Organizer</Label>
                <Input value={aOrganizer} onChange={(e) => setAOrganizer(e.target.value)} placeholder="e.g. IMA, AIIMS" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input value={aLocation} onChange={(e) => setALocation(e.target.value)} placeholder="e.g. Mumbai / Online" className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date" value={aDate}
                onChange={(e) => setADate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea rows={2} value={aNotes} onChange={(e) => setANotes(e.target.value)} placeholder="Key learnings, certificate number, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={saving || !aTitle.trim()} onClick={addActivity}>
              <GraduationCap className="mr-1.5 h-4 w-4" />{saving ? "Saving…" : "Log activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <KpiCard
          label={`This year (${currentYear})`}
          value={`${thisYearCredits.toFixed(1)} / ${ANNUAL_TARGET} credits`}
          progress={annualProgress}
          progressColor={annualProgress >= 100 ? "bg-success" : annualProgress >= 60 ? "bg-primary" : "bg-warning"}
          sub={annualProgress >= 100 ? "✓ Annual target met" : `${(ANNUAL_TARGET - thisYearCredits).toFixed(1)} more to hit annual goal`}
        />
        <KpiCard
          label={`5-year cycle (${cycleStart}–${cycleStart + CYCLE_YEARS - 1})`}
          value={`${cycleCredits.toFixed(1)} / ${TOTAL_TARGET} credits`}
          progress={cycleProgress}
          progressColor={cycleProgress >= 100 ? "bg-success" : cycleProgress >= 60 ? "bg-primary" : "bg-warning"}
          sub={cycleProgress >= 100 ? "✓ NMC renewal target met" : `${(TOTAL_TARGET - cycleCredits).toFixed(1)} credits remaining for NMC renewal`}
        />
        <KpiCard
          label="All time"
          value={`${totalCredits.toFixed(1)} credits`}
          progress={null}
          progressColor=""
          sub={`${activities.length} activities logged`}
        />
      </div>

      {/* Activity log */}
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activity log</h2>
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-semibold">No activities logged yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Start logging your CME credits to track your NMC renewal progress.</p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Log first activity
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Activity</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-right">Credits</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {activities.map((a) => {
                const meta = TYPE_META[a.activity_type];
                const Icon = meta.icon;
                return (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(a.activity_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{a.title}</div>
                      {(a.organizer || a.location) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[a.organizer, a.location].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {a.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5 italic">{a.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
                        <Icon className="h-3 w-3" />{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {Number(a.credits).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {a.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
                          <Award className="h-3 w-3" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleting === a.id}
                        onClick={() => deleteActivity(a.id)}
                        title="Remove activity"
                        className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

function KpiCard({
  label, value, progress, progressColor, sub,
}: {
  label: string;
  value: string;
  progress: number | null;
  progressColor: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value.split(" / ")[0]}</div>
      {value.includes(" / ") && (
        <div className="text-xs text-muted-foreground">of {value.split(" / ")[1]}</div>
      )}
      {progress !== null && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{Math.round(progress)}% complete</div>
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
