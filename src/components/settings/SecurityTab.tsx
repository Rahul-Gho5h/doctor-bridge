import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SettingsSection, SettingsField } from "./SettingsSection";

interface MfaState {
  loading: boolean;
  hasVerified: boolean;
  enrolling: boolean;
  factorId: string | null;
  qrDataUrl: string | null;
  secret: string | null;
  code: string;
  busy: boolean;
}

export function SecurityTab() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const [mfa, setMfa] = useState<MfaState>({
    loading: true,
    hasVerified: false,
    enrolling: false,
    factorId: null,
    qrDataUrl: null,
    secret: null,
    code: "",
    busy: false,
  });

  const refreshFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setMfa((s) => ({ ...s, loading: false }));
      return;
    }
    const verified = (data?.totp ?? []).some((f) => f.status === "verified");
    setMfa((s) => ({ ...s, loading: false, hasVerified: verified }));
  };

  useEffect(() => {
    refreshFactors();
  }, []);

  const change = async () => {
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPw("");
    }
  };

  const startEnroll = async () => {
    setMfa((s) => ({ ...s, busy: true }));
    // Clean up any unverified factors first to avoid friendly_name collisions
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.totp ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${Date.now()}`,
    });
    if (error || !data) {
      toast.error(error?.message ?? "Could not start 2FA enrollment");
      setMfa((s) => ({ ...s, busy: false }));
      return;
    }
    const qrDataUrl = await QRCode.toDataURL(data.totp.uri, { margin: 1, width: 220 });
    setMfa((s) => ({
      ...s,
      enrolling: true,
      factorId: data.id,
      qrDataUrl,
      secret: data.totp.secret,
      code: "",
      busy: false,
    }));
  };

  const verifyEnroll = async () => {
    if (!mfa.factorId || mfa.code.length < 6) return;
    setMfa((s) => ({ ...s, busy: true }));
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: mfa.factorId });
    if (chalErr || !chal) {
      toast.error(chalErr?.message ?? "Could not request challenge");
      setMfa((s) => ({ ...s, busy: false }));
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: mfa.factorId,
      challengeId: chal.id,
      code: mfa.code,
    });
    if (verErr) {
      toast.error(verErr.message);
      setMfa((s) => ({ ...s, busy: false }));
      return;
    }
    await supabase.from("profiles").update({ two_factor_enabled: true }).eq("id", (await supabase.auth.getUser()).data.user!.id);
    toast.success("Two-factor authentication enabled");
    setMfa({ loading: false, hasVerified: true, enrolling: false, factorId: null, qrDataUrl: null, secret: null, code: "", busy: false });
  };

  const cancelEnroll = async () => {
    if (mfa.factorId) await supabase.auth.mfa.unenroll({ factorId: mfa.factorId });
    setMfa((s) => ({ ...s, enrolling: false, factorId: null, qrDataUrl: null, secret: null, code: "" }));
  };

  const disable2fa = async () => {
    setMfa((s) => ({ ...s, busy: true }));
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.totp ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) await supabase.from("profiles").update({ two_factor_enabled: false }).eq("id", userId);
    toast.success("Two-factor authentication disabled");
    setMfa((s) => ({ ...s, hasVerified: false, busy: false }));
  };

  return (
    <div className="space-y-4">
      <SettingsSection title="Change password">
        <div className="max-w-sm space-y-3">
          <SettingsField label="New password" type="password" v={pw} on={setPw} placeholder="At least 8 characters" />
          <Button onClick={change} disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Two-factor authentication" description="Use an authenticator app (Google Authenticator, 1Password, Authy) for a 6-digit code on each sign-in.">
        {mfa.loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
          </div>
        ) : mfa.hasVerified ? (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">2FA is active</div>
                <div className="text-xs text-muted-foreground">You'll be asked for a code at sign-in.</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={disable2fa} disabled={mfa.busy}>
              <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
              Disable
            </Button>
          </div>
        ) : mfa.enrolling ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              {mfa.qrDataUrl && (
                <img src={mfa.qrDataUrl} alt="2FA QR code" className="h-44 w-44 rounded-md border bg-white p-2" />
              )}
              <div className="flex-1 space-y-2 text-sm">
                <p className="font-medium">1. Scan the QR code with your authenticator app.</p>
                <p className="text-muted-foreground">Or enter this secret manually:</p>
                <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{mfa.secret}</code>
                <p className="pt-2 font-medium">2. Enter the 6-digit code shown in the app:</p>
                <div className="flex max-w-[200px] gap-2">
                  <Input
                    value={mfa.code}
                    onChange={(e) => setMfa((s) => ({ ...s, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="font-mono tracking-widest"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={mfa.busy || mfa.code.length < 6}>
                {mfa.busy ? "Verifying…" : "Verify & enable"}
              </Button>
              <Button variant="outline" onClick={cancelEnroll} disabled={mfa.busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium">Authenticator app (TOTP)</div>
              <div className="text-xs text-muted-foreground">Add a second step to your sign-in.</div>
            </div>
            <Button onClick={startEnroll} disabled={mfa.busy}>
              {mfa.busy ? "Starting…" : "Enable 2FA"}
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Active sessions" description="Sign out of this device.">
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          Sign out everywhere
        </Button>
      </SettingsSection>
    </div>
  );
}
