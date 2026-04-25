import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Inbox, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/affiliations")({
  head: () => ({ meta: [{ title: "Affiliation requests — Doctor Bridge" }] }),
  component: AffiliationsPage,
});

interface Req {
  id: string;
  doctor_user_id: string;
  doctor_profile_id: string;
  initiated_by: "DOCTOR" | "HOSPITAL";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  message: string | null;
  decline_reason: string | null;
  created_at: string;
  decided_at: string | null;
  doctor_name?: string;
  doctor_email?: string;
  doctor_nmc?: string;
}

function AffiliationsPage() {
  const { profile } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const reload = useCallback(async () => {
    if (!profile?.clinic_id) { setLoading(false); return; }
    const { data } = await supabase
      .from("affiliation_requests")
      .select("id,doctor_user_id,doctor_profile_id,initiated_by,status,message,decline_reason,created_at,decided_at")
      .eq("hospital_clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Req[];
    const userIds = Array.from(new Set(rows.map((r) => r.doctor_user_id)));
    const profileIds = Array.from(new Set(rows.map((r) => r.doctor_profile_id)));
    const [{ data: profs }, { data: dps }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,first_name,last_name,email").in("id", userIds) : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; email: string }[] }),
      profileIds.length ? supabase.from("doctor_profiles").select("id,nmc_number").in("id", profileIds) : Promise.resolve({ data: [] as { id: string; nmc_number: string }[] }),
    ]);
    const profById = new Map((profs ?? []).map((p) => [p.id, p]));
    const dpById = new Map((dps ?? []).map((d) => [d.id, d]));
    setReqs(rows.map((r) => {
      const p = profById.get(r.doctor_user_id);
      const dp = dpById.get(r.doctor_profile_id);
      return {
        ...r,
        doctor_name: p ? `${p.first_name} ${p.last_name}` : "—",
        doctor_email: p?.email,
        doctor_nmc: dp?.nmc_number,
      };
    }));
    setLoading(false);
  }, [profile?.clinic_id]);

  useEffect(() => { reload(); }, [reload]);

  const accept = async (id: string) => {
    const { error } = await supabase.rpc("accept_affiliation_request", { _request_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Doctor added to hospital"); reload(); }
  };
  const reject = (id: string) => {
    setDeclineId(id);
    setDeclineReason("");
    setDeclineDialogOpen(true);
  };

  const confirmDecline = async () => {
    if (!declineId) return;
    setDeclineDialogOpen(false);
    const { error } = await supabase.rpc("reject_affiliation_request", { _request_id: declineId, _reason: declineReason.trim() || undefined });
    if (error) toast.error(error.message);
    else { toast.success("Request declined"); reload(); }
    setDeclineId(null);
    setDeclineReason("");
  };

  const pending = reqs.filter((r) => r.status === "PENDING");
  const past = reqs.filter((r) => r.status !== "PENDING");

  if (loading) return (
    <DashboardLayout>
      <div className="mb-6 h-9 w-64 rounded-lg bg-muted animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Affiliation requests"
        description="Doctors requesting to join, and invitations you've sent."
        actions={profile?.clinic_id ? (
          <InviteDoctorDialog clinicId={profile.clinic_id} onSent={reload} />
        ) : undefined}
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState icon={Inbox} title="No pending requests" description="Invite a doctor or wait for them to apply." />
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-card">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.doctor_name}</span>
                    <Badge variant={r.initiated_by === "DOCTOR" ? "default" : "secondary"}>
                      {r.initiated_by === "DOCTOR" ? "Doctor requested" : "Invite sent"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r.doctor_email} · NMC: {r.doctor_nmc} · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  {r.message && <div className="mt-1 text-sm">{r.message}</div>}
                </div>
                {r.initiated_by === "DOCTOR" && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => reject(r.id)}>Decline</Button>
                    <Button size="sm" onClick={() => accept(r.id)}>Accept</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">History</h2>
          <div className="space-y-2">
            {past.slice(0, 20).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm">
                <div>
                  <span className="font-medium">{r.doctor_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(r.decided_at ?? r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <Badge variant={
                  r.status === "ACCEPTED" ? "default" :
                  r.status === "REJECTED" ? "destructive" : "secondary"
                }>{r.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline affiliation request</DialogTitle>
            <DialogDescription>Optionally provide a reason for the doctor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason (optional)</Label>
            <Textarea
              rows={3}
              placeholder="e.g. Position not available at this time"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDecline}>Decline request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─── Invite Doctor Dialog ─────────────────────────────────────────────────────

interface DoctorResult {
  id: string;           // doctor_profile id
  user_id: string;
  nmc_number: string;
  name: string;
  specialization: string | null;
}

function InviteDoctorDialog({
  clinicId,
  onSent,
}: {
  clinicId: string;
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nmcQuery, setNmcQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [results, setResults] = useState<DoctorResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState<string | null>(null); // doctorProfileId being sent
  const [clinicName, setClinicName] = useState<string>("");

  // Fetch clinic name when dialog opens
  useEffect(() => {
    if (!open || clinicName) return;
    supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle().then(({ data }) => {
      setClinicName(data?.name ?? "");
    });
  }, [open, clinicId, clinicName]);

  const search = async () => {
    if (!nmcQuery.trim() && !nameQuery.trim()) return;
    setSearching(true);
    setResults([]);

    // Build query — search by NMC or name (via profiles join)
    let q = supabase.from("doctor_profiles").select("id,user_id,nmc_number");
    if (nmcQuery.trim()) {
      q = q.ilike("nmc_number", `%${nmcQuery.trim()}%`);
    }
    const { data: docRows } = await q.limit(20);
    if (!docRows || docRows.length === 0) { setSearching(false); return; }

    const userIds = docRows.map((d) => d.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,specialization")
      .in("id", userIds);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    let enriched: DoctorResult[] = docRows.map((d) => {
      const p = profMap.get(d.user_id);
      return {
        id: d.id,
        user_id: d.user_id,
        nmc_number: d.nmc_number,
        name: p ? `${p.first_name} ${p.last_name}` : "—",
        specialization: p?.specialization ?? null,
      };
    });

    // Filter by name if provided
    if (nameQuery.trim()) {
      const q2 = nameQuery.toLowerCase();
      enriched = enriched.filter((d) => d.name.toLowerCase().includes(q2));
    }

    setResults(enriched);
    setSearching(false);
  };

  const sendInvite = async (doctor: DoctorResult) => {
    setSending(doctor.id);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { setSending(null); toast.error("Not authenticated"); return; }
    const { error } = await supabase.from("affiliation_requests").insert({
      doctor_user_id: doctor.user_id,
      doctor_profile_id: doctor.id,
      hospital_clinic_id: clinicId,
      hospital_name: clinicName || "Hospital",
      initiated_by: "HOSPITAL",
      initiated_by_user_id: currentUser.id,
      message: message || null,
    });
    setSending(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Invitation sent to Dr. ${doctor.name}`);
    setOpen(false);
    setResults([]);
    setNmcQuery("");
    setNameQuery("");
    setMessage("");
    onSent();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite doctor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a doctor to join</DialogTitle>
          <DialogDescription>
            Search by NMC number or name. The doctor will receive an invitation and must accept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">NMC license number</Label>
              <Input
                placeholder="e.g. MH/12345/2018"
                value={nmcQuery}
                onChange={(e) => setNmcQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Doctor name</Label>
              <Input
                placeholder="e.g. Sharma"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={search}
            disabled={(!nmcQuery.trim() && !nameQuery.trim()) || searching}
          >
            {searching ? "Searching…" : "Search verified doctors"}
          </Button>

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                  <div>
                    <div className="font-medium">Dr. {d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.specialization ?? "—"} · NMC: {d.nmc_number}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={sending === d.id}
                    onClick={() => sendInvite(d)}
                  >
                    {sending === d.id ? "Sending…" : "Invite"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && (nmcQuery || nameQuery) && !searching && (
            <p className="text-center text-sm text-muted-foreground">No doctors found matching your search.</p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Message to doctor (optional)</Label>
            <Textarea
              rows={2}
              placeholder="A brief note about the role or opportunity…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
