import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SettingsSection, SettingsField } from "./SettingsSection";

const EQUIPMENT_OPTIONS = [
  "MRI",
  "CT Scan",
  "PET-CT",
  "X-Ray",
  "Ultrasound",
  "Cath Lab",
  "ICU",
  "NICU",
  "ECMO",
  "Robotic Surgery",
  "Dialysis Unit",
  "Operation Theatre",
  "Blood Bank",
  "Pharmacy",
  "Laboratory",
] as const;

type ClinicRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  working_hours: Record<string, string> | null;
  settings: Record<string, any> | null;
  equipment: string[] | null;
  gst_number: string | null;
  registration_number: string | null;
  platform_id: string | null;
  verification_status: string | null;
};

export function InstitutionTab() {
  const { profile } = useAuth();

  const [clinic, setClinic] = useState<ClinicRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    working_hours: "",
  });
  const [equipment, setEquipment] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // ── Fetch clinic ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.clinic_id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select(
          "id,name,phone,address,city,state,working_hours,settings,equipment,gst_number,registration_number,platform_id,verification_status"
        )
        .eq("id", profile.clinic_id!)
        .maybeSingle();

      if (error) toast.error(error.message);
      if (data) {
        const row = data as unknown as ClinicRow;
        setClinic(row);
        setForm({
          name: row.name ?? "",
          phone: row.phone ?? "",
          address: row.address ?? "",
          city: row.city ?? "",
          state: row.state ?? "",
          working_hours: row.working_hours?.text ?? "",
        });
        setEquipment((row.equipment as string[] | null) ?? []);
      }
      setLoading(false);
    })();
  }, [profile?.clinic_id]);

  // ── Equipment toggle ─────────────────────────────────────────────────────────
  const toggleEquipment = (item: string) =>
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!clinic) return;
    setBusy(true);

    const { error } = await supabase
      .from("clinics")
      .update({
        name: form.name || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        working_hours: form.working_hours ? { text: form.working_hours } : null,
        equipment: equipment.length > 0 ? equipment : null,
      })
      .eq("id", clinic.id);

    setBusy(false);

    if (error) toast.error(error.message);
    else {
      toast.success("Institution details updated");
      // Keep local clinic state in sync so re-edits work correctly
      setClinic((c) =>
        c
          ? {
              ...c,
              ...form,
              working_hours: form.working_hours ? { text: form.working_hours } : null,
              equipment: equipment.length > 0 ? equipment : null,
            }
          : c
      );
    }
  };

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading institution details…
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-card">
        No institution linked to your account. Contact the platform admin.
      </div>
    );
  }

  // ── Status badge helper ───────────────────────────────────────────────────────
  const statusColour: Record<string, string> = {
    ACTIVE: "text-success",
    PENDING: "text-warning",
    SUSPENDED: "text-destructive",
    REJECTED: "text-destructive",
  };

  return (
    <div className="space-y-4">
      {/* ── Basic details ──────────────────────────────────────────────────── */}
      <SettingsSection
        title="Institution details"
        description="Core contact and location information shown to referrers."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsField
            label="Institution name"
            v={form.name}
            on={(v) => setForm({ ...form, name: v })}
            placeholder="City Hospital"
          />
          <SettingsField
            label="Phone"
            v={form.phone}
            on={(v) => setForm({ ...form, phone: v })}
            placeholder="+91 98765 43210"
          />
          <SettingsField
            label="Address"
            v={form.address}
            on={(v) => setForm({ ...form, address: v })}
            placeholder="12 MG Road"
          />
          <SettingsField
            label="City"
            v={form.city}
            on={(v) => setForm({ ...form, city: v })}
            placeholder="Bengaluru"
          />
          <SettingsField
            label="State"
            v={form.state}
            on={(v) => setForm({ ...form, state: v })}
            placeholder="Karnataka"
          />
          <SettingsField
            label="Working hours"
            v={form.working_hours}
            on={(v) => setForm({ ...form, working_hours: v })}
            placeholder="Mon–Sat 8 AM – 8 PM"
          />
        </div>
      </SettingsSection>

      {/* ── Equipment ──────────────────────────────────────────────────────── */}
      <SettingsSection
        title="Available equipment"
        description="Select all equipment and facilities available at your institution."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EQUIPMENT_OPTIONS.map((item) => {
            const checked = equipment.includes(item);
            return (
              <label
                key={item}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors select-none ${
                  checked
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-transparent text-foreground hover:bg-muted/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEquipment(item)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {item}
              </label>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── Platform / regulatory (read-only) ─────────────────────────────── */}
      <SettingsSection
        title="Platform & regulatory info"
        description="These fields are managed by the DoctorLink platform and cannot be self-edited."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsField
            label="Platform ID"
            v={clinic.platform_id ?? "—"}
            on={() => {}}
            disabled
          />
          <div>
            <label className="mb-1.5 block text-xs font-medium leading-none">
              Verification status
            </label>
            <div
              className={`flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm font-medium opacity-75 ${
                statusColour[clinic.verification_status ?? ""] ?? ""
              }`}
            >
              {clinic.verification_status ?? "—"}
            </div>
          </div>
          <SettingsField
            label="GST number"
            v={clinic.gst_number ?? "—"}
            on={() => {}}
            disabled
          />
          <SettingsField
            label="Registration number"
            v={clinic.registration_number ?? "—"}
            on={() => {}}
            disabled
          />
        </div>
      </SettingsSection>

      {/* ── Save ───────────────────────────────────────────────────────────── */}
      <Button onClick={save} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-1.5 h-4 w-4" />
        )}
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
