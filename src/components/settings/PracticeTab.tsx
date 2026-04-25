import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SettingsSection, SettingsField } from "./SettingsSection";

export function PracticeTab() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    weekly_referral_cap: 20,
    accepting_referrals: true,
    telemedicine_enabled: false,
    languages_spoken: "",
    consultation_fee: "" as string,
    city: "",
    state: "",
    pincode: "",
    practice_address: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("doctor_profiles")
        .select("weekly_referral_cap,accepting_referrals,telemedicine_enabled,languages_spoken,city,state,pincode,practice_address")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: prof } = await supabase.from("profiles").select("consultation_fee").eq("id", user.id).maybeSingle();
      if (data)
        setForm({
          weekly_referral_cap: data.weekly_referral_cap,
          accepting_referrals: data.accepting_referrals,
          telemedicine_enabled: data.telemedicine_enabled,
          languages_spoken: (data.languages_spoken ?? []).join(", "),
          consultation_fee: prof?.consultation_fee ? String(prof.consultation_fee) : "",
          city: data.city ?? "",
          state: data.state ?? "",
          pincode: data.pincode ?? "",
          practice_address: data.practice_address ?? "",
        });
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const langs = form.languages_spoken.split(",").map((s) => s.trim()).filter(Boolean);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase
        .from("doctor_profiles")
        .update({
          weekly_referral_cap: form.weekly_referral_cap,
          accepting_referrals: form.accepting_referrals,
          telemedicine_enabled: form.telemedicine_enabled,
          languages_spoken: langs,
          city: form.city || null,
          state: form.state || null,
          pincode: form.pincode || null,
          practice_address: form.practice_address || null,
        })
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .update({ consultation_fee: form.consultation_fee ? +form.consultation_fee : null })
        .eq("id", user.id),
    ]);
    setBusy(false);
    const err = e1 ?? e2;
    if (err) toast.error(err.message);
    else toast.success("Practice settings saved");
  };

  return (
    <div className="space-y-4">
      <SettingsSection title="Referral preferences">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Accepting new referrals</div>
            <div className="text-xs text-muted-foreground">Toggle off when fully booked or on leave.</div>
          </div>
          <Switch
            checked={form.accepting_referrals}
            onCheckedChange={(v) => setForm({ ...form, accepting_referrals: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Telemedicine consultations</div>
            <div className="text-xs text-muted-foreground">Allow remote consultations.</div>
          </div>
          <Switch
            checked={form.telemedicine_enabled}
            onCheckedChange={(v) => setForm({ ...form, telemedicine_enabled: v })}
          />
        </div>
        <SettingsField
          label="Weekly referral cap"
          type="number"
          v={String(form.weekly_referral_cap)}
          on={(v) => setForm({ ...form, weekly_referral_cap: +v || 20 })}
        />
        <SettingsField
          label="Consultation fee (INR)"
          type="number"
          v={form.consultation_fee}
          on={(v) => setForm({ ...form, consultation_fee: v })}
        />
        <SettingsField
          label="Languages spoken (comma-separated)"
          v={form.languages_spoken}
          on={(v) => setForm({ ...form, languages_spoken: v })}
          placeholder="English, Hindi, Marathi"
        />
      </SettingsSection>

      <SettingsSection title="Practice location">
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsField label="City" v={form.city} on={(v) => setForm({ ...form, city: v })} />
          <SettingsField label="State" v={form.state} on={(v) => setForm({ ...form, state: v })} />
          <SettingsField label="Pincode" v={form.pincode} on={(v) => setForm({ ...form, pincode: v })} />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Address</Label>
          <Textarea
            rows={2}
            value={form.practice_address}
            onChange={(e) => setForm({ ...form, practice_address: e.target.value })}
          />
        </div>
      </SettingsSection>

      <Button onClick={save} disabled={busy}>
        <Save className="mr-1.5 h-4 w-4" />
        {busy ? "Saving…" : "Save practice settings"}
      </Button>
    </div>
  );
}
