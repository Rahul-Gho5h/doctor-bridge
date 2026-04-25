import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — Doctor Bridge" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <AuthShell
      heroTitle="Reset your password"
      heroSubtitle="Enter your registered email and we'll send you a secure link to choose a new password."
    >
      <h1 className="text-2xl font-semibold tracking-tight">Forgot password?</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        No worries. Enter your email and we'll send a reset link.
      </p>
      <div className="mt-7">
        <ForgotPasswordForm />
      </div>
    </AuthShell>
  );
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "/reset-password";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
        </div>
        <div>
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We've sent a password reset link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            The link expires in 1 hour.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn't receive it? Check your spam folder, or{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setSent(false)}
          >
            try again
          </button>
          .
        </p>
        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="doctor@example.com"
            className="pl-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </Button>

      <Link
        to="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </form>
  );
}
