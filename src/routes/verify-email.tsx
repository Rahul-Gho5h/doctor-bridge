import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : "",
  }),
  head: () => ({ meta: [{ title: "Verify your email — Doctor Bridge" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Listen for sign-in event (fires when user clicks link in same browser tab)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email_confirmed_at) {
        router.navigate({ to: "/profile" });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          (event === "SIGNED_IN" || event === "USER_UPDATED") &&
          session?.user?.email_confirmed_at
        ) {
          toast.success("Email verified — welcome to Doctor Bridge!");
          router.navigate({ to: "/profile" });
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [router]);

  // 60-second cooldown after resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const resend = async () => {
    if (!email) {
      toast.error("Email not found. Please register again.");
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
    setCountdown(60);
    toast.success("Verification email resent.");
  };

  return (
    <AuthShell
      heroTitle="One last step"
      heroSubtitle="Verify your email to activate your Doctor Bridge account and gain access to the referral network."
    >
      <div className="space-y-6 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Check your inbox
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We've sent a verification link to{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              "your email address"
            )}
            . Click it to activate your account.
          </p>
        </div>

        {/* Steps */}
        <div className="rounded-xl border bg-muted/30 p-4 text-left text-sm space-y-2">
          <p className="font-medium text-foreground">What to do:</p>
          <ol className="space-y-1.5 text-muted-foreground list-decimal list-inside">
            <li>Open your email inbox (or spam folder)</li>
            <li>Look for an email from Doctor Bridge</li>
            <li>Click <span className="font-medium text-foreground">Confirm your email</span></li>
            <li>You'll be signed in automatically</li>
          </ol>
        </div>

        {/* Resend */}
        <div className="space-y-3">
          {resent && countdown > 0 ? (
            <div className="flex items-center justify-center gap-2 text-sm text-success-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Email resent — check your inbox</span>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Didn't get it? Check spam, or resend.
          </p>

          <Button
            variant="outline"
            className="w-full"
            onClick={resend}
            disabled={resending || countdown > 0}
          >
            {resending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : countdown > 0 ? (
              `Resend available in ${countdown}s`
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend verification email
              </>
            )}
          </Button>
        </div>

        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
