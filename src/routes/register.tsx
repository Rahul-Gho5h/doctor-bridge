import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DoctorRegisterForm } from "@/components/auth/DoctorRegisterForm";
import { HospitalRegistrationForm } from "@/components/onboarding/HospitalRegistrationForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register — Doctor Bridge" }] }),
  component: RegisterPage,
});

/**
 * Fixed-height scroll container for the doctor tab.
 * Card remains exactly the same size across all steps.
 */
const DOCTOR_CONTENT_CLS = "flex h-[440px] flex-col";

/**
 * The hospital registration form is a 3-step form with substantially more
 * content. Allow it to scroll naturally within a capped height.
 */
const HOSPITAL_CONTENT_CLS = "max-h-[540px] overflow-y-auto pr-0.5";

/**
 * Shared animation applied to every tab panel on entry.
 * tab-content wrapper also gets a min-h so the card never collapses
 * to a different height when switching tabs, preventing layout shift.
 */
const TAB_CONTENT_CLS =
  "mt-4 min-h-[440px] data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-200";

function RegisterPage() {
  const [tab, setTab] = useState<"doctor" | "hospital">("doctor");

  return (
    <AuthShell
      heroTitle="Refer patients to the right specialist, fast."
      heroSubtitle="A verified network of NMC-registered doctors. Search by condition, check live availability, send a digital referral with full clinical context, and track outcomes."
    >
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Free for 14 days — no credit card required. Ready in minutes.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "doctor" | "hospital")} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="doctor">I'm a doctor</TabsTrigger>
          <TabsTrigger value="hospital">Hospital / Clinic</TabsTrigger>
        </TabsList>

        {/* ── Doctor tab — fixed height, no scroll ── */}
        <TabsContent value="doctor" className={TAB_CONTENT_CLS}>
          <div className={DOCTOR_CONTENT_CLS}>
            <DoctorRegisterForm />
          </div>
        </TabsContent>

        {/* ── Hospital / Clinic tab — scrollable, taller content ── */}
        <TabsContent value="hospital" className={TAB_CONTENT_CLS}>
          <div className={HOSPITAL_CONTENT_CLS}>
            <HospitalRegistrationForm />
          </div>
        </TabsContent>
      </Tabs>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
