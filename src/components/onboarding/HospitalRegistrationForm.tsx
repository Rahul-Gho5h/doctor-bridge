import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { value: "HOSPITAL",          label: "Hospital" },
  { value: "CLINIC",            label: "Clinic" },
  { value: "NURSING_HOME",      label: "Nursing Home" },
  { value: "DIAGNOSTIC_CENTER", label: "Diagnostic Center" },
] as const;

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const EQUIPMENT_OPTIONS = [
  "MRI",
  "CT Scan",
  "PET-CT",
  "X-Ray",
  "Ultrasound",
  "Cath Lab",
  "ICU",
  "NICU",
  "ECMO",
  "Robotic Surgery",
  "Dialysis Unit",
  "Operation Theatre",
  "Blood Bank",
  "Pharmacy",
  "Laboratory",
];

// ─── Zod schema ───────────────────────────────────────────────────────────────

const step1Fields = {
  name:                z.string().min(1, "Institution name is required"),
  entity_type:         z.enum(["HOSPITAL", "CLINIC", "NURSING_HOME", "DIAGNOSTIC_CENTER"], {
                         required_error: "Please select an entity type",
                       }),
  gst_number:          z
                         .string()
                         .min(1, "GST number is required")
                         .regex(/^[A-Z0-9]{15}$/i, "GST number must be exactly 15 alphanumeric characters"),
  registration_number: z.string().min(1, "Registration number is required"),
  city:                z.string().min(1, "City is required"),
  state:               z.string().min(1, "State is required"),
  address:             z.string().min(1, "Address is required"),
  phone:               z.string().min(10, "Enter a valid phone number"),
  email:               z.string().email("Enter a valid email address"),
};

const step2Fields = {
  equipment:     z.array(z.string()).default([]),
  working_hours: z.string().optional(),
  beds:          z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
};

const step3Fields = {
  first_name:      z.string().min(1, "First name is required"),
  last_name:       z.string().min(1, "Last name is required"),
  admin_email:     z.string().email("Enter a valid email address"),
  admin_phone:     z.string().min(10, "Enter a valid phone number"),
  password:        z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string().min(1, "Please confirm your password"),
};

// baseSchema drives the FormValues type (what RHF stores in its state).
// formSchema adds the cross-field refine used only for validation.
const baseSchema = z.object({ ...step1Fields, ...step2Fields, ...step3Fields });

const formSchema = baseSchema.refine(
  (d) => d.password === d.confirm_password,
  { message: "Passwords do not match", path: ["confirm_password"] }
);

// Use the base (pre-refine) type so RHF's generic parameters stay consistent.
type FormValues = z.infer<typeof baseSchema>;

// Fields validated on each step
const STEP_FIELDS: Array<Array<keyof FormValues>> = [
  ["name", "entity_type", "gst_number", "registration_number", "city", "state", "address", "phone", "email"],
  ["equipment", "working_hours", "beds"],
  ["first_name", "last_name", "admin_email", "admin_phone", "password", "confirm_password"],
];

// ─── Password strength helper ─────────────────────────────────────────────────

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8)                           s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw))    s++;
  if (/[0-9!@#$%^&*]/.test(pw))                 s++;
  const labels = ["", "Weak", "Fair", "Strong"] as const;
  return { score: s as 0 | 1 | 2 | 3, label: labels[s] };
}

const STRENGTH_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-border",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success-foreground",
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Institution", "Infrastructure", "Admin account"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-start justify-center">
      {STEP_LABELS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-start">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300",
                  done   ? "border-primary bg-primary text-primary-foreground"
                  : active ? "border-primary bg-background text-primary"
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
                  "mx-2 mt-3.5 h-0.5 w-10 shrink-0 transition-colors duration-300 sm:w-12",
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

// ─── Step 1 — Institution details ─────────────────────────────────────────────

function Step1({ form }: { form: UseFormReturn<FormValues> }) {
  return (
    <div className="space-y-4">
      {/* Name */}
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Institution name <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="e.g. Apollo Hospitals, City Health Clinic" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Entity type */}
      <FormField
        control={form.control}
        name="entity_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Entity type <span className="text-destructive">*</span>
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {ENTITY_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* GST + Registration */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="gst_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                GST number <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="uppercase"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormDescription>15-character GSTIN</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registration_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Registration no. <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="CEA / ROHINI / NHA no." {...field} />
              </FormControl>
              <FormDescription>Clinical Establishments Act</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* City + State */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                City <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Mumbai" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                State <span className="text-destructive">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-64">
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Address */}
      <FormField
        control={form.control}
        name="address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Address <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="Street, locality, area" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Phone + Email */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Phone <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+91 98765 43210" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Institution email <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input type="email" placeholder="info@hospital.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

// ─── Step 2 — Infrastructure ──────────────────────────────────────────────────

function Step2({ form }: { form: UseFormReturn<FormValues> }) {
  const selectedEquipment = form.watch("equipment") ?? [];

  const toggleEquipment = (item: string) => {
    const current = form.getValues("equipment") ?? [];
    const updated  = current.includes(item)
      ? current.filter((e) => e !== item)
      : [...current, item];
    form.setValue("equipment", updated, { shouldValidate: true });
  };

  return (
    <div className="space-y-5">
      {/* Equipment checklist */}
      <FormField
        control={form.control}
        name="equipment"
        render={() => (
          <FormItem>
            <FormLabel>Equipment available</FormLabel>
            <FormDescription>Select all that apply</FormDescription>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EQUIPMENT_OPTIONS.map((item) => {
                const checked = selectedEquipment.includes(item);
                return (
                  <label
                    key={item}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-all",
                      checked
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleEquipment(item)}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="leading-snug">{item}</span>
                  </label>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Working hours */}
      <FormField
        control={form.control}
        name="working_hours"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Working hours</FormLabel>
            <FormControl>
              <Input placeholder="e.g. Mon–Sat 8am–8pm, Sun 9am–2pm" {...field} />
            </FormControl>
            <FormDescription>Free text — you can update this later</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Number of beds */}
      <FormField
        control={form.control}
        name="beds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Number of beds <span className="text-muted-foreground">(optional)</span></FormLabel>
            <FormControl>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 120"
                className="w-40"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ─── Step 3 — Admin account ───────────────────────────────────────────────────

function Step3({ form }: { form: UseFormReturn<FormValues> }) {
  const [showPw, setShowPw]    = useState(false);
  const [showCpw, setShowCpw]  = useState(false);
  const password                = form.watch("password") ?? "";
  const strength                = passwordStrength(password);

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                First name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Rajan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Last name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Mehta" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Admin email + phone */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="admin_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Admin email <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="admin@hospital.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="admin_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Phone <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+91 98765 43210" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Password */}
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Password <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  className="pr-10"
                  {...field}
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
            </FormControl>
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-300",
                        i <= strength.score ? STRENGTH_COLORS[strength.score] : "bg-border"
                      )}
                    />
                  ))}
                </div>
                {strength.label && (
                  <p
                    className={cn(
                      "text-[11px] font-medium",
                      strength.score === 1 ? "text-destructive"
                      : strength.score === 2 ? "text-warning-foreground"
                      : "text-success-foreground"
                    )}
                  >
                    {strength.label}
                  </p>
                )}
              </div>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Confirm password */}
      <FormField
        control={form.control}
        name="confirm_password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Confirm password <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type={showCpw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  className="pr-10"
                  {...field}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCpw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Disclaimer */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        By registering, you confirm this institution is a registered medical
        establishment and all information provided is accurate. The platform team
        will verify your registration before full access is granted.
      </p>
    </div>
  );
}

// ─── Success state ─────────────────────────────────────────────────────────────

function SuccessBanner() {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500/40 bg-green-500/10">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-base font-semibold">Registration submitted</h3>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Our team will verify your institution within 24–48 hours. You will receive
          an email once your account is activated.
        </p>
      </div>
    </div>
  );
}

// ─── Root export ───────────────────────────────────────────────────────────────

export function HospitalRegistrationForm() {
  const router                = useRouter();
  const [step,    setStep]    = useState(0);           // 0 | 1 | 2
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver:      zodResolver(formSchema) as any,
    mode:          "onTouched",
    defaultValues: {
      name:                "",
      entity_type:         undefined,
      gst_number:          "",
      registration_number: "",
      city:                "",
      state:               "",
      address:             "",
      phone:               "",
      email:               "",
      equipment:           [],
      working_hours:       "",
      beds:                "",
      first_name:          "",
      last_name:           "",
      admin_email:         "",
      admin_phone:         "",
      password:            "",
      confirm_password:    "",
    },
  });

  // Validate only the current step's fields before advancing
  const handleNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step] as Array<keyof FormValues>);
    if (valid) setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-institution`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            institutionName:    values.name,
            entityType:         values.entity_type,
            gstNumber:          values.gst_number,
            registrationNumber: values.registration_number,
            city:               values.city,
            state:              values.state,
            address:            values.address,
            phone:              values.phone,
            institutionEmail:   values.email,
            equipment:          values.equipment,
            workingHours:       values.working_hours,
            firstName:          values.first_name,
            lastName:           values.last_name,
            adminEmail:         values.admin_email,
            adminPhone:         values.admin_phone,
            password:           values.password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Registration failed");
      }

      router.navigate({ to: "/onboarding/pending" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) return <SuccessBanner />;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
        {/* Step indicator */}
        <StepBar current={step} />

        {/* Step subtitle */}
        <div className="mb-5 flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of 3 — {STEP_LABELS[step]}
          </p>
        </div>

        {/* Step content */}
        <div className="min-h-0 flex-1">
          {step === 0 && <Step1 form={form} />}
          {step === 1 && <Step2 form={form} />}
          {step === 2 && <Step3 form={form} />}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          {step < 2 && (
            <Button type="button" className="flex-1" onClick={handleNext}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === 2 && (
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Submitting…" : "Submit registration"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
