import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, UserPlus, Users, ChevronDown, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { age, formatDate } from "@/lib/format";
import { toast } from "sonner";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
] as const;

export const Route = createFileRoute("/patients/")({
  head: () => ({ meta: [{ title: "Patients — Doctor Bridge" }] }),
  component: PatientsPage,
});

interface SearchRow {
  id: string; display_id: string; first_name: string; last_name: string;
  phone: string; date_of_birth: string; gender: string;
  city: string | null; state: string | null; pincode: string | null;
  blood_group: string | null;
  has_access: boolean;
}

function PatientsPage() {
  const PAGE_SIZE = 30;
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [genderFilter, setGenderFilter]         = useState("ALL");
  const [bloodGroupFilter, setBloodGroupFilter] = useState("ALL");

  const hasFilters = genderFilter !== "ALL" || bloodGroupFilter !== "ALL";

  const filteredRows = useMemo(() => rows.filter((p) => {
    if (genderFilter     !== "ALL" && p.gender.toUpperCase()    !== genderFilter)    return false;
    if (bloodGroupFilter !== "ALL" && (p.blood_group ?? "") !== bloodGroupFilter) return false;
    return true;
  }), [rows, genderFilter, bloodGroupFilter]);

  const clearFilters = () => { setGenderFilter("ALL"); setBloodGroupFilter("ALL"); };

  const search = useCallback(async (term: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("search_global_patients", { _q: term });
    if (error) { toast.error(error.message); setRows([]); setLoading(false); return; }
    const rpcRows = (data ?? []) as SearchRow[];
    if (rpcRows.length > 0) {
      const { data: extras } = await supabase
        .from("global_patients")
        .select("id,blood_group")
        .in("id", rpcRows.map((r) => r.id));
      const bgMap = new Map(
        (extras ?? []).map((e) => [e.id as string, e.blood_group as string | null])
      );
      setRows(rpcRows.map((r) => ({ ...r, blood_group: bgMap.get(r.id) ?? null })));
    } else {
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { search(""); }, [search]);

  // debounce + reset display count on new search
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  // reset display count when filters change
  useEffect(() => { setDisplayCount(PAGE_SIZE); }, [genderFilter, bloodGroupFilter]);

  return (
    <ErrorBoundary>
    <DashboardLayout>
      <PageHeader
        title="Patients"
        description="Search and manage patient records shared across the verified doctor network."
        actions={<RegisterPatientDialog onCreated={() => search(q)} />}
      />

      <div className="mb-6 rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-sm font-semibold">Search patient records</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Search by common patient ID, MRN, name, mobile, DOB, gender, city, village,
          pincode, or state. Records are shared across verified doctors so the next
          doctor can see the full clinical timeline.
        </p>
        <div className="mt-4">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Patient search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="PID, Sanjay, 1968-04-12, male, Mumbai, 400069…"
              className="h-12 rounded-xl pl-10 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="h-9 w-36 text-xs">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All genders</SelectItem>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
          <SelectTrigger className="h-9 w-36 text-xs">
            <SelectValue placeholder="Blood group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All blood groups</SelectItem>
            {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bg) => (
              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No patients match" : "No patients yet"}
          description={
            q
              ? `No results for "${q}". Try name, phone, DOB, city, or patient ID.`
              : "Register your first patient using the button above. Their records will be accessible to all verified doctors on the network."
          }
          action={
            !q ? (
              <RegisterPatientDialog onCreated={() => search("")} />
            ) : undefined
          }
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No patients match filters"
          description="Try adjusting the gender or blood group filter, or clear all filters to see all results."
          action={
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <X className="h-3.5 w-3.5" />Clear filters
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <span className="font-medium text-foreground">{Math.min(displayCount, filteredRows.length)}</span>
              {" "}of <span className="font-medium text-foreground">{filteredRows.length}</span>
              {hasFilters && rows.length !== filteredRows.length && (
                <> (filtered from {rows.length})</>
              )}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Age / Sex</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.slice(0, displayCount).map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{p.display_id}</td>
                    <td className="px-4 py-3 font-medium">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-4 py-3">{age(p.date_of_birth)}y · {p.gender}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[p.city, p.state, p.pincode].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/patients/$patientId" params={{ patientId: p.id }}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRows.length > displayCount && (
              <div className="border-t px-4 py-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
                >
                  <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                  Show {Math.min(PAGE_SIZE, filteredRows.length - displayCount)} more
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
    </ErrorBoundary>
  );
}

function RegisterPatientDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", dob: "", gender: "MALE",
    city: "", state: "", pincode: "", email: "", blood_group: "",
  });

  const submit = async () => {
    if (!form.first_name || !form.last_name || !form.phone || !form.dob) {
      toast.error("Name, phone, and DOB are required");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("upsert_global_patient", {
      _first_name: form.first_name, _last_name: form.last_name,
      _phone: form.phone, _dob: form.dob,
      _gender: form.gender as "MALE" | "FEMALE" | "OTHER",
      _city: form.city || undefined, _state: form.state || undefined,
      _pincode: form.pincode || undefined, _email: form.email || undefined,
      _blood_group: form.blood_group || undefined,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient registered");
    setOpen(false);
    setForm({ first_name: "", last_name: "", phone: "", dob: "", gender: "MALE", city: "", state: "", pincode: "", email: "", blood_group: "" });
    onCreated();
    void data;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />Add patient
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Register a new patient</DialogTitle>
          <DialogDescription>Phone + DOB form a unique global identity. Existing patients will be matched automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name *" v={form.first_name} on={(v) => setForm({ ...form, first_name: v })} />
          <Field label="Last name *" v={form.last_name} on={(v) => setForm({ ...form, last_name: v })} />
          <Field label="Phone *" v={form.phone} on={(v) => setForm({ ...form, phone: v })} placeholder="+91…" />
          <Field label="Date of birth *" type="date" v={form.dob} on={(v) => setForm({ ...form, dob: v })} />
          <div>
            <Label className="mb-1.5 block text-xs">Gender</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Blood group</Label>
            <Select value={form.blood_group} onValueChange={(v) => setForm({ ...form, blood_group: v === "NONE" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Not specified</SelectItem>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bg) => (
                  <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Email" v={form.email} on={(v) => setForm({ ...form, email: v })} />
          <Field label="City" v={form.city} on={(v) => setForm({ ...form, city: v })} />
          <div>
            <Label className="mb-1.5 block text-xs">State</Label>
            <Select value={form.state || "NONE"} onValueChange={(v) => setForm({ ...form, state: v === "NONE" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select state…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Not specified</SelectItem>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Pincode" v={form.pincode} on={(v) => setForm({ ...form, pincode: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Register"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, v, on, type = "text", placeholder }: {
  label: string; v: string; on: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
