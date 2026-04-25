import { useAuth } from "@/hooks/useAuth";

/**
 * Top-of-page clinic banner.
 * Renders the active clinic name + a small defaults strip, mirroring
 * the post-login pattern of the Doctor Connect reference UI.
 */
export function ClinicBanner() {
  const { profile } = useAuth();
  const clinicName =
    profile?.account_type === "doctor"
      ? "Independent practice"
      : profile?.account_type === "hospital_admin"
        ? "Hospital admin workspace"
        : "Clinic workspace";

  return (
    <div className="border-b bg-card/60 px-4 py-3 md:px-8">
      <div className="text-sm font-semibold text-primary">{clinicName}</div>
      <div className="text-xs text-muted-foreground">
        India defaults: INR, Asia/Kolkata, verified doctors only
      </div>
    </div>
  );
}
