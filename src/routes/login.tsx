import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Doctor Bridge" }] }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthShell
      heroTitle="Refer patients to the right specialist, fast."
      heroSubtitle="A verified network of NMC-registered doctors. Search by condition, check live availability, send a digital referral with full clinical context, and track outcomes."
    >
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Welcome back.</p>
      <div className="mt-7"><LoginForm /></div>
    </AuthShell>
  );
}
