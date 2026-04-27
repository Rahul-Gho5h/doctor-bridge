import { useEffect, useState, KeyboardEvent } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
] as const;

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
  const [form, setForm] = useState<{
    blood_group: string; address: string; city: string; state: string;
    pincode: string; email: string;
    allergies: string[]; chronic_conditions: string[]; current_medications: string[];
  }>({
    blood_group: "", address: "", city: "", state: "", pincode: "", email: "",
    allergies: [], chronic_conditions: [], current_medications: [],
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
      allergies: patient.allergies ?? [],
      chronic_conditions: patient.chronic_conditions ?? [],
      current_medications: patient.current_medications ?? [],
    });
  }, [open, patient]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("global_patients").update({
      blood_group: form.blood_group || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      email: form.email || null,
      allergies: form.allergies,
      chronic_conditions: form.chronic_conditions,
      current_medications: form.current_medications,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit patient profile</DialogTitle>
          <DialogDescription>Updates are visible to all doctors with access. Identity (name, phone, DOB) cannot be changed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Blood group" v={form.blood_group} on={(v) => setForm({ ...form, blood_group: v })} placeholder="O+, AB-…" />
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
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Address</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Allergies</Label>
            <TagInput
              value={form.allergies}
              onChange={(v) => setForm({ ...form, allergies: v })}
              placeholder="Type and press Enter…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Chronic conditions</Label>
            <TagInput
              value={form.chronic_conditions}
              onChange={(v) => setForm({ ...form, chronic_conditions: v })}
              placeholder="Type and press Enter…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Current medications</Label>
            <TagInput
              value={form.current_medications}
              onChange={(v) => setForm({ ...form, current_medications: v })}
              placeholder="Type and press Enter…"
            />
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

function TagInput({ value, onChange, placeholder }: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = (tag: string) => {
    const t = tag.trim();
    if (!t || value.includes(t)) { setInput(""); return; }
    onChange([...value, t]);
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && !input && value.length > 0) remove(value[value.length - 1]);
  };

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-accent-foreground">
          {tag}
          <button type="button" onClick={() => remove(tag)} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={value.length === 0 ? placeholder : ""}
      />
    </div>
  );
}
