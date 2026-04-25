import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Patient {
  id: string;
  blood_group: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  email: string | null;
  allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
}

export function EditPatientDialog({ patient, onSaved }: { patient: Patient; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    blood_group: "", address: "", city: "", state: "", pincode: "", email: "",
    allergies: "", chronic_conditions: "", current_medications: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      blood_group: patient.blood_group ?? "",
      address: patient.address ?? "",
      city: patient.city ?? "",
      state: patient.state ?? "",
      pincode: patient.pincode ?? "",
      email: patient.email ?? "",
      allergies: (patient.allergies ?? []).join(", "),
      chronic_conditions: (patient.chronic_conditions ?? []).join(", "),
      current_medications: (patient.current_medications ?? []).join(", "),
    });
  }, [open, patient]);

  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("global_patients").update({
      blood_group: form.blood_group || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      email: form.email || null,
      allergies: split(form.allergies),
      chronic_conditions: split(form.chronic_conditions),
      current_medications: split(form.current_medications),
    }).eq("id", patient.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient profile updated");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit patient profile</DialogTitle>
          <DialogDescription>Updates are visible to all doctors with access. Identity (name, phone, DOB) cannot be changed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Blood group" v={form.blood_group} on={(v) => setForm({ ...form, blood_group: v })} placeholder="O+, AB-…" />
          <Field label="Email" v={form.email} on={(v) => setForm({ ...form, email: v })} />
          <Field label="City" v={form.city} on={(v) => setForm({ ...form, city: v })} />
          <Field label="State" v={form.state} on={(v) => setForm({ ...form, state: v })} />
          <Field label="Pincode" v={form.pincode} on={(v) => setForm({ ...form, pincode: v })} />
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Address</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Allergies (comma-separated)</Label>
            <Textarea rows={2} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="Penicillin, Peanuts…" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Chronic conditions (comma-separated)</Label>
            <Textarea rows={2} value={form.chronic_conditions} onChange={(e) => setForm({ ...form, chronic_conditions: e.target.value })} placeholder="Hypertension, Type 2 Diabetes…" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Current medications (comma-separated)</Label>
            <Textarea rows={2} value={form.current_medications} onChange={(e) => setForm({ ...form, current_medications: e.target.value })} placeholder="Metformin 500mg, Atorvastatin 10mg…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
