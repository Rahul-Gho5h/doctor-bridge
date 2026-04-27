import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { UserCog, UserPlus, Search, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Doctors — Doctor Bridge" }] }),
  component: StaffPage,
});

interface Doctor {
  user_id: string;
  doctor_profile_id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string | null;
  is_active: boolean;
  nmc_number: string;
  sub_specialties: string[];
  total_referrals_received: number;
  current_week_referrals: number;
}

function StaffPage() {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!profile?.clinic_id) { setLoading(false); return; }
    const { data: dps } = await supabase
      .from("doctor_profiles")
      .select("id,user_id,nmc_number,sub_specialties,total_referrals_received,current_week_referrals")
      .eq("clinic_id", profile.clinic_id);
    const userIds = (dps ?? []).map((d) => d.user_id);
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id,first_name,last_name,email,title,is_active").in("id", userIds)
      : { data: [] };
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    const merged: Doctor[] = (dps ?? []).map((d) => {
      const p = byId.get(d.user_id);
      return {
        user_id: d.user_id,
        doctor_profile_id: d.id,
        first_name: p?.first_name ?? "",
        last_name: p?.last_name ?? "",
        email: p?.email ?? "",
        title: p?.title ?? null,
        is_active: p?.is_active ?? true,
        nmc_number: d.nmc_number,
        sub_specialties: d.sub_specialties ?? [],
        total_referrals_received: d.total_referrals_received,
        current_week_referrals: d.current_week_referrals,
      };
    });
    setDoctors(merged);
    setLoading(false);
  }, [profile?.clinic_id]);

  useEffect(() => { reload(); }, [reload]);

  const remove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from your hospital?`)) return;
    const { error } = await supabase.rpc("detach_doctor_from_hospital", { _doctor_user_id: userId });
    if (error) toast.error(error.message);
    else { toast.success("Doctor removed"); reload(); }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Doctors"
        description={`${doctors.length} doctor${doctors.length === 1 ? "" : "s"} affiliated with your hospital.`}
      />
      <div className="mb-4 flex justify-end">
        <AddDoctorDialog onAdded={reload} />
      </div>
      {loading ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : doctors.length === 0 ? (
        <EmptyState icon={UserCog} title="No doctors yet" description="Add a doctor to your hospital roster." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Doctor</th>
                <th className="px-4 py-3 text-left">NMC</th>
                <th className="px-4 py-3 text-left">Specialties</th>
                <th className="px-4 py-3 text-left">Referrals</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {doctors.map((d) => (
                <tr key={d.user_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.first_name} {d.last_name}</div>
                    <div className="text-xs text-muted-foreground">{d.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{d.nmc_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.sub_specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.total_referrals_received} total · {d.current_week_referrals} this week
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(d.user_id, `${d.first_name} ${d.last_name}`)}>
                      <X className="mr-1 h-3.5 w-3.5" />Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

interface FoundDoctor {
  doctor_user_id: string;
  doctor_profile_id: string;
  first_name: string;
  last_name: string;
  email: string;
  current_hospital_id: string | null;
  current_hospital_name: string | null;
  sub_specialties: string[];
  qualifications: string[];
}

function AddDoctorDialog({ onAdded }: { onAdded: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" />Add doctor</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a doctor to {profile?.title ? "your hospital" : "your hospital"}</DialogTitle>
          <DialogDescription>
            Search by NMC license. If the doctor is already on Doctor Bridge, send them a request. Otherwise create a new account.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="search">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Find existing doctor</TabsTrigger>
            <TabsTrigger value="create">Create new doctor</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-4">
            <SearchDoctorPanel onDone={() => { setOpen(false); onAdded(); }} />
          </TabsContent>
          <TabsContent value="create" className="mt-4">
            <CreateDoctorPanel onDone={() => { setOpen(false); onAdded(); }} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SearchDoctorPanel({ onDone }: { onDone: () => void }) {
  const { user, profile } = useAuth();
  const [nmc, setNmc] = useState("");
  const [found, setFound] = useState<FoundDoctor | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setSearching(true); setSearched(false); setFound(null);
    const { data, error } = await supabase.rpc("find_doctor_by_license", { _nmc: nmc.trim() });
    setSearching(false); setSearched(true);
    if (error) { toast.error(error.message); return; }
    const row = (data as FoundDoctor[] | null)?.[0] ?? null;
    setFound(row);
  };

  const sendRequest = async () => {
    if (!found || !user || !profile?.clinic_id) return;
    const { data: hospital } = await supabase.from("clinics").select("name").eq("id", profile.clinic_id).single();
    const { error } = await supabase.from("affiliation_requests").insert({
      doctor_user_id: found.doctor_user_id,
      doctor_profile_id: found.doctor_profile_id,
      hospital_clinic_id: profile.clinic_id,
      hospital_name: hospital?.name ?? "Hospital",
      initiated_by: "HOSPITAL",
      initiated_by_user_id: user.id,
      message: message || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Request sent. Doctor will receive an invitation."); onDone(); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>NMC license number</Label>
        <div className="flex gap-2">
          <Input value={nmc} onChange={(e) => setNmc(e.target.value)} placeholder="e.g. MH/12345/2018"
            onKeyDown={(e) => e.key === "Enter" && nmc && search()} />
          <Button variant="outline" onClick={search} disabled={!nmc || searching}>
            <Search className="mr-2 h-4 w-4" />Search
          </Button>
        </div>
      </div>

      {searched && !found && (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No doctor found with this NMC. Use the "Create new doctor" tab to register them.
        </div>
      )}

      {found && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-4">
          <div>
            <div className="font-medium">{found.first_name} {found.last_name}</div>
            <div className="text-sm text-muted-foreground">{found.email}</div>
          </div>
          {found.qualifications.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Qualifications:</span> {found.qualifications.join(", ")}
            </div>
          )}
          {found.sub_specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {found.sub_specialties.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
            </div>
          )}
          {found.current_hospital_name && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
              Currently affiliated with <strong>{found.current_hospital_name}</strong>. They'll need to resign before joining your hospital.
            </div>
          )}
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Welcome message or role details" />
          </div>
          <Button onClick={sendRequest} disabled={!!found.current_hospital_id} className="w-full">
            Send affiliation request
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateDoctorPanel({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    nmcNumber: "", qualifications: "", subSpecialties: "", password: "",
  });
  const [loading, setLoading] = useState(false);
  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
        subSpecialties: form.subSpecialties.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const { data, error } = await supabase.functions.invoke("admin-create-doctor", { body: payload });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success(`${form.firstName} ${form.lastName} added. Share the credentials with them.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create doctor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>First name</Label><Input value={form.firstName} onChange={update("firstName")} /></div>
        <div className="space-y-1.5"><Label>Last name</Label><Input value={form.lastName} onChange={update("lastName")} /></div>
      </div>
      <div className="space-y-1.5"><Label>NMC license number</Label><Input value={form.nmcNumber} onChange={update("nmcNumber")} /></div>
      <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={update("email")} /></div>
      <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={update("phone")} /></div>
      <div className="space-y-1.5"><Label>Qualifications</Label><Input value={form.qualifications} onChange={update("qualifications")} placeholder="MBBS, MD (comma separated)" /></div>
      <div className="space-y-1.5"><Label>Sub-specialties</Label><Input value={form.subSpecialties} onChange={update("subSpecialties")} placeholder="Cardiology, Interventional" /></div>
      <div className="space-y-1.5"><Label>Temporary password</Label><Input type="text" minLength={8} value={form.password} onChange={update("password")} placeholder="Minimum 8 characters — share with the doctor" /></div>
      <DialogFooter className="pt-2">
        <Button onClick={submit} disabled={loading || !form.email || !form.firstName || !form.lastName || !form.nmcNumber || form.password.length < 8} className="w-full">
          {loading ? "Creating…" : "Create doctor account"}
        </Button>
      </DialogFooter>
    </div>
  );
}
