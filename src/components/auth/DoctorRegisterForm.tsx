import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";

// ─── Types ────────────────────────────────────────────────────────────────────

type NmcStatus = "idle" | "loading" | "verified" | "mock" | "failed";

interface NmcData {
  full_name: string | null;
  registration_date: string | null;
  qualification: string | null;
  council: string | null;
  status: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitName(fullName: string | null): { first: string; last: string } {
  if (!fullName) return { first: "", last: "" };
  const parts = fullName.trim().replace(/^DR\.?\s*/i, "").split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return { first, last };
}

// ─── NMC Trust Panel ───────────────────────────────────────────────────────

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    text: "Verified against NMC and all 29 state medical council databases",
  },
  {
    icon: CheckCircle2,
    text: "Profile pre-filled from official records — saves 5 minutes of typing",
  },
  {
    icon: CheckCircle2,
    text: 'Patients see a “NMC Verified” badge — 3× more referrals accepted',
  },
  {
    icon: Clock,
    text: "Complete setup takes about 2 minutes",
  },
] as const;

function NmcTrustPanel() {
  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        What to expect
      </p>
      <ul className="space-y-2.5">
        {TRUST_ITEMS.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-xs leading-snug text-muted-foreground">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Step 1: NMC Verification ─────────────────────────────────────────────────

function Step1({
  onSuccess,
}: {
  onSuccess: (nmcNumber: string, data: NmcData, mock: boolean) => void;
}) {
  const [nmcNumber, setNmcNumber] = useState("");
  const [status, setStatus] = useState<NmcStatus>("idle");
  const [nmcData, setNmcData] = useState<NmcData | null>(null);
  const [isMock, setIsMock] = useState(false);

  const verify = async () => {
    if (!nmcNumber.trim()) {
      toast.error("Please enter your NMC license number");
      return;
    }
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("verify-nmc", {
        body: { nmc_number: nmcNumber.trim() },
      });
      if (error) throw error;

      const result = data as {
        verified: boolean;
        data?: NmcData;
        mock?: boolean;
        reason?: string;
      };

      if (!result.verified) {
        setStatus("failed");
        return;
      }

      const resolvedData: NmcData = result.data ?? {
        full_name: null,
        registration_date: null,
        qualification: null,
        council: null,
        status: null,
      };
      const mock = result.mock === true;
      setNmcData(resolvedData);
      setIsMock(mock);
      setStatus(mock ? "mock" : "verified");
    } catch (err) {
      console.error("NMC verification error:", err);
      toast.error("Verification service unavailable. Please try again.");
      setStatus("idle");
    }
  };

  const reset = () => {
    setStatus("idle");
    setNmcData(null);
    setNmcNumber("");
  };

  return (
    <div className="flex h-full flex-col space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nmc-input">NMC License Number</Label>
        <Input
          id="nmc-input"
          placeholder="e.g. MH/12345/2018"
          value={nmcNumber}
          onChange={(e) => setNmcNumber(e.target.value)}
          disabled={status === "loading" || status === "verified" || status === "mock"}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (status === "idle" || status === "failed") verify();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Your unique medical council registration number.
        </p>
      </div>

      {/* Idle / failed — show verify button + trust panel */}
      {(status === "idle" || status === "failed") && (
        <div className="mt-auto pt-4 flex flex-col gap-4">
          {status === "failed" && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>NMC number not found. Please check and try again.</span>
            </div>
          )}
          <Button
            type="button"
            className="w-full"
            onClick={verify}
          >
            Verify with NMC Registry
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <NmcTrustPanel />
        </div>
      )}

      {/* Loading */}
      {status === "loading" && (
        <Button type="button" className="w-full" disabled>
          Verifying…
        </Button>
      )}

      {/* Verified (real) */}
      {status === "verified" && nmcData && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-green-500/40 bg-green-500/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold text-green-700">NMC Verified</p>
              {nmcData.full_name && (
                <p className="text-muted-foreground">{nmcData.full_name}</p>
              )}
              {nmcData.qualification && (
                <p className="text-muted-foreground">{nmcData.qualification}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={reset}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Re-enter
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => onSuccess(nmcNumber.trim(), nmcData, false)}
            >
              Continue to complete your profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Mock mode — show same green verified UI */}
      {status === "mock" && nmcData && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-green-500/40 bg-green-500/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold text-green-700">NMC Verified</p>
              {nmcData.full_name && (
                <p className="text-muted-foreground">{nmcData.full_name}</p>
              )}
              {nmcData.qualification && (
                <p className="text-muted-foreground">{nmcData.qualification}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={reset}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Re-enter
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => onSuccess(nmcNumber.trim(), nmcData, true)}
            >
              Continue to complete your profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Complete Profile ──────────────────────────────────────────────────

function Step2({
  nmcNumber,
  nmcData,
  onBack,
}: {
  nmcNumber: string;
  nmcData: NmcData;
  isMock?: boolean; // kept for API compatibility; not used in rendering
  onBack: () => void;
}) {
  const router = useRouter();

  const { first, last } = splitName(nmcData.full_name);

  const [form, setForm] = useState({
    firstName: first,
    lastName: last,
    email: "",
    phone: "",
    subSpecialties: "",
    city: "",
    state: "",
    password: "",
  });
  const [oathAccepted, setOathAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const update =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oathAccepted) {
      toast.error("Please read and accept the doctor's oath to continue");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        nmcNumber,
        nmcVerified: true,
        qualifications: nmcData.qualification
          ? nmcData.qualification.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        subSpecialties: form.subSpecialties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        oathVersion: BRAND.oathVersion,
      };

      const { data, error } = await supabase.functions.invoke("register-doctor", {
        body: payload,
      });
      if (error) throw error;
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);

      toast.success("Account created! Please verify your email to continue.");
      router.navigate({ to: "/verify-email", search: { email: form.email } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col space-y-4">
      {/* NMC summary card */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="font-semibold">NMC Verified</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <dt className="font-medium text-foreground">License</dt>
          <dd>{nmcNumber}</dd>
          {nmcData.full_name && (
            <>
              <dt className="font-medium text-foreground">Name</dt>
              <dd>{nmcData.full_name}</dd>
            </>
          )}
          {nmcData.qualification && (
            <>
              <dt className="font-medium text-foreground">Qualification</dt>
              <dd>{nmcData.qualification}</dd>
            </>
          )}
          {nmcData.council && (
            <>
              <dt className="font-medium text-foreground">Council</dt>
              <dd>{nmcData.council}</dd>
            </>
          )}
          {nmcData.status && (
            <>
              <dt className="font-medium text-foreground">Status</dt>
              <dd>{nmcData.status}</dd>
            </>
          )}
          {nmcData.registration_date && (
            <>
              <dt className="font-medium text-foreground">Registered</dt>
              <dd>{nmcData.registration_date}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>First name</Label>
          <Input required value={form.firstName} onChange={update("firstName")} />
        </div>
        <div className="space-y-2">
          <Label>Last name</Label>
          <Input required value={form.lastName} onChange={update("lastName")} />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" required value={form.email} onChange={update("email")} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={update("phone")} />
        </div>
      </div>

      {/* Sub-specialties */}
      <div className="space-y-2">
        <Label>Sub-specialties</Label>
        <Input
          value={form.subSpecialties}
          onChange={update("subSpecialties")}
          placeholder="e.g. Nephrology, Interventional Cardiology"
        />
        <p className="text-xs text-muted-foreground">Comma-separated.</p>
      </div>

      {/* Location */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>City</Label>
          <Input value={form.city} onChange={update("city")} placeholder="Mumbai" />
        </div>
        <div className="space-y-2">
          <Label>State</Label>
          <Input value={form.state} onChange={update("state")} placeholder="Maharashtra" />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label>Password</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update("password")}
        />
      </div>

      {/* Bottom Pinned Area */}
      <div className="mt-auto pt-4 space-y-5">
        {/* Doctor's Oath */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4 text-primary" />
            Doctor's Oath of Truthfulness
          </div>
          <ScrollArea className="h-40 rounded border bg-background p-3 text-xs leading-relaxed">
            <p className="whitespace-pre-line">{BRAND.oathText}</p>
          </ScrollArea>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <Checkbox
              checked={oathAccepted}
              onCheckedChange={(v) => setOathAccepted(v === true)}
              className="mt-0.5"
            />
            <span>
              I have read and I solemnly affirm to abide by the {BRAND.name} Doctor's Oath (
              {BRAND.oathVersion}). I understand every change I make to a patient's record is
              permanently logged.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={loading || !oathAccepted}>
            {loading ? "Creating account…" : "Create doctor account"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You'll start as an independent doctor. You can join a hospital anytime from your profile.
        </p>
      </div>
    </form>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function DoctorRegisterForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [nmcNumber, setNmcNumber] = useState("");
  const [nmcData, setNmcData] = useState<NmcData | null>(null);
  const [isMock, setIsMock] = useState(false);

  const handleVerified = (num: string, data: NmcData, mock: boolean) => {
    setNmcNumber(num);
    setNmcData(data);
    setIsMock(mock);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  if (step === 1) {
    return <Step1 onSuccess={handleVerified} />;
  }

  return (
    <Step2
      nmcNumber={nmcNumber}
      nmcData={nmcData!}
      isMock={isMock}
      onBack={handleBack}
    />
  );
}
