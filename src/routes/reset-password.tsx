import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — Doctor Bridge" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <AuthShell
      heroTitle="Almost there"
      heroSubtitle="Choose a strong new password. Your session is secured with a one-time link."
    >
      <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Must be at least 8 characters.
      </p>
      <div className="mt-7">
        <ResetPasswordForm />
      </div>
    </AuthShell>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  // Supabase redirects back with #access_token=... in the URL hash.
  // The client automatically picks this up and creates a session.
  // We just need to wait for the onAuthStateChange PASSWORD_RECOVERY event.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setSessionReady(true);
        }
      },
    );

    // Also check if session already exists (page reload after initial redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
      else {
        // Give the hash-based token 2 seconds to resolve
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (s) setSessionReady(true);
            else setSessionError(true);
          });
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const strength = (() => {
    if (password.length === 0) return null;
    if (password.length < 8) return "weak";
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    if (score === 0) return "fair";
    if (score === 1) return "good";
    return "strong";
  })();

  const strengthColor: Record<string, string> = {
    weak: "bg-destructive",
    fair: "bg-orange-400",
    good: "bg-yellow-400",
    strong: "bg-emerald-500",
  };
  const strengthLabel: Record<string, string> = {
    weak: "Too short",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  // ── Invalid / expired link ────────────────────────────────────────────────
  if (sessionError) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
        </div>
        <div>
          <p className="font-medium">Link expired or invalid</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Password reset links expire after 1 hour and can only be used once.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.navigate({ to: "/forgot-password" })}
        >
          Request a new link
        </Button>
      </div>
    );
  }

  // ── Waiting for session ───────────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
        Verifying link…
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Strength bar */}
        {strength && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {(["weak", "fair", "good", "strong"] as const).map((level, i) => {
                const levels = ["weak", "fair", "good", "strong"];
                const current = levels.indexOf(strength);
                return (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= current ? strengthColor[strength] : "bg-muted"
                    }`}
                  />
                );
              })}
            </div>
            <p className={`text-xs ${strength === "weak" ? "text-destructive" : strength === "strong" ? "text-emerald-600" : "text-muted-foreground"}`}>
              {strengthLabel[strength]}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <div className="relative">
          <Input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder="Repeat password"
            className={`pr-10 ${confirm && confirm !== password ? "border-destructive focus-visible:ring-destructive" : ""}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfirm((v) => !v)}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm && confirm !== password && (
          <p className="text-xs text-destructive">Passwords don't match</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading || !password || !confirm || password !== confirm || password.length < 8}
      >
        {loading ? (
          "Updating…"
        ) : (
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Set new password
          </span>
        )}
      </Button>
    </form>
  );
}
