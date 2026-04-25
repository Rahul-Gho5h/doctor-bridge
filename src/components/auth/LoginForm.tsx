import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MailWarning, RefreshCw } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUnverified(false);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      // Supabase returns this message when email confirmation is on and not yet done
      if (
        error.message.toLowerCase().includes("email not confirmed") ||
        error.message.toLowerCase().includes("email link is invalid or has expired")
      ) {
        setUnverified(true);
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("Welcome back");

    if (data.user) {
      // Fetch roles and account_type in parallel
      const [{ data: roleRows }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
        supabase.from("profiles").select("account_type").eq("id", data.user.id).maybeSingle(),
      ]);
      const roles = (roleRows ?? []).map((r) => r.role as string);

      // super_admin → platform admin panel
      if (roles.includes("super_admin")) {
        router.navigate({ to: "/platform" });
        return;
      }

      // clinic_admin → dedicated admin dashboard
      if (roles.includes("clinic_admin")) {
        router.navigate({ to: "/admin/dashboard" });
        return;
      }

      // doctor → main dashboard
      if (profileData?.account_type === "doctor") {
        router.navigate({ to: "/dashboard" });
        return;
      }

      // everyone else → main dashboard
      router.navigate({ to: "/dashboard" });
      return;
    }

    router.navigate({ to: "/dashboard" });
  };

  const resendVerification = async () => {
    if (!email) {
      toast.error("Enter your email address above first.");
      return;
    }
    setResending(true);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth-callback`
        : "/auth-callback";

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setResending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setResent(true);
    toast.success("Verification email sent — check your inbox.");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); setUnverified(false); }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Link to="/forgot-password" className="text-sm text-primary hover:underline">
          Forgot password?
        </Link>
      </div>

      {/* Unverified email inline warning */}
      {unverified && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div className="space-y-1.5">
              <p className="font-medium text-warning-foreground">Email not verified</p>
              <p className="text-xs text-muted-foreground">
                Check your inbox for the verification link we sent when you registered.
              </p>
              {resent ? (
                <p className="text-xs font-medium text-success-foreground">
                  ✓ Verification email resent — check your inbox.
                </p>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-60"
                  onClick={resendVerification}
                  disabled={resending}
                >
                  {resending ? (
                    <><RefreshCw className="h-3 w-3 animate-spin" /> Sending…</>
                  ) : (
                    <><RefreshCw className="h-3 w-3" /> Resend verification email</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        New institution?{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Register here
        </Link>
      </p>
    </form>
  );
}
