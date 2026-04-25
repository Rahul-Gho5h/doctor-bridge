/**
 * PlatformReports — /platform/reports
 *
 * Management reports and exportable data for Doctor Bridge team.
 * Filterable by date range, institution, and referral status.
 * Each report card shows a live row count and a modal preview (first 10 rows).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Calendar, Download, FileBarChart,
  RefreshCw, Stethoscope, Send, CheckCircle2, Filter,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// CSV helper
// ---------------------------------------------------------------------------

function downloadCSV(filename: string, rows: object[]) {
  if (rows.length === 0) { toast.error("No data to export"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = (row as any)[h];
        const s = val == null ? "" : String(val);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Institution { id: string; name: string; }

interface ReportFilters {
  fromDate: string;
  toDate: string;
  institutionId: string;  // "all" or UUID
  statuses: string[];
}

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tag: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function defaultFilters(): ReportFilters {
  const to = new Date();
  const from = new Date(to); from.setDate(from.getDate() - 30);
  return { fromDate: isoDate(from), toDate: isoDate(to), institutionId: "all", statuses: ALL_STATUSES };
}

const ALL_STATUSES = ["SENT", "PENDING", "VIEWED", "ACKNOWLEDGED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED"];

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

const REPORTS: ReportDef[] = [
  {
    id: "institutions",
    title: "All Institutions",
    description: "Hospitals, clinics, diagnostic centres — verification status, plan, registration details.",
    icon: <Building2 className="h-5 w-5 text-blue-600" />,
    tag: "Institutions",
  },
  {
    id: "doctors",
    title: "All Doctors",
    description: "Complete doctor list with specialties, NMC status, institution, and referral counts.",
    icon: <Stethoscope className="h-5 w-5 text-purple-600" />,
    tag: "Doctors",
  },
  {
    id: "referrals",
    title: "Referral Activity",
    description: "All referrals — status, urgency, diagnosis, institution, timestamps.",
    icon: <Send className="h-5 w-5 text-green-600" />,
    tag: "Referrals",
  },
  {
    id: "pending_approvals",
    title: "Pending Approvals",
    description: "Institutions awaiting platform approval — registration details, submitted date.",
    icon: <Calendar className="h-5 w-5 text-amber-600" />,
    tag: "Approvals",
  },
  {
    id: "verified_doctors",
    title: "Verified Doctors",
    description: "NMC-verified doctors — name, specialisation, institution, verified date.",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    tag: "Doctors",
  },
  {
    id: "monthly_summary",
    title: "Monthly Summary",
    description: "Month-by-month counts of new institutions, doctors, and referrals (last 12 months).",
    icon: <FileBarChart className="h-5 w-5 text-primary" />,
    tag: "Summary",
  },
  {
    id: "referral_funnel",
    title: "Referral Funnel",
    description: "Referral-level detail — number, status, urgency, diagnosis, institution, days to completion.",
    icon: <Send className="h-5 w-5 text-indigo-600" />,
    tag: "Referrals",
  },
  {
    id: "institution_performance",
    title: "Institution Performance",
    description: "Per-institution breakdown — active doctors, referrals sent, platform ID, city.",
    icon: <Building2 className="h-5 w-5 text-teal-600" />,
    tag: "Institutions",
  },
  {
    id: "inactive_doctors",
    title: "Inactive Doctors",
    description: "Doctors with accepting_referrals = false or is_public = false — for follow-up.",
    icon: <Stethoscope className="h-5 w-5 text-rose-600" />,
    tag: "Doctors",
  },
];

// ---------------------------------------------------------------------------
// Download handlers
// ---------------------------------------------------------------------------

async function downloadInstitutions(filters: ReportFilters) {
  const ts = isoDate(new Date());
  let q = supabase.from("clinics")
    .select("name,entity_type,city,state,email,phone,gst_number,registration_number,license_number,verification_status,platform_id,plan,created_at")
    .gte("created_at", filters.fromDate + "T00:00:00")
    .lte("created_at", filters.toDate + "T23:59:59")
    .order("created_at", { ascending: false });
  if (filters.institutionId !== "all") q = (q as any).eq("id", filters.institutionId);
  const { data, error } = await q;
  if (error) throw error;
  downloadCSV(`institutions-${ts}.csv`, data ?? []);
}

async function downloadDoctors(filters: ReportFilters) {
  const ts = isoDate(new Date());
  let q = supabase.from("doctor_profiles")
    .select("user_id,sub_specialties,qualifications,nmc_number,nmc_verified,nmc_verified_at,accepting_referrals,is_public,total_referrals_received,created_at")
    .gte("created_at", filters.fromDate + "T00:00:00")
    .lte("created_at", filters.toDate + "T23:59:59")
    .order("created_at", { ascending: false });
  const { data: dp, error } = await q;
  if (error) throw error;

  const userIds = (dp ?? []).map((r) => r.user_id);
  const [{ data: profs }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id,first_name,last_name,email,phone,specialization").in("id", userIds),
    supabase.from("hospital_doctor_links").select("doctor_user_id,clinics(name)").in("doctor_user_id", userIds).eq("status", "ACTIVE"),
  ]);

  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
  const linkMap = new Map((links ?? []).map((l) => [l.doctor_user_id, (l as any).clinics?.name ?? "Independent"]));

  const rows = (dp ?? []).map((d) => {
    const p = profMap.get(d.user_id);
    return {
      first_name: p?.first_name ?? "—", last_name: p?.last_name ?? "",
      email: p?.email ?? "—", phone: p?.phone ?? "—",
      specialization: (p as any)?.specialization ?? "—",
      sub_specialties: Array.isArray(d.sub_specialties) ? d.sub_specialties.join("; ") : "—",
      qualifications:  Array.isArray(d.qualifications)  ? d.qualifications.join("; ")  : "—",
      nmc_number: d.nmc_number ?? "—", nmc_verified: d.nmc_verified ? "Yes" : "No",
      nmc_verified_at: d.nmc_verified_at ?? "—",
      institution: linkMap.get(d.user_id) ?? "Independent",
      is_public: d.is_public ? "Yes" : "No",
      accepting_referrals: d.accepting_referrals ? "Yes" : "No",
      total_referrals_received: d.total_referrals_received ?? 0,
      joined_at: d.created_at,
    };
  });
  downloadCSV(`doctors-${ts}.csv`, rows);
}

async function downloadReferrals(filters: ReportFilters) {
  const ts = isoDate(new Date());
  let q = supabase.from("referrals")
    .select("referral_number,status,urgency,primary_diagnosis,reason,created_at,sent_at,completed_at,outcome,originating_clinic_id,clinics(name)")
    .gte("created_at", filters.fromDate + "T00:00:00")
    .lte("created_at", filters.toDate + "T23:59:59")
    .order("created_at", { ascending: false });
  if (filters.institutionId !== "all") q = (q as any).eq("originating_clinic_id", filters.institutionId);
  if (filters.statuses.length > 0 && filters.statuses.length < ALL_STATUSES.length)
    q = (q as any).in("status", filters.statuses);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    referral_number: r.referral_number ?? r.id, status: r.status, urgency: r.urgency,
    primary_diagnosis: r.primary_diagnosis ?? "—", reason: r.reason ?? "—",
    institution: r.clinics?.name ?? "—", created_at: r.created_at,
    sent_at: r.sent_at ?? "—", completed_at: r.completed_at ?? "—", outcome: r.outcome ?? "—",
  }));
  downloadCSV(`referrals-${ts}.csv`, rows);
}

async function downloadPendingApprovals() {
  const ts = isoDate(new Date());
  const { data, error } = await supabase.from("clinics")
    .select("name,entity_type,email,phone,city,state,gst_number,registration_number,license_number,created_at")
    .eq("verification_status", "PENDING").order("created_at", { ascending: false });
  if (error) throw error;
  downloadCSV(`pending-approvals-${ts}.csv`, data ?? []);
}

async function downloadVerifiedDoctors(filters: ReportFilters) {
  const ts = isoDate(new Date());
  const { data: dp, error } = await supabase.from("doctor_profiles")
    .select("user_id,sub_specialties,qualifications,nmc_number,nmc_verified_at,created_at")
    .eq("nmc_verified", true)
    .gte("nmc_verified_at", filters.fromDate + "T00:00:00")
    .order("nmc_verified_at", { ascending: false });
  if (error) throw error;
  const userIds = (dp ?? []).map((r) => r.user_id);
  const [{ data: profs }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id,first_name,last_name,email,specialization").in("id", userIds),
    supabase.from("hospital_doctor_links").select("doctor_user_id,clinics(name)").in("doctor_user_id", userIds).eq("status", "ACTIVE"),
  ]);
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
  const linkMap = new Map((links ?? []).map((l) => [l.doctor_user_id, (l as any).clinics?.name ?? "Independent"]));
  const rows = (dp ?? []).map((d) => {
    const p = profMap.get(d.user_id);
    return {
      first_name: p?.first_name ?? "—", last_name: p?.last_name ?? "",
      email: p?.email ?? "—", specialization: (p as any)?.specialization ?? "—",
      sub_specialties: Array.isArray(d.sub_specialties) ? d.sub_specialties.join("; ") : "—",
      qualifications:  Array.isArray(d.qualifications)  ? d.qualifications.join("; ")  : "—",
      nmc_number: d.nmc_number ?? "—", nmc_verified_at: d.nmc_verified_at ?? "—",
      institution: linkMap.get(d.user_id) ?? "Independent",
    };
  });
  downloadCSV(`verified-doctors-${ts}.csv`, rows);
}

async function downloadMonthlySummary() {
  const ts = isoDate(new Date()); const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7));
  const since = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
  const [{ data: cr }, { data: dr }, { data: rr }] = await Promise.all([
    supabase.from("clinics").select("created_at").gte("created_at", since),
    supabase.from("doctor_profiles").select("created_at").gte("created_at", since),
    supabase.from("referrals").select("created_at").gte("created_at", since),
  ]);
  const count = (rows: any[] | null) => {
    const m = new Map(months.map((k) => [k, 0]));
    (rows ?? []).forEach((r) => { const k = r.created_at.slice(0, 7); if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1); });
    return m;
  };
  const cM = count(cr ?? []); const dM = count(dr ?? []); const rM = count(rr ?? []);
  downloadCSV(`monthly-summary-${ts}.csv`, months.map((m) => ({ month: m, new_institutions: cM.get(m) ?? 0, new_doctors: dM.get(m) ?? 0, total_referrals: rM.get(m) ?? 0 })));
}

async function downloadReferralFunnel(filters: ReportFilters) {
  const ts = isoDate(new Date());
  let q = supabase.from("referrals")
    .select("referral_number,status,urgency,primary_diagnosis,created_at,sent_at,completed_at,originating_clinic_id,clinics(name)")
    .gte("created_at", filters.fromDate + "T00:00:00")
    .lte("created_at", filters.toDate + "T23:59:59")
    .order("created_at", { ascending: false });
  if (filters.institutionId !== "all") q = (q as any).eq("originating_clinic_id", filters.institutionId);
  if (filters.statuses.length > 0 && filters.statuses.length < ALL_STATUSES.length)
    q = (q as any).in("status", filters.statuses);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    referral_number: r.referral_number ?? r.id, status: r.status, urgency: r.urgency,
    primary_diagnosis: r.primary_diagnosis ?? "—",
    institution_name: r.clinics?.name ?? "—", created_at: r.created_at,
    days_to_completion: r.sent_at && r.completed_at
      ? Math.round((new Date(r.completed_at).getTime() - new Date(r.sent_at).getTime()) / 86_400_000)
      : "—",
  }));
  downloadCSV(`referral-funnel-${ts}.csv`, rows);
}

async function downloadInstitutionPerformance(filters: ReportFilters) {
  const ts = isoDate(new Date());
  let q = supabase.from("clinics").select("id,name,platform_id,city,state,verification_status")
    .eq("verification_status", "ACTIVE");
  if (filters.institutionId !== "all") q = (q as any).eq("id", filters.institutionId);
  const { data: clinics, error } = await q;
  if (error) throw error;
  const ids = (clinics ?? []).map((c) => c.id);
  const [{ data: links }, { data: refs }] = await Promise.all([
    supabase.from("hospital_doctor_links").select("hospital_clinic_id").in("hospital_clinic_id", ids).eq("status", "ACTIVE"),
    supabase.from("referrals").select("originating_clinic_id")
      .in("originating_clinic_id", ids)
      .gte("created_at", filters.fromDate + "T00:00:00")
      .lte("created_at", filters.toDate + "T23:59:59"),
  ]);
  const docCount = new Map<string, number>();
  (links ?? []).forEach((l) => docCount.set(l.hospital_clinic_id, (docCount.get(l.hospital_clinic_id) ?? 0) + 1));
  const refCount = new Map<string, number>();
  (refs ?? []).forEach((r) => refCount.set(r.originating_clinic_id, (refCount.get(r.originating_clinic_id) ?? 0) + 1));
  const rows = (clinics ?? []).map((c) => ({
    institution_name: c.name, platform_id: c.platform_id ?? "—",
    city: c.city ?? "—", state: c.state ?? "—",
    active_doctors: docCount.get(c.id) ?? 0,
    referrals_sent: refCount.get(c.id) ?? 0,
  }));
  downloadCSV(`institution-performance-${ts}.csv`, rows);
}

async function downloadInactiveDoctors() {
  const ts = isoDate(new Date());
  const { data: dp, error } = await supabase.from("doctor_profiles")
    .select("user_id,sub_specialties,nmc_number,nmc_verified,accepting_referrals,is_public,created_at")
    .or("accepting_referrals.eq.false,is_public.eq.false")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const userIds = (dp ?? []).map((r) => r.user_id);
  const [{ data: profs }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id,first_name,last_name,email,specialization").in("id", userIds),
    supabase.from("hospital_doctor_links").select("doctor_user_id,clinics(name)").in("doctor_user_id", userIds).eq("status", "ACTIVE"),
  ]);
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
  const linkMap = new Map((links ?? []).map((l) => [l.doctor_user_id, (l as any).clinics?.name ?? "Independent"]));
  const rows = (dp ?? []).map((d) => {
    const p = profMap.get(d.user_id);
    return {
      first_name: p?.first_name ?? "—", last_name: p?.last_name ?? "",
      email: p?.email ?? "—", specialization: (p as any)?.specialization ?? "—",
      nmc_number: d.nmc_number ?? "—", nmc_verified: d.nmc_verified ? "Yes" : "No",
      accepting_referrals: d.accepting_referrals ? "Yes" : "No",
      is_public: d.is_public ? "Yes" : "No",
      institution: linkMap.get(d.user_id) ?? "Independent",
      joined_at: d.created_at,
    };
  });
  downloadCSV(`inactive-doctors-${ts}.csv`, rows);
}

const HANDLERS: Record<string, (filters: ReportFilters) => Promise<void>> = {
  institutions:            downloadInstitutions,
  doctors:                 downloadDoctors,
  referrals:               downloadReferrals,
  pending_approvals:       () => downloadPendingApprovals(),
  verified_doctors:        downloadVerifiedDoctors,
  monthly_summary:         () => downloadMonthlySummary(),
  referral_funnel:         downloadReferralFunnel,
  institution_performance: downloadInstitutionPerformance,
  inactive_doctors:        () => downloadInactiveDoctors(),
};

// ---------------------------------------------------------------------------
// Preview fetchers (first 10 rows, minimal columns)
// ---------------------------------------------------------------------------

async function fetchPreview(reportId: string, filters: ReportFilters): Promise<object[]> {
  switch (reportId) {
    case "institutions":
    case "institution_performance": {
      let q = supabase.from("clinics").select("name,entity_type,city,state,verification_status,plan,created_at")
        .gte("created_at", filters.fromDate + "T00:00:00").lte("created_at", filters.toDate + "T23:59:59").limit(10);
      if (filters.institutionId !== "all") q = (q as any).eq("id", filters.institutionId);
      const { data } = await q; return data ?? [];
    }
    case "doctors":
    case "verified_doctors":
    case "inactive_doctors": {
      const { data: dp } = await supabase.from("doctor_profiles").select("user_id,nmc_verified,accepting_referrals,is_public,created_at").limit(10);
      const ids = (dp ?? []).map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,first_name,last_name,email").in("id", ids);
      const pm = new Map((profs ?? []).map((p) => [p.id, p]));
      return (dp ?? []).map((d) => ({ name: `${pm.get(d.user_id)?.first_name ?? "—"} ${pm.get(d.user_id)?.last_name ?? ""}`.trim(), email: pm.get(d.user_id)?.email ?? "—", nmc_verified: d.nmc_verified ? "Yes" : "No", accepting_referrals: d.accepting_referrals ? "Yes" : "No", joined: d.created_at?.slice(0, 10) }));
    }
    case "referrals":
    case "referral_funnel": {
      let q = supabase.from("referrals")
        .select("referral_number,status,urgency,primary_diagnosis,created_at,clinics(name)")
        .gte("created_at", filters.fromDate + "T00:00:00").lte("created_at", filters.toDate + "T23:59:59").limit(10);
      if (filters.institutionId !== "all") q = (q as any).eq("originating_clinic_id", filters.institutionId);
      if (filters.statuses.length > 0 && filters.statuses.length < ALL_STATUSES.length) q = (q as any).in("status", filters.statuses);
      const { data } = await q;
      return (data ?? []).map((r: any) => ({ number: r.referral_number ?? "—", status: r.status, urgency: r.urgency, diagnosis: r.primary_diagnosis ?? "—", institution: r.clinics?.name ?? "—", date: r.created_at?.slice(0, 10) }));
    }
    case "pending_approvals": {
      const { data } = await supabase.from("clinics").select("name,entity_type,city,state,created_at").eq("verification_status", "PENDING").limit(10);
      return data ?? [];
    }
    case "monthly_summary": {
      const now = new Date();
      return Array.from({ length: 10 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (9 - i), 1);
        return { month: d.toISOString().slice(0, 7), new_institutions: "—", new_doctors: "—", total_referrals: "—" };
      });
    }
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Activity feed types
// ---------------------------------------------------------------------------

interface ActivityEvent {
  type: "institution_registered" | "doctor_onboarded" | "institution_approved";
  label: string;
  sub: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PlatformReports() {
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [lastGenerated, setLastGenerated] = useState<Map<string, string>>(new Map());

  const [rowCounts, setRowCounts] = useState<Map<string, number>>(new Map());
  const [countsLoading, setCountsLoading] = useState(false);

  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    reportId: string;
    title: string;
    description: string;
    rows: Record<string, any>[];
    loading: boolean;
  } | null>(null);

  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityLimit, setActivityLimit] = useState(10);

  // Load institution list on mount
  useEffect(() => {
    supabase.from("clinics").select("id,name").eq("verification_status", "ACTIVE").order("name")
      .then(({ data }) => setInstitutions(data ?? []));
  }, []);

  // Fetch row counts whenever filters change
  const fetchRowCounts = useCallback(async (f: ReportFilters) => {
    setCountsLoading(true);
    try {
      const from = f.fromDate + "T00:00:00"; const to = f.toDate + "T23:59:59";
      const applyInst = (q: any) => f.institutionId !== "all" ? q.eq("originating_clinic_id", f.institutionId) : q;
      const applyStatus = (q: any) => (f.statuses.length > 0 && f.statuses.length < ALL_STATUSES.length) ? q.in("status", f.statuses) : q;

      const [
        { count: instCount },
        { count: docCount },
        { count: refCount },
        { count: pendingCount },
        { count: verifiedCount },
        { count: inactiveCount },
        { count: funnelCount },
      ] = await Promise.all([
        supabase.from("clinics").select("*", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to),
        supabase.from("doctor_profiles").select("*", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to),
        applyStatus(applyInst(supabase.from("referrals").select("*", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to))),
        supabase.from("clinics").select("*", { count: "exact", head: true }).eq("verification_status", "PENDING"),
        supabase.from("doctor_profiles").select("*", { count: "exact", head: true }).eq("nmc_verified", true),
        supabase.from("doctor_profiles").select("*", { count: "exact", head: true }).or("accepting_referrals.eq.false,is_public.eq.false"),
        applyStatus(applyInst(supabase.from("referrals").select("*", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to))),
      ]);

      setRowCounts(new Map([
        ["institutions", instCount ?? 0],
        ["doctors", docCount ?? 0],
        ["referrals", refCount ?? 0],
        ["pending_approvals", pendingCount ?? 0],
        ["verified_doctors", verifiedCount ?? 0],
        ["monthly_summary", 12],
        ["referral_funnel", funnelCount ?? 0],
        ["institution_performance", instCount ?? 0],
        ["inactive_doctors", inactiveCount ?? 0],
      ]));
    } catch { /* non-critical */ }
    finally { setCountsLoading(false); }
  }, []);

  useEffect(() => { fetchRowCounts(filters); }, [filters, fetchRowCounts]);

  const loadActivity = useCallback(async (limit: number) => {
    setActivityLoading(true);
    try {
      const [{ data: clinics }, { data: doctors }] = await Promise.all([
        supabase.from("clinics").select("name,verification_status,created_at").order("created_at", { ascending: false }).limit(limit),
        supabase.from("doctor_profiles").select("user_id,created_at,profiles(first_name,last_name)").order("created_at", { ascending: false }).limit(limit),
      ]);
      const events: ActivityEvent[] = [];
      (clinics ?? []).forEach((c) => events.push({
        type: c.verification_status === "ACTIVE" ? "institution_approved" : "institution_registered",
        label: c.name, sub: c.verification_status === "ACTIVE" ? "Institution activated" : "Awaiting approval", date: c.created_at,
      }));
      (doctors ?? []).forEach((d) => {
        const p = (d as any).profiles;
        events.push({ type: "doctor_onboarded", label: p ? `Dr. ${p.first_name} ${p.last_name}` : "Doctor", sub: "Doctor onboarded", date: d.created_at });
      });
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivity(events.slice(0, limit));
    } catch { /* non-critical */ }
    finally { setActivityLoading(false); }
  }, []);

  useEffect(() => { loadActivity(activityLimit); }, [activityLimit, loadActivity]);

  const handleDownload = async (reportId: string) => {
    setDownloading((prev) => new Set(prev).add(reportId));
    try {
      await HANDLERS[reportId](filters);
      setLastGenerated((prev) => new Map(prev).set(reportId, new Date().toISOString()));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate report");
    } finally {
      setDownloading((prev) => { const n = new Set(prev); n.delete(reportId); return n; });
    }
  };

  const openPreview = async (report: ReportDef) => {
    setPreviewModal({ open: true, reportId: report.id, title: report.title, description: report.description, rows: [], loading: true });
    try {
      const rows = await fetchPreview(report.id, filters);
      setPreviewModal((prev) => prev ? { ...prev, rows: rows as Record<string, any>[], loading: false } : prev);
    } catch {
      setPreviewModal((prev) => prev ? { ...prev, rows: [], loading: false } : prev);
    }
  };

  const isDownloading = (id: string) => downloading.has(id);

  return (
    <DashboardLayout>
      <PageHeader title="Reports" subtitle="Download and share platform data with management" />

      {/* Filter bar */}
      <div className="mb-6 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters — apply to all reports
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">From date</Label>
            <Input type="date" className="h-8 text-xs" value={filters.fromDate}
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To date</Label>
            <Input type="date" className="h-8 text-xs" value={filters.toDate}
              onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Institution</Label>
            <Select value={filters.institutionId} onValueChange={(v) => setFilters((f) => ({ ...f, institutionId: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All institutions</SelectItem>
                {institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Referral statuses</Label>
            <div className="flex flex-wrap gap-1">
              {["SENT", "ACCEPTED", "COMPLETED", "REJECTED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilters((f) => ({
                    ...f,
                    statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s],
                  }))}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                    filters.statuses.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {REPORTS.map((r) => {
          const count = rowCounts.get(r.id);
          return (
            <div key={r.id} className="rounded-xl border bg-card shadow-card flex flex-col">
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">{r.icon}</div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">{r.tag}</Badge>
                    {count !== undefined && (
                      <span className="text-[10px] text-muted-foreground">
                        {countsLoading ? "…" : `~${count.toLocaleString()} rows`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
                {lastGenerated.has(r.id) && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Last downloaded {fmtTime(lastGenerated.get(r.id) ?? null)}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5"
                    disabled={isDownloading(r.id)} onClick={() => handleDownload(r.id)}>
                    {isDownloading(r.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {isDownloading(r.id) ? "Generating…" : "Download CSV"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs px-3" onClick={() => openPreview(r)}>
                    Preview
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      <Dialog open={previewModal?.open ?? false} onOpenChange={(open) => { if (!open) setPreviewModal(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewModal?.title}</DialogTitle>
            <DialogDescription>{previewModal?.description}</DialogDescription>
          </DialogHeader>

          {/* Filter summary */}
          <p className="text-xs text-muted-foreground -mt-1">
            Filters: {filters.fromDate} → {filters.toDate}
            {filters.institutionId !== "all" && ` · ${institutions.find((i) => i.id === filters.institutionId)?.name ?? "Selected institution"}`}
            {filters.statuses.length < ALL_STATUSES.length && ` · Statuses: ${filters.statuses.join(", ")}`}
          </p>

          {/* Table area */}
          {previewModal?.loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="text-sm">Loading preview…</span>
              </div>
            </div>
          ) : (previewModal?.rows.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data matching current filters.</p>
          ) : (() => {
            const headers = Object.keys(previewModal!.rows[0]);
            return (
              <div className="overflow-x-auto rounded-md border">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-b">
                            {h.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewModal!.rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-muted-foreground max-w-[160px] truncate whitespace-nowrap">
                              {String(row[h] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-muted-foreground">
              {previewModal?.loading
                ? "Loading…"
                : `Showing first ${previewModal?.rows.length ?? 0} rows — ~${(rowCounts.get(previewModal?.reportId ?? "") ?? 0).toLocaleString()} total`}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5"
                disabled={!previewModal?.reportId || isDownloading(previewModal.reportId)}
                onClick={() => previewModal && handleDownload(previewModal.reportId)}>
                {previewModal?.reportId && isDownloading(previewModal.reportId)
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                Download full CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreviewModal(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent platform activity */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold">Recent platform activity</p>
          <Button variant="ghost" size="sm" onClick={() => loadActivity(activityLimit)} disabled={activityLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${activityLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {activityLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <>
            <ol className="space-y-3">
              {activity.map((ev, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    ev.type === "institution_approved"   ? "bg-green-100 text-green-600" :
                    ev.type === "institution_registered"  ? "bg-blue-100 text-blue-600"  :
                    "bg-purple-100 text-purple-600"
                  }`}>
                    {ev.type === "doctor_onboarded" ? <Stethoscope className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">{ev.sub} · {fmt(ev.date)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost" size="sm"
                onClick={() => setActivityLimit((l) => l + 10)}
                disabled={activityLoading}
                className="text-xs"
              >
                Load more
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
