import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SettingsSection } from "./SettingsSection";

type Prefs = {
  email_referrals: boolean;
  email_messages: boolean;
  email_affiliations: boolean;
  inapp_referrals: boolean;
  inapp_messages: boolean;
  inapp_affiliations: boolean;
};

const DEFAULT_PREFS: Prefs = {
  email_referrals: true,
  email_messages: true,
  email_affiliations: true,
  inapp_referrals: true,
  inapp_messages: true,
  inapp_affiliations: true,
};

const ROWS: { k: "referrals" | "messages" | "affiliations"; label: string }[] = [
  { k: "referrals", label: "Referrals (sent / received / status updates)" },
  { k: "messages", label: "Direct messages from other doctors" },
  { k: "affiliations", label: "Hospital affiliation requests" },
];

export function NotificationsTab() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("email_referrals,email_messages,email_affiliations,inapp_referrals,inapp_messages,inapp_affiliations")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs(data as Prefs);
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...prefs }, { onConflict: "user_id" });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Preferences saved");
  };

  if (loading) {
    return (
      <SettingsSection title="Notification preferences">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title="Notification preferences" description="Pick the channels for each notification category.">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2 text-left">Category</th>
            <th className="py-2">Email</th>
            <th className="py-2">In-app</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ROWS.map((row) => (
            <tr key={row.k}>
              <td className="py-3 font-medium">{row.label}</td>
              <td className="py-3 text-center">
                <Switch
                  checked={prefs[`email_${row.k}` as keyof Prefs]}
                  onCheckedChange={(v) => setPrefs({ ...prefs, [`email_${row.k}`]: v })}
                />
              </td>
              <td className="py-3 text-center">
                <Switch
                  checked={prefs[`inapp_${row.k}` as keyof Prefs]}
                  onCheckedChange={(v) => setPrefs({ ...prefs, [`inapp_${row.k}`]: v })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save preferences"}
      </Button>
    </SettingsSection>
  );
}
