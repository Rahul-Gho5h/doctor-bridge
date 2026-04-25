import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SettingsSection, SettingsField } from "./SettingsSection";

export function AccountTab() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", title: "", bio: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: "",
      title: profile.title ?? "",
      bio: "",
    });
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("phone,bio").eq("id", user.id).maybeSingle();
      if (data) setForm((f) => ({ ...f, phone: data.phone ?? "", bio: data.bio ?? "" }));
    })();
  }, [profile, user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
        title: form.title || null,
        bio: form.bio || null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  return (
    <SettingsSection title="Personal information" description="This appears on your public profile.">
      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField label="First name" v={form.first_name} on={(v) => setForm({ ...form, first_name: v })} />
        <SettingsField label="Last name" v={form.last_name} on={(v) => setForm({ ...form, last_name: v })} />
        <SettingsField label="Email" v={profile?.email ?? ""} on={() => {}} disabled />
        <SettingsField label="Phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
        <SettingsField label="Title" v={form.title} on={(v) => setForm({ ...form, title: v })} placeholder="MBBS, MD" />
      </div>
      <div>
        <Label className="mb-1.5 block text-xs">Bio</Label>
        <Textarea
          rows={4}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Brief professional bio shown to other doctors."
        />
      </div>
      <Button onClick={save} disabled={busy}>
        <Save className="mr-1.5 h-4 w-4" />
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </SettingsSection>
  );
}
