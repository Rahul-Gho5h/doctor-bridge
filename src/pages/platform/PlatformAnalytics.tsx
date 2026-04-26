/**
 * PlatformAnalytics — /platform/analytics
 *
 * Platform-wide performance dashboard for Doctor Bridge team.
 * Filterable by date range and institution.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, Building2, Calendar,
  Clock, Download, MapPin, Network, RefreshCw,
  Send, Stethoscope, Target, TrendingUp, Users,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DateRange = "7d" | "30d" | "3m" | "6m" | "all";

interface Institution { id: string; name: string; }
interface ChartData   { label: string; value: number; }
interface RankedItem  { label: string; count: number; }
interface FunnelStage { label: string; count: number; pct: number; }

interface AnalyticsData {
  // Platform-wide totals (unfiltered)
  totalDoctors: number;
  totalInstitutions: number;
  pendingApprovals: number;
  activeInstitutions: number;
  verifiedDoctors: number;
  // Month-boundary deltas
  referralsThisMonth: number;
  referralsLastMonth: number;
  newDoctorsThisMonth: number;
  newDoctorsLastMonth: number;
  newInstitutionsThisMonth: number;
  newInstitutionsLastMonth: number;
  // Filtered totals
  totalReferrals: number;
  // Charts (date + institution filtered)
  referralsByPeriod: ChartData[];
  doctorsByPeriod: ChartData[];
  institutionsByPeriod: ChartData[];
  // Ranked lists
  referralsByStatus: RankedItem[];
  topHospitals: RankedItem[];
  topSpecialties: RankedItem[];
  // New metrics
  urgency: { routine: number; semiUrgent: number; urgent: number };
  funnelStages: FunnelStage[];
  avgHoursToCompletion: number | null;
  completionRate: number;
  avgDaysToResponse: number | null;
  networkDensity: number;
  topReferringCity: string | null;
}

const EMPTY: AnalyticsData = {
  totalDoctors: 0, totalInstitutions: 0, pendingApprovals: 0,
  activeInstitutions: 0, verifiedDoctors: 0,
  referralsThisMonth: 0, referralsLastMonth: 0,
  newDoctorsThisMonth: 0, newDoctorsLastMonth: 0,
  newInstitutionsThisMonth: 0, newInstitutionsLastMonth: 0,
  totalReferrals: 0,
  referralsByPeriod: [], doctorsByPeriod: [], institutionsByPeriod: [],
  referralsByStatus: [], topHospitals: [], topSpecialties: [],
  urgency: { routine: 0, semiUrgent: 0, urgent: 0 },
  funnelStages: [], avgHoursToCompletion: null,
  completionRate: 0, avgDaysToResponse: null,
  networkDensity: 0, topReferringCity: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStartDate(range: DateRange): string | null {
  const now = new Date();
  switch (range) {
    case "7d":  return new Date(now.getTime() - 7 * 86_400_000).toISOString();
    case "30d": return new Date(now.getTime() - 30 * 86_400_000).toISOString();
    case "3m":  return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    case "6m":  return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    case "all": return null;
  }
}

function useDayGrouping(range: DateRange) { return range === "7d" || range === "30d"; }

function buildDaySeries(rows: Array<{ created_at: string }> | null, days: number): ChartData[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  const counts = new Map(keys.map((k) => [k, 0]));
  (rows ?? []).forEach((r) => {
    const k = r.created_at.slice(0, 10);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return keys.map((k) => ({
    label: new Date(k + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    value: counts.get(k) ?? 0,
  }));
}

function buildMonthSeries(rows: Array<{ created_at: string }> | null, months: number): ChartData[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const counts = new Map(keys.map((k) => [k, 0]));
  (rows ?? []).forEach((r) => {
    const k = r.created_at.slice(0, 7);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return keys.map((k) => {
    const [y, m] = k.split("-");
    return {
      label: new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      value: counts.get(k) ?? 0,
    };
  });
}

function downloadCSV(filename: string, rows: object[]) {
  if (rows.length === 0) { toast.error("No data to export"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => {
      const val = (row as any)[h];
      const s = val == null ? "" : String(val);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

// ---------------------------------------------------------------------------
// UI sub-components
// ---------------------------------------------------------------------------

type Delta = { value: number; dir: "up" | "down" | "same" };

function calcDelta(curr: number, prev: number): Delta {
  if (prev === 0 && curr === 0) return { value: 0, dir: "same" };
  if (prev === 0) return { value: 100, dir: "up" };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { value: Math.abs(pct), dir: pct > 0 ? "up" : pct < 0 ? "down" : "same" };
}

function DeltaChip({ d }: { d: Delta }) {
  if (d.dir === "same") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${d.dir === "up" ? "text-green-600" : "text-red-500"}`}>
      {d.dir === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {d.value}%
    </span>
  );
}

function StatCard({ label, value, delta, icon, sub }: {
  label: string; value: number | string; delta?: Delta; icon: React.ReactNode; sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>
        {delta && <DeltaChip d={delta} />}
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</div>}
      </div>
    </div>
  );
}

function MiniBarChart({ data, color, loading, onExport }: {
  data: ChartData[]; color: string; loading: boolean; onExport?: () => void;
}) {
  if (loading) return <div className="h-44 rounded bg-muted animate-pulse" />;
  if (data.every((d) => d.value === 0)) {
    return <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">No data for this period</div>;
  }
  return (
    <div className="relative">
      {onExport && (
        <button
          onClick={onExport}
          className="absolute -top-8 right-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Export CSV"
        >
          <Download className="h-3 w-3" /> CSV
        </button>
      )}
      <ResponsiveContainer width="100%" height={176}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(v: number) => [v, "Count"]}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankedList({ items, color, loading, emptyText, onExport }: {
  items: RankedItem[]; color: string; loading: boolean; emptyText: string; onExport?: () => void;
}) {
  if (loading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-6 rounded bg-muted animate-pulse" />)}</div>;
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div>
      {onExport && (
        <div className="mb-3 flex justify-end">
          <button onClick={onExport} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors" title="Export CSV">
            <Download className="h-3 w-3" /> CSV
          </button>
        </div>
      )}
      <div className="space-y-2.5">
        {items.map(({ label, count }, i) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-4 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
                <span className="truncate">{label}</span>
              </span>
              <span className="ml-2 shrink-0 font-semibold">{count}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(count / max) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal funnel visualization
function FunnelChart({ stages, loading }: { stages: FunnelStage[]; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>;
  if (stages.length === 0) return <p className="text-xs text-muted-foreground">No referral data yet.</p>;
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => (
        <div key={s.label} className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium capitalize">{s.label.replace(/_/g, " ")}</span>
            <span className="flex items-center gap-2">
              {s.pct !== null && s.pct < 100 && i > 0 && (
                <span className="text-red-400">↓ {(100 - s.pct).toFixed(0)}% drop</span>
              )}
              <span className="font-semibold w-8 text-right">{s.count}</span>
            </span>
          </div>
          <div className="h-5 w-full rounded bg-muted overflow-hidden">
            <div
              className="h-full rounded transition-all flex items-center justify-end pr-1"
              style={{ width: `${Math.max(4, (s.count / max) * 100)}%`, backgroundColor: `hsl(var(--primary) / ${0.4 + (i / stages.length) * 0.6})` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PlatformAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>("6m");
  const [institutionId, setInstitutionId] = useState<string>("all");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Load institution list once on mount
  useEffect(() => {
    supabase
      .from("clinics")
      .select("id, name")
      .eq("verification_status", "ACTIVE")
      .order("name")
      .then(({ data: rows }) => setInstitutions(rows ?? []));
  }, []);

  const loadData = useCallback(async (range: DateRange, instId: string) => {
    setLoading(true);
    setError(null);
    try {
      const startDate = getStartDate(range);
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const dayGrouping = useDayGrouping(range);
      const periodCount = range === "7d" ? 7 : range === "30d" ? 30 : range === "3m" ? 3 : range === "6m" ? 6 : 12;

      // ── Build filtered referral queries ──────────────────────────────────
      const applyRefFilters = (q: any) => {
        if (startDate) q = q.gte("created_at", startDate);
        if (instId !== "all") q = q.eq("originating_clinic_id", instId);
        return q;
      };

      const [
        // Platform-wide totals (no filters)
        { count: totalDoctors },
        { count: totalInstitutions },
        { count: pendingApprovals },
        { count: activeInstitutions },
        { count: verifiedDoctors },
        // Month-boundary deltas
        { count: referralsThisMonth },
        { count: referralsLastMonth },
        { count: newDoctorsThisMonth },
        { count: newDoctorsLastMonth },
        { count: newInstitutionsThisMonth },
        { count: newInstitutionsLastMonth },
        // Filtered total referrals
        { count: totalReferrals },
        // Time-series rows
        { data: refPeriodRows },
        { data: docPeriodRows },
        { data: instPeriodRows },
        // Referral analytics (filtered)
        { data: statusRows },
        { data: urgencyRows },
        { data: hospitalRows },
        { data: completionRows },
        { data: pairRows },
        { data: cityRows },
        // Doctor specialties (always platform-wide)
        { data: specialtyRows },
      ] = await Promise.all([
        supabase.from("doctor_profiles").select("*", { count: "exact", head: true }),
        supabase.from("clinics").select("*", { count: "exact", head: true }),
        supabase.from("clinics").select("*", { count: "exact", head: true }).eq("verification_status", "PENDING"),
        supabase.from("clinics").select("*", { count: "exact", head: true }).eq("verification_status", "ACTIVE"),
        supabase.from("doctor_profiles").select("*", { count: "exact", head: true }).eq("nmc_verified", true),
        // month deltas
        supabase.from("referrals").select("*", { count: "exact", head: true }).gte("created_at", thisMonthStart),
        supabase.from("referrals").select("*", { count: "exact", head: true }).gte("created_at", lastMonthStart).lt("created_at", thisMonthStart),
        supabase.from("doctor_profiles").select("*", { count: "exact", head: true }).gte("created_at", thisMonthStart),
        supabase.from("doctor_profiles").select("*", { count: "exact", head: true }).gte("created_at", lastMonthStart).lt("created_at", thisMonthStart),
        supabase.from("clinics").select("*", { count: "exact", head: true }).gte("created_at", thisMonthStart),
        supabase.from("clinics").select("*", { count: "exact", head: true }).gte("created_at", lastMonthStart).lt("created_at", thisMonthStart),
        // filtered counts
        applyRefFilters(supabase.from("referrals").select("*", { count: "exact", head: true })),
        // time series
        applyRefFilters(supabase.from("referrals").select("created_at")),
        (() => {
          let q = supabase.from("doctor_profiles").select("created_at");
          if (startDate) q = q.gte("created_at", startDate);
          return q;
        })(),
        (() => {
          let q = supabase.from("clinics").select("created_at");
          if (startDate) q = q.gte("created_at", startDate);
          return q;
        })(),
        // referral analytics
        applyRefFilters(supabase.from("referrals").select("status")),
        applyRefFilters(supabase.from("referrals").select("urgency")),
        applyRefFilters(supabase.from("referrals").select("originating_clinic_id, clinics(name)")),
        applyRefFilters(supabase.from("referrals").select("sent_at, completed_at").not("sent_at", "is", null).not("completed_at", "is", null)),
        applyRefFilters(supabase.from("referrals").select("referring_doctor_id, specialist_id").not("referring_doctor_id", "is", null).not("specialist_id", "is", null)),
        applyRefFilters(supabase.from("referrals").select("clinics(city)")),
        // doctor specialties
        supabase.from("doctor_profiles").select("sub_specialties").not("sub_specialties", "is", null),
      ]);

      // ── Build time series ────────────────────────────────────────────────
      const refSeries = dayGrouping
        ? buildDaySeries(refPeriodRows ?? [], periodCount)
        : buildMonthSeries(refPeriodRows ?? [], periodCount);
      const docSeries = dayGrouping
        ? buildDaySeries(docPeriodRows ?? [], periodCount)
        : buildMonthSeries(docPeriodRows ?? [], periodCount);
      const instSeries = dayGrouping
        ? buildDaySeries(instPeriodRows ?? [], periodCount)
        : buildMonthSeries(instPeriodRows ?? [], periodCount);

      // ── Referrals by status ──────────────────────────────────────────────
      const statusMap = new Map<string, number>();
      (statusRows ?? []).forEach((r: any) => {
        const s = r.status ?? "UNKNOWN";
        statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
      });
      const referralsByStatus = Array.from(statusMap.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

      // ── Funnel ───────────────────────────────────────────────────────────
      // Status values must match the referral_status DB enum exactly
      const FUNNEL_ORDER = ["SENT", "VIEWED", "ACKNOWLEDGED", "ACCEPTED", "APPOINTMENT_BOOKED", "COMPLETED"];
      const funnelStages: FunnelStage[] = FUNNEL_ORDER
        .filter((s) => statusMap.has(s))
        .map((s, i, arr) => {
          const count = statusMap.get(s) ?? 0;
          const prevCount = i === 0 ? count : (statusMap.get(arr[i - 1]) ?? 0);
          const pct = prevCount > 0 ? Math.round((count / prevCount) * 100) : 100;
          return { label: s.replace("_", " "), count, pct };
        });
      // Declined / cancelled at the end (drop-off)
      ["DECLINED", "CANCELLED", "EXPIRED"].forEach((s) => {
        if (statusMap.has(s)) funnelStages.push({ label: s, count: statusMap.get(s)!, pct: 0 });
      });

      // ── Urgency ──────────────────────────────────────────────────────────
      const urgencyMap = new Map<string, number>();
      (urgencyRows ?? []).forEach((r: any) => {
        const u = (r.urgency ?? "").toUpperCase();
        urgencyMap.set(u, (urgencyMap.get(u) ?? 0) + 1);
      });
      const urgency = {
        routine:   urgencyMap.get("ROUTINE") ?? 0,
        semiUrgent: urgencyMap.get("SEMI_URGENT") ?? urgencyMap.get("SEMI-URGENT") ?? 0,
        urgent:    urgencyMap.get("URGENT") ?? urgencyMap.get("EMERGENCY") ?? 0,
      };

      // ── Top hospitals ────────────────────────────────────────────────────
      const hospitalMap = new Map<string, number>();
      (hospitalRows ?? []).forEach((r: any) => {
        const name = r?.clinics?.name ?? r.originating_clinic_id ?? "Unknown";
        if (name) hospitalMap.set(name, (hospitalMap.get(name) ?? 0) + 1);
      });
      const topHospitals = Array.from(hospitalMap.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // ── Avg hours to completion ───────────────────────────────────────────
      const completionTimes = (completionRows ?? [])
        .map((r: any) => (new Date(r.completed_at).getTime() - new Date(r.sent_at).getTime()) / 3_600_000)
        .filter((h) => h > 0);
      const avgHoursToCompletion = completionTimes.length
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : null;

      // ── Completion rate ───────────────────────────────────────────────────
      const completedCount = statusMap.get("COMPLETED") ?? 0;
      const completionRate = (totalReferrals ?? 0) > 0
        ? Math.round((completedCount / (totalReferrals ?? 1)) * 100)
        : 0;

      // ── Avg days to first response (sent → acknowledged) ─────────────────
      // Uses completed_at as a proxy since acknowledged_at may not exist
      const avgDaysToResponse = avgHoursToCompletion != null
        ? Math.round((avgHoursToCompletion / 24) * 10) / 10
        : null;

      // ── Network density ───────────────────────────────────────────────────
      const pairs = new Set(
        (pairRows ?? []).map((r: any) => `${r.referring_doctor_id}:${r.specialist_id}`)
      );
      const networkDensity = pairs.size;

      // ── Top referring city ────────────────────────────────────────────────
      const cityMap = new Map<string, number>();
      (cityRows ?? []).forEach((r: any) => {
        const city = r?.clinics?.city;
        if (city) cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
      });
      const topReferringCity = Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // ── Top specialties ───────────────────────────────────────────────────
      const specMap = new Map<string, number>();
      (specialtyRows ?? []).forEach((r: any) => {
        (Array.isArray(r.sub_specialties) ? r.sub_specialties : []).forEach((s: string) => {
          const t = s?.trim();
          if (t) specMap.set(t, (specMap.get(t) ?? 0) + 1);
        });
      });
      const topSpecialties = Array.from(specMap.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      setData({
        totalDoctors: totalDoctors ?? 0, totalInstitutions: totalInstitutions ?? 0,
        pendingApprovals: pendingApprovals ?? 0, activeInstitutions: activeInstitutions ?? 0,
        verifiedDoctors: verifiedDoctors ?? 0,
        referralsThisMonth: referralsThisMonth ?? 0, referralsLastMonth: referralsLastMonth ?? 0,
        newDoctorsThisMonth: newDoctorsThisMonth ?? 0, newDoctorsLastMonth: newDoctorsLastMonth ?? 0,
        newInstitutionsThisMonth: newInstitutionsThisMonth ?? 0, newInstitutionsLastMonth: newInstitutionsLastMonth ?? 0,
        totalReferrals: totalReferrals ?? 0,
        referralsByPeriod: refSeries, doctorsByPeriod: docSeries, institutionsByPeriod: instSeries,
        referralsByStatus, topHospitals, topSpecialties,
        urgency, funnelStages, avgHoursToCompletion, completionRate,
        avgDaysToResponse, networkDensity, topReferringCity,
      });
      setLastRefreshed(new Date());
    } catch (e: any) {
      setError(e.message ?? "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(dateRange, institutionId); }, [dateRange, institutionId, loadData]);

  const refDelta  = calcDelta(data.referralsThisMonth,       data.referralsLastMonth);
  const docDelta  = calcDelta(data.newDoctorsThisMonth,      data.newDoctorsLastMonth);
  const instDelta = calcDelta(data.newInstitutionsThisMonth, data.newInstitutionsLastMonth);

  const RANGE_LABELS: Record<DateRange, string> = {
    "7d": "Last 7 days", "30d": "Last 30 days",
    "3m": "Last 3 months", "6m": "Last 6 months", "all": "All time",
  };

  const ts = new Date().toISOString().slice(0, 10);

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Analytics"
        subtitle={lastRefreshed ? `Last refreshed ${lastRefreshed.toLocaleTimeString("en-IN")}` : "Loading…"}
        action={
          <Button variant="outline" size="sm" onClick={() => loadData(dateRange, institutionId)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <div className="flex items-center gap-1.5">
          {(["7d", "30d", "3m", "6m", "all"] as DateRange[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={dateRange === r ? "default" : "outline"}
              onClick={() => setDateRange(r)}
              className="h-7 px-2.5 text-xs"
            >
              {RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Select value={institutionId} onValueChange={setInstitutionId}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue placeholder="All institutions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All institutions</SelectItem>
              {institutions.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total doctors"       value={data.totalDoctors}       icon={<Stethoscope className="h-4 w-4" />}                       delta={docDelta}  sub="vs last month" />
        <StatCard label="Total institutions"  value={data.totalInstitutions}  icon={<Building2 className="h-4 w-4" />}                          delta={instDelta} sub="vs last month" />
        <StatCard label="Total referrals"     value={data.totalReferrals}     icon={<Send className="h-4 w-4" />}                               delta={refDelta}  sub="vs last month" />
        <StatCard label="Pending approvals"   value={data.pendingApprovals}   icon={<Calendar className="h-4 w-4 text-amber-600" />} />
        <StatCard label="Active institutions" value={data.activeInstitutions} icon={<Activity className="h-4 w-4 text-green-600" />} />
        <StatCard label="Verified doctors"    value={data.verifiedDoctors}    icon={<Users className="h-4 w-4 text-blue-600" />} />
      </div>

      {/* Urgency breakdown */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Routine referrals",    value: data.urgency.routine,    color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
          { label: "Semi-urgent referrals", value: data.urgency.semiUrgent, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
          { label: "Urgent referrals",     value: data.urgency.urgent,     color: "text-red-600",    bg: "bg-red-50 border-red-200" },
        ].map((u) => (
          <div key={u.label} className={`rounded-xl border ${u.bg} p-4 flex items-center gap-3`}>
            <div>
              <div className={`text-2xl font-bold ${u.color}`}>{u.value}</div>
              <div className="text-xs text-muted-foreground">{u.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            title: "Referrals", icon: <Send className="h-4 w-4 text-primary" />, color: "hsl(var(--primary))",
            data: data.referralsByPeriod,
            exportData: () => downloadCSV(`referrals-by-period-${ts}.csv`, data.referralsByPeriod.map((d) => ({ period: d.label, referrals: d.value }))),
          },
          {
            title: "New doctors", icon: <Stethoscope className="h-4 w-4 text-blue-600" />, color: "#3b82f6",
            data: data.doctorsByPeriod,
            exportData: () => downloadCSV(`doctors-by-period-${ts}.csv`, data.doctorsByPeriod.map((d) => ({ period: d.label, doctors: d.value }))),
          },
          {
            title: "New institutions", icon: <Building2 className="h-4 w-4 text-emerald-600" />, color: "#10b981",
            data: data.institutionsByPeriod,
            exportData: () => downloadCSV(`institutions-by-period-${ts}.csv`, data.institutionsByPeriod.map((d) => ({ period: d.label, institutions: d.value }))),
          },
        ].map((c) => (
          <div key={c.title} className="rounded-xl border bg-card p-4 shadow-card">
            <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
              {c.icon} {c.title} per {useDayGrouping(dateRange) ? "day" : "month"}
            </div>
            <MiniBarChart data={c.data} color={c.color} loading={loading} onExport={c.exportData} />
          </div>
        ))}
      </div>

      {/* Funnel + avg time */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-purple-600" /> Referral funnel
          </div>
          <FunnelChart stages={data.funnelStages} loading={loading} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold">
              {data.avgHoursToCompletion != null ? `${Math.round(data.avgHoursToCompletion)}h` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Avg. time to completion</div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <Target className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold">{data.completionRate}%</div>
            <div className="text-xs text-muted-foreground">Completion rate</div>
            <Progress value={data.completionRate} className="mt-2 h-1.5" />
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <Network className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold">{data.networkDensity}</div>
            <div className="text-xs text-muted-foreground">Unique doctor pairs</div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="text-lg font-bold truncate">{data.topReferringCity ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Top referring city</div>
          </div>
        </div>
      </div>

      {/* Ranked lists */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-purple-600" /> Referrals by status
          </div>
          <RankedList
            items={data.referralsByStatus} color="#a855f7" loading={loading}
            emptyText="No referral data yet."
            onExport={() => downloadCSV(`referrals-by-status-${ts}.csv`, data.referralsByStatus.map((d) => ({ status: d.label, count: d.count })))}
          />
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-blue-600" /> Top hospitals by referrals
          </div>
          <RankedList
            items={data.topHospitals} color="#3b82f6" loading={loading}
            emptyText="No referral data yet."
            onExport={() => downloadCSV(`top-hospitals-${ts}.csv`, data.topHospitals.map((d) => ({ hospital: d.label, referrals: d.count })))}
          />
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Stethoscope className="h-4 w-4 text-purple-600" /> Top specialties
          </div>
          <RankedList
            items={data.topSpecialties} color="#8b5cf6" loading={loading}
            emptyText="No specialty data yet."
            onExport={() => downloadCSV(`top-specialties-${ts}.csv`, data.topSpecialties.map((d) => ({ specialty: d.label, doctors: d.count })))}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
