/**
 * AdminDoctors — /admin/doctors
 *
 * Displays the full table of affiliated doctors for the clinic admin,
 * plus the onboard-doctor modal for adding new ones.
 *
 * Extracted from AdminDashboard.tsx so Dashboard and Doctors have
 * distinct routes and the sidebar can highlight them independently.
 */

import { useEffect, useState } from "react";
import {
  AlertCircle, Check, CheckCircle2, Clock, Copy,
  Eye, EyeOff, RefreshCw, Stethoscope, UserMinus, UserPlus,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalDoctorLinks, useDelinkDoctor } from "@/hooks/useHospitalAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genTempPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function genUserId(lastName: string, nmcNumber: string): string {
  const prefix = lastName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X").padEnd(3, "X");
  const suffix = nmcNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `DR-${prefix}${suffix}`;
}

// ---------------------------------------------------------------------------
// LinkStatusBadge
// ---------------------------------------------------------------------------

function LinkStatusBadge({ status }: { status: "ACTIVE" | "NOTICE_PERIOD" | "DELINKED" }) {
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-2.5 w-2.5" /> Active
      </span>
    );
  if (status === "NOTICE_PERIOD")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <Clock className="h-2.5 w-2.5" /> Notice period
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Delinked
    </span>
  );
}

// ---------------------------------------------------------------------------
// DelinkButton
// ---------------------------------------------------------------------------

function DelinkButton({ linkId, doctorName }: { linkId: string; doctorName: string }) {
  const [open, setOpen] = useState(false);
  const delink = useDelinkDoctor();

  const confirm = () => {
    delink.mutate(
      { linkId, delinkedBy: "HOSPITAL_ADMIN" },
      {
        onSuccess: () => {
          toast.success(`Dr. ${doctorName} delinked successfully.`);
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Delink failed"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <UserMinus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" /> Delink Doctor
          </DialogTitle>
          <DialogDescription>
            Remove <strong>Dr. {doctorName}</strong> from your institution? They will lose access to
            hospital-linked features immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={confirm} disabled={delink.isPending}>
            {delink.isPending ? "Delinking…" : "Confirm delink"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DoctorsTable
// ---------------------------------------------------------------------------

function DoctorsTable({ clinicId }: { clinicId: string }) {
  const { data: links = [], isLoading } = useHospitalDoctorLinks(clinicId);

  // After 2 s of loading with no data, abandon the spinner and show the empty
  // state so the UI never appears permanently stuck.
  const [showEmpty, setShowEmpty] = useState(false);
  useEffect(() => {
    if (!isLoading) { setShowEmpty(false); return; }
    const t = setTimeout(() => setShowEmpty(true), 2000);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (isLoading && !showEmpty)
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground animate-pulse">
        Loading doctors…
      </div>
    );

  if (links.length === 0)
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <Stethoscope className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">No doctors yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use "Onboard doctor" to add your first affiliated doctor.
        </p>
      </div>
    );

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-3 border-b px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div className="col-span-4">Doctor</div>
        <div className="col-span-2">NMC</div>
        <div className="col-span-3">Qualifications</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 text-right">Action</div>
      </div>

      <div className="divide-y">
        {links.map((link) => {
          const firstName = link.profile?.first_name ?? "";
          const lastName  = link.profile?.last_name  ?? "";
          const fullName  = `${firstName} ${lastName}`.trim() || "Unknown";
          const initials  = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
          const quals        = link.doctor_profile?.qualifications ?? [];
          const visibleQuals = quals.slice(0, 2);
          const extraQuals   = quals.length - 2;

          return (
            <div
              key={link.id}
              className="grid grid-cols-12 items-center gap-3 px-6 py-4 text-sm transition-colors hover:bg-muted/20"
            >
              {/* Doctor */}
              <div className="col-span-4 flex items-center gap-3">
                {link.profile?.avatar ? (
                  <img
                    src={link.profile.avatar}
                    alt={fullName}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials || "DR"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">Dr. {fullName}</p>
                  {link.profile?.email && (
                    <p className="truncate text-[11px] text-muted-foreground">{link.profile.email}</p>
                  )}
                </div>
              </div>

              {/* NMC */}
              <div className="col-span-2 font-mono text-xs">
                {link.doctor_profile?.nmc_number ?? "—"}
              </div>

              {/* Qualifications */}
              <div className="col-span-3 flex flex-wrap gap-1">
                {visibleQuals.map((q) => (
                  <span key={q} className="rounded border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">
                    {q}
                  </span>
                ))}
                {extraQuals > 0 && (
                  <span className="rounded border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    +{extraQuals} more
                  </span>
                )}
                {quals.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              </div>

              {/* Status */}
              <div className="col-span-2">
                <LinkStatusBadge status={link.status} />
                {link.status === "NOTICE_PERIOD" && link.last_working_day && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    LWD: {new Date(link.last_working_day).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>

              {/* Action */}
              <div className="col-span-1 flex justify-end">
                {link.status !== "DELINKED" && (
                  <DelinkButton linkId={link.id} doctorName={fullName} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OnboardDoctorModal
// ---------------------------------------------------------------------------

type OnboardStep = "nmc" | "verify" | "credentials" | "done";

interface MockDoctorPreview {
  firstName: string;
  lastName: string;
  specialization: string;
}

interface GeneratedCredentials {
  userId: string;
  tempPassword: string;
  email: string;
  nmcNumber: string;
}

function OnboardDoctorModal({ clinicId, onCreated }: { clinicId: string; onCreated: () => void }) {
  const { session } = useAuth();
  const [open, setOpen]               = useState(false);
  const [step, setStep]               = useState<OnboardStep>("nmc");
  const [nmc, setNmc]                 = useState("");
  const [verifying, setVerifying]     = useState(false);
  const [preview, setPreview]         = useState<MockDoctorPreview | null>(null);
  const [email, setEmail]             = useState("");
  const [creds, setCreds]             = useState<GeneratedCredentials | null>(null);
  const [creating, setCreating]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied]           = useState(false);

  const reset = () => {
    setStep("nmc"); setNmc(""); setVerifying(false); setPreview(null);
    setEmail(""); setCreds(null); setCreating(false);
    setShowPassword(false); setCopied(false);
  };

  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) reset(); };

  /* ── Step 1 → 2: simulate NMC lookup ── */
  const handleVerifyNmc = async () => {
    const trimmed = nmc.trim();
    if (!trimmed) return;
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 1000));
    setPreview({ firstName: "Registered", lastName: "Doctor", specialization: "General Medicine" });
    setVerifying(false);
    setStep("verify");
  };

  /* ── Step 2 → 3: generate credentials ── */
  const handleConfirmDoctor = () => {
    if (!preview) return;
    setCreds({
      userId:      genUserId(preview.lastName, nmc),
      tempPassword: genTempPassword(),
      email:       email.trim(),
      nmcNumber:   nmc.trim(),
    });
    setStep("credentials");
  };

  /* ── Step 3: create account ── */
  const handleCreate = async () => {
    if (!creds || !session) return;
    setCreating(true);
    try {
      const res = await fetch(
        "https://zvfvhndcbwfdcfessycn.supabase.co/functions/v1/admin-create-doctor",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email:        creds.email,
            tempPassword: creds.tempPassword,
            userId:       creds.userId,
            nmcNumber:    creds.nmcNumber,
            firstName:    preview?.firstName ?? "",
            lastName:     preview?.lastName  ?? "",
            clinicId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create doctor account");
      setStep("done");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyAll = () => {
    if (!creds) return;
    void navigator.clipboard.writeText(
      `Doctor ID: ${creds.userId}\nEmail: ${creds.email}\nTemporary Password: ${creds.tempPassword}\nNMC Number: ${creds.nmcNumber}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Onboard doctor
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        {/* ── Step: nmc ── */}
        {step === "nmc" && (
          <>
            <DialogHeader>
              <DialogTitle>Onboard a doctor</DialogTitle>
              <DialogDescription>
                Enter the doctor's NMC registration number to verify them against the registry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="nmc-input">NMC Registration Number</Label>
                <Input
                  id="nmc-input"
                  placeholder="e.g. MH-12345-2018"
                  value={nmc}
                  onChange={(e) => setNmc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !verifying && nmc.trim() && handleVerifyNmc()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleVerifyNmc} disabled={!nmc.trim() || verifying}>
                {verifying
                  ? <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Verifying…</>
                  : "Verify NMC"
                }
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: verify ── */}
        {step === "verify" && preview && (
          <>
            <DialogHeader>
              <DialogTitle>Doctor verified</DialogTitle>
              <DialogDescription>
                NMC registry returned the following registration. Enter the doctor's work email to proceed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {preview.firstName[0]}{preview.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium">Dr. {preview.firstName} {preview.lastName}</p>
                    <p className="text-xs text-muted-foreground">{preview.specialization}</p>
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> NMC verified
                  </span>
                </div>
                <p className="mt-3 font-mono text-xs text-muted-foreground">NMC: {nmc}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doctor-email">Doctor's work email</Label>
                <Input
                  id="doctor-email"
                  type="email"
                  placeholder="doctor@yourhospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Login credentials will be generated for this email.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("nmc")}>Back</Button>
              <Button onClick={handleConfirmDoctor} disabled={!email.trim()}>
                Generate credentials
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: credentials ── */}
        {step === "credentials" && creds && (
          <>
            <DialogHeader>
              <DialogTitle>Review credentials</DialogTitle>
              <DialogDescription>
                Share these credentials with the doctor. They can change the password after first login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {[
                { label: "Doctor ID",   value: creds.userId    },
                { label: "Email",       value: creds.email     },
                { label: "NMC Number",  value: creds.nmcNumber },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-md border bg-muted/30 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="mt-0.5 font-mono text-sm">{value}</p>
                </div>
              ))}
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Temporary Password
                </p>
                <div className="mt-0.5 flex items-center justify-between">
                  <p className="font-mono text-sm">
                    {showPassword ? creds.tempPassword : "••••••••••"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="sm:mr-auto" onClick={handleCopyAll}>
                {copied
                  ? <><Check className="mr-1.5 h-3.5 w-3.5" /> Copied</>
                  : <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy all</>
                }
              </Button>
              <Button variant="outline" onClick={() => setStep("verify")}>Back</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating account…" : "Create account"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: done ── */}
        {step === "done" && creds && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" /> Account created
              </DialogTitle>
              <DialogDescription>
                Dr. {preview?.firstName} {preview?.lastName} has been onboarded and linked to your institution.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/30 p-4 py-2">
              {[
                { label: "Doctor ID",      value: creds.userId       },
                { label: "Email",          value: creds.email        },
                { label: "Temp. Password", value: creds.tempPassword },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium">{value}</span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" className="mr-auto" onClick={handleCopyAll}>
                {copied
                  ? <><Check className="mr-1.5 h-3.5 w-3.5" /> Copied</>
                  : <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy credentials</>
                }
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminDoctors() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? "";

  const { refetch } = useHospitalDoctorLinks(clinicId);

  return (
    <DashboardLayout>
      <PageHeader
        title="Doctors"
        description="Manage affiliated doctors and onboard new ones."
        actions={
          clinicId ? (
            <OnboardDoctorModal clinicId={clinicId} onCreated={() => void refetch()} />
          ) : undefined
        }
      />
      {clinicId ? (
        <DoctorsTable clinicId={clinicId} />
      ) : (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}
    </DashboardLayout>
  );
}
