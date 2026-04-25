import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FacilityType =
  | "clinic"
  | "hospital"
  | "polyclinic"
  | "diagnostic"
  | "nursing_home";

interface FormState {
  // Step 1 — Facility
  facilityType: FacilityType | "";
  clinicName: string;
  registrationNumber: string;
  yearEstablished: string;
  // Step 2 — Location & Contact
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  website: string;
  // Step 3 — Admin account
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
}

const INITIAL: FormState = {
  facilityType: "",
  clinicName: "",
  registrationNumber: "",
  yearEstablished: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  phone: "",
  website: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  termsAccepted: false,
};

// ─── Facility type options ─────────────────────────────────────────────────────

const FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: "clinic",       label: "Clinic"           },
  { value: "hospital",     label: "Hospital"          },
  { value: "polyclinic",   label: "Polyclinic"        },
  { value: "diagnostic",   label: "Diagnostic Centre" },
  { value: "nursing_home", label: "Nursing Home"      },
];

// ─── Password strength ─────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9!@#$%^&*]/.test(pw)) s++;
  const labels = ["", "Weak", "Fair", "Strong"] as const;
  return { score: s as 0 | 1 | 2 | 3, label: labels[s] };
}

const strengthColors: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-border",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success-foreground",
};

// ─── Step bar ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Facility", "Location", "Your account"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-start justify-center">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-start">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                    ? "border-primary bg-background text-primary"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mt-3.5 h-0.5 w-10 shrink-0 transition-colors duration-300 sm:w-14",
                  i < current ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Facility details ──────────────────────────────────────────────────

function Step1({
  form,
  setForm,
  onNext,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onNext: () => void;
}) {
  const validate = () => {
    if (!form.facilityType) {
      toast.error("Please select a facility type");
      return false;
    }
    if (!form.clinicName.trim()) {
      toast.error("Facility name is required");
      return false;
    }
    return true;
  };

  return (
    <div className="flex h-full flex-col space-y-5">
      {/* Facility type */}
      <div className="space-y-1.5">
        <Label htmlFor="facility-type">
          Facility type <span className="text-destructive">*</span>
        </Label>
        <Select
          value={form.facilityType}
          onValueChange={(v) => setForm((p) => ({ ...p, facilityType: v as FacilityType }))}
        >
          <SelectTrigger id="facility-type">
            <SelectValue placeholder="Select facility type" />
          </SelectTrigger>
          <SelectContent>
            {FACILITY_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="clinic-name">
          Facility name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="clinic-name"
          required
          placeholder="e.g. Apollo Clinic, City General Hospital"
          value={form.clinicName}
          onChange={(e) => setForm((p) => ({ ...p, clinicName: e.target.value }))}
        />
      </div>

      {/* Optional fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="reg-number" className="text-muted-foreground">
            Reg. / Accreditation no.
          </Label>
          <Input
            id="reg-number"
            placeholder="CIN / ROHINI / NHA"
            value={form.registrationNumber}
            onChange={(e) =>
              setForm((p) => ({ ...p, registrationNumber: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year-est" className="text-muted-foreground">
            Year established
          </Label>
          <Input
            id="year-est"
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            placeholder="e.g. 2010"
            value={form.yearEstablished}
            onChange={(e) =>
              setForm((p) => ({ ...p, yearEstablished: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="mt-auto pt-4">
        <Button type="button" className="w-full" onClick={() => { if (validate()) onNext(); }}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Location & contact ────────────────────────────────────────────────

function Step2({
  form,
  setForm,
  onBack,
  onNext,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const validate = () => {
    if (!form.address.trim()) { toast.error("Address is required"); return false; }
    if (!form.city.trim())    { toast.error("City is required"); return false; }
    if (!form.state.trim())   { toast.error("State is required"); return false; }
    if (!form.phone.trim())   { toast.error("Phone number is required"); return false; }
    return true;
  };

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="address">
          Address <span className="text-destructive">*</span>
        </Label>
        <Input
          id="address"
          placeholder="Street / locality"
          value={form.address}
          onChange={upd("address")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">
            City <span className="text-destructive">*</span>
          </Label>
          <Input id="city" placeholder="Mumbai" value={form.city} onChange={upd("city")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">
            State <span className="text-destructive">*</span>
          </Label>
          <Input id="state" placeholder="Maharashtra" value={form.state} onChange={upd("state")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN code</Label>
          <Input
            id="pin"
            placeholder="400001"
            maxLength={6}
            value={form.pinCode}
            onChange={(e) =>
              setForm((p) => ({ ...p, pinCode: e.target.value.replace(/\D/g, "").slice(0, 6) }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={upd("phone")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website" className="text-muted-foreground">
          Website (optional)
        </Label>
        <Input
          id="website"
          type="url"
          placeholder="https://yourfacility.com"
          value={form.website}
          onChange={upd("website")}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" className="flex-1" onClick={() => { if (validate()) onNext(); }}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Admin account ─────────────────────────────────────────────────────

function Step3({
  form,
  setForm,
  onBack,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onBack: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const strength = passwordStrength(form.password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Full name is required"); return;
    }
    if (!form.email.trim()) { toast.error("Email is required"); return; }
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!form.termsAccepted) { toast.error("Please accept the terms to continue"); return; }

    setLoading(true);
    try {
      const payload = {
        clinicName:         form.clinicName,
        facilityType:       form.facilityType,
        registrationNumber: form.registrationNumber,
        yearEstablished:    form.yearEstablished,
        address:            form.address,
        city:               form.city,
        state:              form.state,
        pinCode:            form.pinCode,
        website:            form.website,
        firstName:          form.firstName,
        lastName:           form.lastName,
        email:              form.email,
        phone:              form.phone,
        password:           form.password,
      };
      const { data, error } = await supabase.functions.invoke("register-clinic", { body: payload });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

      toast.success("Account created! Please verify your email to continue.");
      router.navigate({ to: "/verify-email", search: { email: form.email } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Facility summary pill */}
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground">{form.clinicName}</span>
        <span className="ml-auto shrink-0 capitalize">
          {form.facilityType.replace("_", " ")}
        </span>
      </div>

      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="first-name">
            First name <span className="text-destructive">*</span>
          </Label>
          <Input id="first-name" required value={form.firstName} onChange={upd("firstName")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name">
            Last name <span className="text-destructive">*</span>
          </Label>
          <Input id="last-name" required value={form.lastName} onChange={upd("lastName")} />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-email">
          Work email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@yourfacility.com"
          value={form.email}
          onChange={upd("email")}
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="reg-password">
          Password <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="reg-password"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Minimum 8 characters"
            className="pr-10"
            value={form.password}
            onChange={upd("password")}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* Strength bar */}
        {form.password.length > 0 && (
          <div className="space-y-1 pt-0.5">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    i <= strength.score ? strengthColors[strength.score] : "bg-border"
                  )}
                />
              ))}
            </div>
            <p
              className={cn(
                "text-[11px] font-medium",
                strength.score === 1
                  ? "text-destructive"
                  : strength.score === 2
                  ? "text-warning-foreground"
                  : "text-success-foreground"
              )}
            >
              {strength.label}
            </p>
          </div>
        )}
      </div>

      {/* Terms */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{" "}
          <a href="#" className="font-medium text-primary hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="font-medium text-primary hover:underline">
            Privacy Policy
          </a>
          . Patient data processed through Doctor Bridge is handled in accordance
          with DPDP Act 2023 and applicable clinical data regulations.
        </p>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox
            id="terms"
            checked={form.termsAccepted}
            onCheckedChange={(v) => setForm((p) => ({ ...p, termsAccepted: v === true }))}
            className="mt-0.5"
          />
          <span>
            I accept the Terms of Service and confirm I am authorised to register
            this facility on behalf of my organisation.
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="mt-auto pt-4 flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={loading || !form.termsAccepted}
        >
          {loading ? "Creating account…" : "Create facility account"}
        </Button>
      </div>
    </form>
  );
}

// ─── Root export ───────────────────────────────────────────────────────────────

export function RegisterForm() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState<FormState>(INITIAL);

  return (
    <div className="flex h-full flex-col">
      <StepBar current={step} />

      {step === 0 && (
        <Step1 form={form} setForm={setForm} onNext={() => setStep(1)} />
      )}
      {step === 1 && (
        <Step2
          form={form}
          setForm={setForm}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step3 form={form} setForm={setForm} onBack={() => setStep(1)} />
      )}
    </div>
  );
}
