import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/onboarding_/pending")({
  head: () => ({ meta: [{ title: "Verification in progress — Doctor Bridge" }] }),
  component: PendingPage,
});

function PendingPage() {
  return (
    <AuthShell
      heroTitle="Almost there."
      heroSubtitle="Our clinical team manually reviews every institution to protect the integrity of the referral network. You'll hear from us within 24–48 hours."
    >
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        {/* Icon stack */}
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-amber-100">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </span>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Verification in progress
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your institution has been registered. Our team is reviewing your
            details and will activate your account within 24–48 hours. You
            will receive an email once verification is complete.
          </p>
        </div>

        {/* What happens next */}
        <div className="w-full rounded-lg border bg-muted/30 p-4 text-left">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            What happens next
          </p>
          <ul className="space-y-2.5">
            {[
              {
                icon: Mail,
                text: "You'll receive a confirmation email with your submission details",
              },
              {
                icon: CheckCircle2,
                text: "Our team verifies your registration number and GST details",
              },
              {
                icon: Clock,
                text: "Account activated within 24–48 hours — we'll email you",
              },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-xs leading-snug text-muted-foreground">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Return to sign in */}
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Return to sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
