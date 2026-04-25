import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SettingsSection } from "./SettingsSection";

export function PrivacyTab() {
  const { user } = useAuth();
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("doctor_profiles").select("is_public").eq("user_id", user.id).maybeSingle();
      if (data) setIsPublic(data.is_public);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("doctor_profiles").update({ is_public: isPublic }).eq("user_id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Privacy updated");
  };

  return (
    <SettingsSection
      title="Profile visibility"
      description="Control whether other doctors can find and view your profile."
    >
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <div className="font-medium">Public profile</div>
          <div className="text-xs text-muted-foreground">Listed in Find Specialists. Turn off to hide.</div>
        </div>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
      </div>
      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </SettingsSection>
  );
}
