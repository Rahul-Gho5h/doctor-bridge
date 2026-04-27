/**
 * AdminAnalytics — /admin/analytics
 *
 * Clinic-level analytics for CLINIC_ADMIN users.
 *  Section 1 — 6 KPI cards
 *  Section 2 — Monthly referral volume bar chart (last 6 months)
 *  Section 3 — Doctor performance table + referral status donut
 */

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, UserCheck, TrendingUp, Activity, FileBarChart2, Stethoscope,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  "oklch(0.49 0.20 277)",
  "oklch(0.65 0.16 152)",
  "oklch(0.78 0.16 75)",
  "oklch(0.65 0.13 230)",
  "oklch(0.55 0.22 27)",
  "oklch(0.55 0.10 320)",
];

const STATUS_DISPLAY: Record<string, string> = {
  SENT:         "Sent",
  VIEWED:       "Viewed",
  ACKNOWLEDGED: "Acknowledged",
  ACCEPTED:     "Accepted",
  DECLINED:     "Declined",
  COMPLETED:    "Completed",
  CANCELLED:    "Cancelled",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthLabel(isoYearMonth: string) {
  return new Date(isoYearMonth + "-01").toLocaleString("en-IN", {
    month: "short", year: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPI({
  label, value, icon: Icon, loading,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${loading ? "animate-pulse text-muted" : ""}`}>
        {loading ? "—" : value}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ message = "Not enough data yet." }: { message?: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DoctorRow {
  doctorProfileId: string;
  userId: string;
  name: string;
  specialization: string | null;
  status: string;
  sentCount: number;
  receivedCount: number;
  acceptanceRate: number | null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminAnalytics() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id ?? "";

  const [loading, setLoading] = useState(true);

  // KPIs
  const [totalDoctors,    setTotalDoctors]    = useState(0);
  const [activeDoctors,   setActiveDoctors]   = useState(0);
  const [totalReferrals,  setTotalReferrals]  = useState(0);
  const [refsThisMonth,   setRefsThisMonth]   = useState(0);
  const [avgAcceptance,   setAvgAcceptance]   = useState<number | null>(null);
  const [uniquePatients,  setUniquePatients]  = useState(0);

  // Charts
  const [monthlyTrend,  setMonthlyTrend]  = useState<{ month: string; referrals: number }[]>([]);
  const [statusData,    setStatusData]    = useState<{ name: string; value: number }[]>([]);
  const [doctorRows,    setDoctorRows]    = useState<DoctorRow[]>([]);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // ── 1. Hospital doctor links ─────────────────────────────────────────
      const { data: links } = await supabase
        .from("hospital_doctor_links")
        .select("id,doctor_profile_id,doctor_user_id,status")
        .eq("hospital_clinic_id", clinicId)
        .in("status", ["ACTIVE", "NOTICE_PERIOD"]);

      if (cancelled) return;
      const linkList = (links ?? []) as {
        id: string;
        doctor_profile_id: string;
        doctor_user_id: string;
        status: string;
      }[];

      const dpIds  = linkList.map((l) => l.doctor_profile_id);
      const uIds   = linkList.map((l) => l.doctor_user_id);

      // ── 2. Institution referrals (sent from this clinic, last 6 months) ──
      const since = new Date();
      since.setMonth(since.getMonth() - 6);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const { data: rawRefs } = await supabase
        .from("referrals")
        .select("id,created_at,status,referring_doctor_id,accepted_at,sent_at")
        .eq("originating_clinic_id", clinicId)
        .gte("created_at", since.toISOString());

      if (cancelled) return;
      const allRefs = (rawRefs ?? []) as any[];

      // ── 3. Doctor profiles (acceptance rates, total received) ────────────
      const [{ data: rawDp }, { data: rawProf }] = await Promise.all([
        dpIds.length
          ? supabase
              .from("doctor_profiles")
              .select("id,referral_acceptance_rate,total_referrals_received")
              .in("id", dpIds)
          : Promise.resolve({ data: [] }),
        uIds.length
          ? supabase
              .from("profiles")
              .select("id,first_name,last_name,specialization")
              .in("id", uIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (cancelled) return;
      const dpList   = (rawDp   ?? []) as any[];
      const profList = (rawProf ?? []) as any[];

      // ── 4. Unique patients from encounters ───────────────────────────────
      const { data: rawEnc } = uIds.length
        ? await supabase
            .from("patient_encounters")
            .select("global_patient_id")
            .in("doctor_user_id", uIds)
        : { data: [] };

      if (cancelled) return;
      const encList = (rawEnc ?? []) as any[];

      // ── KPIs ──────────────────────────────────────────────────────────────
      setTotalDoctors(linkList.length);
      setActiveDoctors(linkList.filter((l) => l.status === "ACTIVE").length);
      setTotalReferrals(allRefs.length);

      const nowYM = new Date().toISOString().slice(0, 7);
      setRefsThisMonth(allRefs.filter((r) => r.created_at.slice(0, 7) === nowYM).length);

      const rates = dpList
        .map((d: any) => d.referral_acceptance_rate)
        .filter((r: any): r is number => typeof r === "number");
      setAvgAcceptance(
        rates.length > 0
          ? Math.round(rates.reduce((a: number, b: number) => a + b, 0) / rates.length)
          : null,
      );

      setUniquePatients(
        new Set(encList.map((e: any) => e.global_patient_id as string)).size,
      );

      // ── Monthly trend ─────────────────────────────────────────────────────
      const monthMap = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthMap.set(d.toISOString().slice(0, 7), 0);
      }
      allRefs.forEach((r: any) => {
        const k = (r.created_at as string).slice(0, 7);
        if (monthMap.has(k)) monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
      });
      setMonthlyTrend(
        Array.from(monthMap.entries()).map(([k, v]) => ({
          month: monthLabel(k), referrals: v,
        })),
      );

      // ── Status distribution ───────────────────────────────────────────────
      const statusMap = new Map<string, number>();
      allRefs.forEach((r: any) => {
        const s = r.status as string;
        statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
      });
      setStatusData(
        Array.from(statusMap.entries()).map(([raw, value]) => ({
          name:  STATUS_DISPLAY[raw] ?? raw,
          value,
        })),
      );

      // ── Doctor performance table ──────────────────────────────────────────
      const dpMap   = new Map(dpList.map((d: any) => [d.id as string, d]));
      const profMap = new Map(profList.map((p: any) => [p.id as string, p]));

      // Sent counts from institution referrals (this clinic's referrals)
      const sentMap = new Map<string, number>();
      allRefs.forEach((r: any) => {
        const pid = r.referring_doctor_id as string;
        if (pid) sentMap.set(pid, (sentMap.get(pid) ?? 0) + 1);
      });

      const rows: DoctorRow[] = linkList.map((link) => {
        const dp   = dpMap.get(link.doctor_profile_id) as any;
        const prof = profMap.get(link.doctor_user_id) as any;
        return {
          doctorProfileId: link.doctor_profile_id,
          userId:          link.doctor_user_id,
          name:            prof ? `Dr. ${prof.first_name} ${prof.last_name}` : "—",
          specialization:  prof?.specialization ?? null,
          status:          link.status,
          sentCount:       sentMap.get(link.doctor_profile_id) ?? 0,
          receivedCount:   dp?.total_referrals_received ?? 0,
          acceptanceRate:  dp?.referral_acceptance_rate ?? null,
        };
      });
      rows.sort((a, b) => b.sentCount - a.sentCount);
      setDoctorRows(rows);

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [clinicId]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Institution Analytics"
        description="Referral performance and doctor activity across your institution."
      />

      <div className="space-y-6">

        {/* ── Section 1 — KPI row ─────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KPI label="Total doctors"        value={totalDoctors}                            icon={Users}          loading={loading} />
          <KPI label="Active doctors"       value={activeDoctors}                           icon={UserCheck}      loading={loading} />
          <KPI label="Total referrals"      value={totalReferrals}                          icon={TrendingUp}     loading={loading} />
          <KPI label="Referrals this month" value={refsThisMonth}                           icon={Activity}       loading={loading} />
          <KPI label="Avg acceptance rate"  value={avgAcceptance !== null ? `${avgAcceptance}%` : "—"} icon={FileBarChart2} loading={loading} />
          <KPI label="Unique patients seen" value={uniquePatients}                          icon={Stethoscope}    loading={loading} />
        </div>

        {/* ── Section 2 — Monthly volume + status donut ───────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Monthly referral volume (last 6 months)">
            {loading || monthlyTrend.every((m) => m.referrals === 0) ? (
              <Empty message={loading ? "Loading…" : "No referrals yet."} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyTrend} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="referrals" name="Referrals" fill={COLORS[0]} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Referral status distribution">
            {loading || statusData.length === 0 ? (
              <Empty message={loading ? "Loading…" : "No referrals yet."} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* ── Section 3 — Doctor performance table ────────────────────────── */}
        <Card title="Doctor performance">
          {loading ? (
            <Empty message="Loading…" />
          ) : doctorRows.length === 0 ? (
            <Empty message="No affiliated doctors yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Doctor</th>
                    <th className="px-4 py-3 text-left">Specialty</th>
                    <th className="px-4 py-3 text-right">Sent</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Acceptance</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {doctorRows.map((d) => (
                    <tr key={d.doctorProfileId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.specialization ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.sentCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.receivedCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {d.acceptanceRate !== null ? `${d.acceptanceRate}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </DashboardLayout>
  );
}

// ── Inline status badge ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE")
    return (
      <Badge className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
        Active
      </Badge>
    );
  if (status === "NOTICE_PERIOD")
    return (
      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        Notice period
      </Badge>
    );
  return <Badge variant="outline">{status}</Badge>;
}
