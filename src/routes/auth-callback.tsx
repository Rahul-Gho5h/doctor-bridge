import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * /auth-callback
 *
 * Landing page for all Supabase email redirect flows:
 *   - Email verification after signup  (type=signup)
 *   - Magic link sign-in               (type=magiclink)
 *   - Password recovery                (type=recovery  → handled by /reset-password too)
 *
 * Supabase appends #access_token=...&type=signup to this URL.
 * The JS client picks up the token automatically and fires onAuthStateChange.
 *
 * Set this URL in your Supabase dashboard:
 *   Authentication → URL Configuration → Redirect URLs → add  <origin>/auth-callback
 *   Authentication → URL Configuration → Site URL → set to    <origin>
 */

export const Route = createFileRoute("/auth-callback")({
  head: () => ({ meta: [{ title: "Verifying — Doctor Bridge" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase automatically parses the hash fragment and sets the session.
    // onAuthStateChange fires once it's ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) return;

        if (event === "SIGNED_IN") {
          // Email verification after signup
          toast.success("Email verified — welcome to Doctor Bridge!");
          router.navigate({ to: "/profile" });
          return;
        }

        if (event === "PASSWORD_RECOVERY") {
          // Redirect to the set-new-password form
          router.navigate({ to: "/reset-password" });
          return;
        }

        if (event === "USER_UPDATED") {
          router.navigate({ to: "/dashboard" });
        }
      },
    );

    // Also check if a session already exists (e.g. page reload after verification)
    supabase.auth.getSession().then(({ data: { session }, error: sessionErr }) => {
      if (sessionErr) {
        setError(sessionErr.message);
        return;
      }
      if (session?.user?.email_confirmed_at) {
        router.navigate({ to: "/dashboard" });
        return;
      }
      // Give the hash-based token up to 3 s to resolve before showing an error
      const timer = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (s) {
            router.navigate({ to: "/profile" });
          } else {
            setError(
              "This verification link has expired or has already been used. " +
              "Please request a new one.",
            );
          }
        });
      }, 3000);

      return () => clearTimeout(timer);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm space-y-5 text-center">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-semibold">Verification failed</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline">
              <Link to="/register">Create a new account</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Verifying your email…
      </div>
    </div>
  );
}
