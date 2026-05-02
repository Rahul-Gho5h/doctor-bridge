import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, KeyboardEvent } from "react";
import {
  CheckCircle2, Shield, Smartphone, Fingerprint, ShieldCheck,
  Loader2, X, Stethoscope, ToggleLeft, ToggleRight, Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Complete setup — Doctor Bridge" }] }),
  component: OnboardingPage,
});

// ── Step labels ───────────────────────────────────────────────────────────────
const STEPS = ["Clinical profile", "Availability", "Verify identity", "All done"];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-10 flex items-start justify-center">
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-start">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                done   ? "border-primary bg-primary text-primary-foreground"
                : active ? "border-primary bg-background text-primary"
                : "border-border bg-background text-muted-foreground",
              )}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                "hidden text-[11px] font-medium sm:block",
                active ? "text-foreground" : "text-muted-foreground",
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "mx-2 mt-4 h-0.5 w-10 shrink-0 transition-colors sm:w-16",
                i < current ? "bg-primary" : "bg-border",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function OnboardingPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [step, setStep]           = useState(0);
  const [docId, setDocId]         = useState<string | null>(null);
  const [nmcNumber, setNmcNumber] = useState("");
  const [loading, setLoading]     = useState(true);

  const [initClinical, setInitClinical] = useState({
    qualifications:  [] as string[],
    sub_specialties: [] as string[],
    condition_codes: [] as string[],
    languages_spoken: [] as string[],
  });
  const [initAvail, setInitAvail] = useState({
    accepting_referrals: true,
    weekly_referral_cap: 20,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("doctor_profiles")
      .select(`
        id, nmc_number, nmc_verified,
        qualifications, sub_specialties, condition_codes, languages_spoken,
        accepting_referrals, weekly_referral_cap
      `)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          // Not a doctor — redirect away
          router.navigate({ to: "/dashboard" });
          return;
        }
        setDocId(data.id);
        setNmcNumber(data.nmc_number ?? "");
        setInitClinical({
          qualifications:   data.qualifications   ?? [],
          sub_specialties:  data.sub_specialties  ?? [],
          condition_codes:  data.condition_codes  ?? [],
          languages_spoken: data.languages_spoken ?? [],
        });
        setInitAvail({
          accepting_referrals: data.accepting_referrals ?? true,
          weekly_referral_cap: data.weekly_referral_cap ?? 20,
        });
        // Already verified — jump to done screen
        if (data.nmc_verified) setStep(3);
        setLoading(false);
      });
  }, [user, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your profile…
        </div>
      </DashboardLayout>
    );
  }

  const doctorName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "Doctor";

  return (
    <DashboardLayout>
      <PageHeader
        title="Complete your setup"
        description="A few quick steps to get your specialist profile live on the network."
      />

      <div className="mx-auto max-w-2xl">
        <StepIndicator current={step} />

        {step === 0 && (
          <ClinicalStep
            docId={docId!}
            initial={initClinical}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <AvailabilityStep
            docId={docId!}
            initial={initAvail}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <VerifyStep
            docId={docId!}
            doctorName={doctorName}
            nmcNumber={nmcNumber}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <DoneStep onNavigate={() => router.navigate({ to: "/dashboard" })} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Step 1 — Clinical profile ─────────────────────────────────────────────────
function ClinicalStep({ docId, initial, onNext }: {
  docId: string;
  initial: { qualifications: string[]; sub_specialties: string[]; condition_codes: string[]; languages_spoken: string[] };
  onNext: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const arr = (key: keyof typeof form) =>
    (val: string[]) => setForm((p) => ({ ...p, [key]: val }));

  const save = async () => {
    if (form.qualifications.length === 0) {
      toast.error("Add at least one qualification (e.g. MBBS)");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("doctor_profiles")
      .update({
        qualifications:   form.qualifications,
        sub_specialties:  form.sub_specialties,
        condition_codes:  form.condition_codes,
        languages_spoken: form.languages_spoken,
      })
      .eq("id", docId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            Clinical profile
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This is what referring doctors see when they search for a specialist.
          </p>
        </div>
        <div className="space-y-5">
          <TagField
            label="Qualifications *"
            hint="e.g. MBBS, MD, DNB, DM, MCh"
            value={form.qualifications}
            onChange={arr("qualifications")}
          />
          <TagField
            label="Sub-specialties"
            hint="e.g. Interventional Cardiology, Paediatric Nephrology"
            value={form.sub_specialties}
            onChange={arr("sub_specialties")}
          />
          <TagField
            label="ICD-10 condition codes"
            hint="e.g. I21, J45, K35 — conditions you treat"
            value={form.condition_codes}
            onChange={arr("condition_codes")}
          />
          <TagField
            label="Languages spoken"
            hint="Languages you consult in"
            value={form.languages_spoken}
            onChange={arr("languages_spoken")}
            suggestions={["English", "Hindi", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Gujarati", "Malayalam"]}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
            : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}

// ── Step 2 — Availability ─────────────────────────────────────────────────────
function AvailabilityStep({ docId, initial, onBack, onNext }: {
  docId: string;
  initial: { accepting_referrals: boolean; weekly_referral_cap: number };
  onBack: () => void;
  onNext: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.weekly_referral_cap < 1) {
      toast.error("Weekly cap must be at least 1");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("doctor_profiles")
      .update({
        accepting_referrals: form.accepting_referrals,
        weekly_referral_cap: form.weekly_referral_cap,
      })
      .eq("id", docId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ToggleRight className="h-4 w-4 text-muted-foreground" />
            Referral availability
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Control whether GPs can send you referrals, and how many per week.
          </p>
        </div>

        <div className="space-y-5">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="text-sm font-medium">Accepting referrals</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {form.accepting_referrals
                  ? "You will appear in the specialist directory."
                  : "You will be hidden from the directory."}
              </div>
            </div>
            <button
              onClick={() => setForm((p) => ({ ...p, accepting_referrals: !p.accepting_referrals }))}
              className="ml-4 shrink-0"
            >
              {form.accepting_referrals
                ? <ToggleRight className="h-8 w-8 text-primary" />
                : <ToggleLeft  className="h-8 w-8 text-muted-foreground" />
              }
            </button>
          </div>

          {/* Weekly cap */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Weekly referral cap
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={200}
                value={form.weekly_referral_cap}
                onChange={(e) =>
                  setForm((p) => ({ ...p, weekly_referral_cap: Number(e.target.value) }))
                }
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">referrals per week</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={save} disabled={saving}>
          {saving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
            : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}

// ── Step 3 — Identity verification ───────────────────────────────────────────
type VerifyMethod = "nmc" | "aadhaar" | "instant" | null;

function VerifyStep({ docId, doctorName, nmcNumber, onBack, onNext }: {
  docId: string;
  doctorName: string;
  nmcNumber: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [method, setMethod]   = useState<VerifyMethod>(null);
  const [verified, setVerified] = useState(false);

  const handleVerified = async () => {
    const { error } = await supabase
      .from("doctor_profiles")
      .update({ nmc_verified: true, is_public: true })
      .eq("id", docId);
    if (error) { toast.error(error.message); return; }
    setVerified(true);
    setTimeout(onNext, 1400);
  };

  if (verified) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
          <ShieldCheck className="h-7 w-7 text-success-foreground" />
        </div>
        <div className="text-lg font-semibold">Identity verified!</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Taking you to the final step…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Verify your identity
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            We confirm you are the actual licence holder — not just someone who
            knows your NMC number. Choose your preferred method.
          </p>
        </div>

        {/* Method selection */}
        {method === null && (
          <div className="grid gap-3 sm:grid-cols-2">
            <MethodCard
              icon={Smartphone}
              title="NMC mobile OTP"
              description="OTP sent to the mobile number registered with NMC at the time of licensing."
              recommended
              onClick={() => setMethod("nmc")}
            />
            <MethodCard
              icon={Fingerprint}
              title="Aadhaar OTP"
              description="OTP sent to your Aadhaar-linked mobile number via UIDAI. Your Aadhaar number is never stored."
              onClick={() => setMethod("aadhaar")}
            />
            {import.meta.env.DEV && (
              <MethodCard
                icon={Zap}
                title="Instant verify"
                description="Skip OTP for demo — marks your identity as verified immediately."
                onClick={() => setMethod("instant")}
              />
            )}
          </div>
        )}

        {/* NMC flow */}
        {method === "nmc" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">NMC Mobile OTP</span>
              </div>
              <button
                onClick={() => setMethod(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                ← Change method
              </button>
            </div>
            <NmcOtpFlow
              doctorName={doctorName}
              nmcNumber={nmcNumber}
              onSuccess={handleVerified}
            />
          </>
        )}

        {/* Aadhaar flow */}
        {method === "aadhaar" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">Aadhaar OTP</span>
              </div>
              <button
                onClick={() => setMethod(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                ← Change method
              </button>
            </div>
            <AadhaarOtpFlow onSuccess={handleVerified} />
          </>
        )}

        {/* Instant verify (demo) */}
        {method === "instant" && (
          <InstantVerifyFlow onSuccess={handleVerified} onBack={() => setMethod(null)} />
        )}
      </div>

      {method === null && (
        <div className="flex justify-start">
          <Button variant="outline" onClick={onBack}>Back</Button>
        </div>
      )}
    </div>
  );
}

// Method selection card
function MethodCard({ icon: Icon, title, description, recommended, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-colors hover:border-primary hover:bg-primary-soft"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
        {recommended && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Recommended
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

// ── NMC OTP mock flow ─────────────────────────────────────────────────────────
type NmcPhase = "idle" | "checking" | "otp_sent" | "verifying";

function NmcOtpFlow({ doctorName, nmcNumber, onSuccess }: {
  doctorName: string;
  nmcNumber: string;
  onSuccess: () => void;
}) {
  const [phase, setPhase] = useState<NmcPhase>("idle");
  const [otp, setOtp]     = useState("");

  const sendOtp = async () => {
    setPhase("checking");
    await sleep(1500); // mock NMC registry lookup
    setPhase("otp_sent");
  };

  const verify = async () => {
    if (otp.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    setPhase("verifying");
    await sleep(1500); // mock verification
    onSuccess();
  };

  return (
    <div className="space-y-4">
      {phase === "idle" && (
        <>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              NMC Registration
            </div>
            <div className="font-medium">{doctorName}</div>
            <div className="font-mono text-xs text-muted-foreground">{nmcNumber}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            We will look up your NMC record and send a one-time password to your
            registered mobile number.
          </p>
          <Button className="w-full" onClick={sendOtp}>
            Check NMC registry &amp; send OTP
          </Button>
        </>
      )}

      {phase === "checking" && (
        <Spinner label="Checking NMC registry…" />
      )}

      {phase === "otp_sent" && (
        <>
          <div className="rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="mb-1 text-xs font-semibold text-success-foreground">
              ✓ NMC record found
            </div>
            <div className="text-sm">Dr. {doctorName} · NMC {nmcNumber}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              OTP sent to your NMC-registered mobile number
            </div>
          </div>
          <OtpField value={otp} onChange={setOtp} hint="Enter the 6-digit OTP from your mobile" />
          <Button className="w-full" onClick={verify} disabled={otp.length !== 6}>
            Verify OTP
          </Button>
        </>
      )}

      {phase === "verifying" && <Spinner label="Verifying with NMC…" />}
    </div>
  );
}

// ── Aadhaar OTP mock flow ─────────────────────────────────────────────────────
type AadhaarPhase = "idle" | "sending" | "otp_sent" | "verifying";

function AadhaarOtpFlow({ onSuccess }: { onSuccess: () => void }) {
  const [phase, setPhase]     = useState<AadhaarPhase>("idle");
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp]         = useState("");

  const maskedAadhaar = aadhaar.length === 12
    ? `XXXX XXXX ${aadhaar.slice(8)}`
    : "";

  const sendOtp = async () => {
    if (aadhaar.length !== 12) {
      toast.error("Enter your complete 12-digit Aadhaar number");
      return;
    }
    setPhase("sending");
    await sleep(1200); // mock UIDAI call
    setPhase("otp_sent");
  };

  const verify = async () => {
    if (otp.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    setPhase("verifying");
    await sleep(1500); // mock verification
    onSuccess();
  };

  return (
    <div className="space-y-4">
      {/* Privacy note — always visible */}
      <div className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-muted-foreground">
        🔒 Your Aadhaar number is used <strong>only</strong> to trigger an OTP
        via UIDAI. It is never stored on our servers.
      </div>

      {phase === "idle" && (
        <>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Aadhaar number
            </Label>
            <Input
              value={aadhaar}
              onChange={(e) =>
                setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))
              }
              placeholder="12-digit Aadhaar number"
              className="font-mono tracking-wider"
              maxLength={12}
            />
            {maskedAadhaar && (
              <p className="mt-1 text-xs text-muted-foreground">
                Will be referenced as: <span className="font-mono">{maskedAadhaar}</span>
              </p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={sendOtp}
            disabled={aadhaar.length !== 12}
          >
            Send OTP to Aadhaar-linked mobile
          </Button>
        </>
      )}

      {phase === "sending" && <Spinner label="Sending OTP via UIDAI…" />}

      {phase === "otp_sent" && (
        <>
          <div className="rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="mb-1 text-xs font-semibold text-success-foreground">
              ✓ OTP sent
            </div>
            <div className="text-xs text-muted-foreground">
              Aadhaar{" "}
              <span className="font-mono font-medium">{maskedAadhaar}</span>
              {" "}· Sent to your Aadhaar-linked mobile
            </div>
          </div>
          <OtpField value={otp} onChange={setOtp} />
          <Button className="w-full" onClick={verify} disabled={otp.length !== 6}>
            Verify OTP
          </Button>
        </>
      )}

      {phase === "verifying" && <Spinner label="Verifying with UIDAI…" />}
    </div>
  );
}

// ── Instant verify (demo) ─────────────────────────────────────────────────────
function InstantVerifyFlow({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false);

  const go = async () => {
    setLoading(true);
    await sleep(800);
    onSuccess();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">Instant verify</span>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          ← Change method
        </button>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Skips OTP flow and marks your identity as verified immediately.
        When live API keys are configured, this option will be replaced by
        real NMC / Aadhaar verification.
      </div>
      <Button className="w-full" onClick={go} disabled={loading}>
        {loading
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
          : <><Zap className="mr-2 h-4 w-4" />Verify instantly</>
        }
      </Button>
    </div>
  );
}

// ── Step 4 — Done ─────────────────────────────────────────────────────────────
function DoneStep({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-10 text-center shadow-card">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
        <ShieldCheck className="h-8 w-8 text-success-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">You're all set!</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Your profile is now live on the specialist directory. GPs across the
          network can find you and send referrals directly.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 pt-2">
        <Button onClick={onNavigate}>Go to dashboard</Button>
        <Button variant="ghost" size="sm" asChild>
          <a href="/doctors">Preview your listing →</a>
        </Button>
      </div>
    </div>
  );
}

// ── Shared: Tag field ─────────────────────────────────────────────────────────
function TagField({ label, hint, value, onChange, suggestions }: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
}) {
  const [input, setInput] = useState("");

  const add = (tag: string) => {
    const t = tag.trim();
    if (!t || value.includes(t)) { setInput(""); return; }
    onChange([...value, t]);
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    if (e.key === "Backspace" && !input && value.length > 0) remove(value[value.length - 1]);
  };

  const filtered =
    suggestions?.filter(
      (s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()),
    ) ?? [];

  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {hint && <p className="mb-1.5 text-[11px] text-muted-foreground">{hint}</p>}
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-accent-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => { if (input.trim()) add(input); }}
          placeholder={value.length === 0 ? "Type and press Enter" : ""}
        />
      </div>
      {filtered.length > 0 && input && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {filtered.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared: OTP input ─────────────────────────────────────────────────────────
function OtpField({ value, onChange, hint }: {
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        Enter OTP
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6-digit OTP"
        className="font-mono text-center text-xl tracking-[0.4em]"
        maxLength={6}
        autoFocus
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Shared: Spinner ───────────────────────────────────────────────────────────
function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
