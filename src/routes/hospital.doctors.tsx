import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, Activity, UserPlus, CheckCircle2, ChevronRight, X, AlertCircle, Building2,
  Calendar, FileText, GraduationCap, Clock, MoreHorizontal, UserMinus
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/hospital/doctors")({
  head: () => ({ meta: [{ title: "My Doctors — Doctor Bridge" }] }),
  component: HospitalDoctorsPage,
});

interface Doctor {
  id: string; // doctor_profiles.id
  user_id: string;
  nmc_number: string;
  is_public: boolean;
  name: string;
  email: string;
  specialization: string | null;
  patient_count: number;
  referral_count: number;
  joined_at: string;
  affiliation_request_id: string;
}

function HospitalDoctorsPage() {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [docToRemove, setDocToRemove] = useState<Doctor | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const loadDoctors = async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);
    
    // Get accepted affiliation requests
    const { data: affiliations } = await supabase
      .from("affiliation_requests")
      .select("id, doctor_user_id, doctor_profile_id, updated_at")
      .eq("hospital_clinic_id", profile.clinic_id)
      .eq("status", "ACCEPTED");

    if (!affiliations || affiliations.length === 0) {
      setDoctors([]);
      setLoading(false);
      return;
    }

    const doctorProfileIds = affiliations.map(a => a.doctor_profile_id);
    const userIds = affiliations.map(a => a.doctor_user_id);

    const idList = doctorProfileIds.join(",");

    const [
      { data: docProfiles },
      { data: userProfiles },
      { data: referralRows },
      { data: patientRows },
    ] = await Promise.all([
      supabase.from("doctor_profiles").select("id, nmc_number, is_public").in("id", doctorProfileIds),
      supabase.from("profiles").select("id, first_name, last_name, email, specialization").in("id", userIds),
      supabase.from("referrals").select("referring_doctor_id, specialist_id")
        .or(`referring_doctor_id.in.(${idList}),specialist_id.in.(${idList})`),
      supabase.from("patient_access_grants").select("doctor_user_id, global_patient_id")
        .in("doctor_user_id", userIds),
    ]);

    // Count referrals per doctor_profile_id (as referrer or specialist)
    const referralCountMap = new Map<string, number>();
    for (const row of referralRows ?? []) {
      if (doctorProfileIds.includes(row.referring_doctor_id))
        referralCountMap.set(row.referring_doctor_id, (referralCountMap.get(row.referring_doctor_id) ?? 0) + 1);
      if (doctorProfileIds.includes(row.specialist_id))
        referralCountMap.set(row.specialist_id, (referralCountMap.get(row.specialist_id) ?? 0) + 1);
    }

    // Count unique patients per doctor_user_id
    const patientSetMap = new Map<string, Set<string>>();
    for (const row of patientRows ?? []) {
      if (!patientSetMap.has(row.doctor_user_id)) patientSetMap.set(row.doctor_user_id, new Set());
      patientSetMap.get(row.doctor_user_id)!.add(row.global_patient_id);
    }

    const dpMap = new Map((docProfiles || []).map(dp => [dp.id, dp]));
    const upMap = new Map((userProfiles || []).map(up => [up.id, up]));

    const mapped: Doctor[] = affiliations.map(aff => {
      const dp = dpMap.get(aff.doctor_profile_id);
      const up = upMap.get(aff.doctor_user_id);
      return {
        id: aff.doctor_profile_id,
        user_id: aff.doctor_user_id,
        affiliation_request_id: aff.id,
        nmc_number: dp?.nmc_number || "",
        is_public: dp?.is_public || false,
        name: up ? `${up.first_name} ${up.last_name}` : "Unknown",
        email: up?.email || "",
        specialization: up?.specialization || "General",
        patient_count: patientSetMap.get(aff.doctor_user_id)?.size ?? 0,
        referral_count: referralCountMap.get(aff.doctor_profile_id) ?? 0,
        joined_at: aff.updated_at ?? ""
      };
    });

    setDoctors(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadDoctors();
  }, [profile?.clinic_id]);

  const confirmRemove = async () => {
    if (!docToRemove) return;
    
    const { error } = await supabase.rpc("detach_doctor_from_hospital", {
      _doctor_user_id: docToRemove.user_id
    });

    if (error) {
      toast.error("Failed to remove doctor: " + error.message);
    } else {
      toast.success(`Removed Dr. ${docToRemove.name}`);
      setRemoveDialogOpen(false);
      setDocToRemove(null);
      setRemoveReason("");
      setSelectedDoctor(null);
      loadDoctors();
    }
  };

  const handleCreateSuccess = () => {
    toast.success("Doctor account created successfully");
    loadDoctors();
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="My Doctors"
        description="Manage the doctors affiliated with your hospital."
        actions={
          <div className="flex gap-2">
            <CreateDoctorDialog onCreated={handleCreateSuccess} />
          </div>
        }
      />

      <div className="rounded-xl border bg-card shadow-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No doctors yet"
            description="Create new doctor accounts or invite existing ones from the Affiliations tab."
          />
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-3">Doctor</div>
              <div className="col-span-2">Specialty</div>
              <div className="col-span-1 text-right">Patients</div>
              <div className="col-span-1 text-right">Referrals</div>
              <div className="col-span-2">NMC</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            {doctors.map(doc => (
              <div key={doc.id} className="grid grid-cols-12 items-center gap-4 px-6 py-4 text-sm transition-colors hover:bg-muted/30">
                <div className="col-span-3 cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                  <div className="font-medium text-foreground">Dr. {doc.name}</div>
                  <div className="text-xs text-muted-foreground">{doc.email}</div>
                </div>
                <div className="col-span-2 cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                  <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {doc.specialization}
                  </span>
                </div>
                <div className="col-span-1 text-right font-semibold cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                  {doc.patient_count}
                </div>
                <div className="col-span-1 text-right font-semibold cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                  {doc.referral_count}
                </div>
                <div className="col-span-2 font-mono text-xs cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                  {doc.nmc_number}
                </div>
                <div className="col-span-2 cursor-pointer" onClick={() => setSelectedDoctor(doc)}>
                  {doc.is_public ? (
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success-foreground">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                      <Clock className="h-3 w-3" /> Setup pending
                    </span>
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedDoctor(doc)}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDocToRemove(doc);
                          setRemoveDialogOpen(true);
                        }}
                      >
                        <UserMinus className="mr-2 h-4 w-4" /> Remove Affiliation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Remove Affiliation
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>Dr. {docToRemove?.name}</strong> from your hospital? 
              They will no longer be able to act on behalf of the hospital.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for removal</Label>
              <Select onValueChange={setRemoveReason} defaultValue="resignation">
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resignation">Resignation</SelectItem>
                  <SelectItem value="termination">Termination</SelectItem>
                  <SelectItem value="contract_ended">Contract Ended</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove}>Confirm Removal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Details Sheet */}
      <Sheet open={!!selectedDoctor} onOpenChange={(open) => !open && setSelectedDoctor(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] sm:max-w-none flex flex-col p-0">
          {selectedDoctor && (
            <>
              <div className="p-6 border-b bg-muted/20">
                <SheetHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <SheetTitle className="text-2xl">Dr. {selectedDoctor.name}</SheetTitle>
                      <SheetDescription className="mt-1 flex items-center gap-3">
                        <span className="font-medium text-foreground">{selectedDoctor.specialization}</span>
                        <span className="text-muted-foreground font-mono text-xs">NMC: {selectedDoctor.nmc_number}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    <TabsTrigger value="cme">CME</TabsTrigger>
                    <TabsTrigger value="availability">Schedule</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="mt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border bg-card p-4">
                        <div className="text-xs text-muted-foreground mb-1">Joined Hospital</div>
                        <div className="font-medium">{new Date(selectedDoctor.joined_at).toLocaleDateString()}</div>
                      </div>
                      <div className="rounded-xl border bg-card p-4">
                        <div className="text-xs text-muted-foreground mb-1">Email</div>
                        <div className="font-medium truncate" title={selectedDoctor.email}>{selectedDoctor.email}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-3">Permissions</h3>
                      <div className="rounded-lg border p-3 flex items-center gap-3 bg-muted/10">
                        <Activity className="h-5 w-5 text-primary" />
                        <div className="text-sm">
                          <div className="font-medium">Active Doctor Account</div>
                          <div className="text-xs text-muted-foreground">Can manage patients, write EMRs, and handle referrals under the hospital name.</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="analytics" className="mt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border bg-card p-4 text-center">
                        <div className="text-3xl font-bold text-primary">{selectedDoctor.patient_count}</div>
                        <div className="mt-1 text-xs text-muted-foreground flex items-center justify-center gap-1">
                          <Users className="h-3 w-3" /> Patients
                        </div>
                      </div>
                      <div className="rounded-xl border bg-card p-4 text-center">
                        <div className="text-3xl font-bold text-primary">{selectedDoctor.referral_count}</div>
                        <div className="mt-1 text-xs text-muted-foreground flex items-center justify-center gap-1">
                          <FileText className="h-3 w-3" /> Referrals
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="cme" className="mt-6">
                    <EmptyState
                      icon={GraduationCap}
                      title="No CME records"
                      description="The doctor hasn't logged any continuing medical education credits yet."
                    />
                  </TabsContent>
                  
                  <TabsContent value="availability" className="mt-6">
                    <EmptyState
                      icon={Calendar}
                      title="Schedule not set"
                      description="The doctor hasn't configured their regular working hours or availability."
                    />
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="p-4 border-t bg-muted/10 flex justify-between">
                <Button 
                  variant="outline" 
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                  onClick={() => {
                    setDocToRemove(selectedDoctor);
                    setRemoveDialogOpen(true);
                  }}
                >
                  <UserMinus className="mr-2 h-4 w-4" /> Remove
                </Button>
                <Button variant="outline" onClick={() => setSelectedDoctor(null)}>Close</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

// ─── Create Doctor Dialog ──────────────────────────────────────────────────

function CreateDoctorDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "",
    nmcNumber: "", specialization: ""
  });

  const { session, profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!session) throw new Error("Not authenticated");
      if (!profile?.clinic_id) throw new Error("No clinic associated with your profile");

      const payload = {
        email: form.email,
        tempPassword: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        nmcNumber: form.nmcNumber,
        qualifications: form.specialization ? [form.specialization] : [],
        clinicId: profile.clinic_id,
        userId: "DR-" + Math.floor(1000 + Math.random() * 9000).toString(),
      };

      const { data, error } = await supabase.functions.invoke("admin-create-doctor", {
        body: payload
      });

      if (error) throw new Error(error.message || "Failed to create doctor");
      if (data?.error) throw new Error(data.error);

      setOpen(false);
      setForm({ firstName: "", lastName: "", email: "", password: "", nmcNumber: "", specialization: "" });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Create Doctor Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Doctor</DialogTitle>
          <DialogDescription>
            Create an account for a doctor directly. They will be automatically verified and affiliated with your hospital.
          </DialogDescription>
        </DialogHeader>

        <form id="create-doc-form" onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          
          <div className="space-y-1.5">
            <Label>Temporary Password</Label>
            <Input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={6} />
            <p className="text-[10px] text-muted-foreground">The doctor can change this after logging in.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>NMC Number</Label>
              <Input required value={form.nmcNumber} onChange={e => setForm({ ...form, nmcNumber: e.target.value })} placeholder="e.g. MH/12345/2018" />
            </div>
            <div className="space-y-1.5">
              <Label>Specialization</Label>
              <Input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Cardiology" />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} type="button">Cancel</Button>
          <Button type="submit" form="create-doc-form" disabled={saving}>
            {saving ? "Creating..." : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
