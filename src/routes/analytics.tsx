import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Sparkles, CheckCircle2, Lightbulb, AlertCircle, Info, Calendar,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { AnalyticsSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAnalyticsInsightsAI, type Insight } from "@/lib/aiInsights";
import { age } from "@/lib/format";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Doctor Bridge" }] }),
  component: AnalyticsPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

type DateRange = "30d" | "3m" | "6m" | "12m";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string; short: string }[] = [
  { value: "30d", label: "Last 30 days",   short: "30d"  },
  { value: "3m",  label: "Last 3 months",  short: "3mo"  },
  { value: "6m",  label: "Last 6 months",  short: "6mo"  },
  { value: "12m", label: "Last 12 months", short: "12mo" },
];

const COLORS = [
  "oklch(0.49 0.20 277)",
  "oklch(0.65 0.16 152)",
  "oklch(0.78 0.16 75)",
  "oklch(0.65 0.13 230)",
  "oklch(0.55 0.22 27)",
  "oklch(0.55 0.10 320)",
  "oklch(0.60 0.18 160)",
  "oklch(0.70 0.15 50)",
];

const URGENCY_COLORS: Record<string, string> = {
  ROUTINE:     "oklch(0.65 0.16 152)",
  SEMI_URGENT: "oklch(0.78 0.16 75)",
  URGENT:      "oklch(0.55 0.22 27)",
};

const ENCOUNTER_COLORS: Record<string, string> = {
  VISIT:        COLORS[0],
  DIAGNOSIS:    COLORS[1],
  PRESCRIPTION: COLORS[2],
  TEST:         COLORS[3],
  SURGERY:      COLORS[4],
  NOTE:         COLORS[5],
  REFERRAL:     COLORS[6],
};

const OUTCOME_COLORS: Record<string, string> = {
  IMPROVED:         "oklch(0.65 0.16 152)",
  STABLE:           "oklch(0.65 0.13 230)",
  DETERIORATED:     "oklch(0.55 0.22 27)",
  LOST_TO_FOLLOWUP: "oklch(0.78 0.16 75)",
  UNKNOWN:          "oklch(0.55 0.10 320)",
};

const OUTCOME_DISPLAY: Record<string, string> = {
  IMPROVED:         "Improved",
  STABLE:           "Stable",
  DETERIORATED:     "Deteriorated",
  LOST_TO_FOLLOWUP: "Lost to Follow-up",
  UNKNOWN:          "Unknown",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sinceDate(range: DateRange): Date {
  const d = new Date();
  switch (range) {
    case "30d": d.setDate(d.getDate() - 30); break;
    case "3m":  d.setMonth(d.getMonth() - 3);  d.setDate(1); break;
    case "6m":  d.setMonth(d.getMonth() - 6);  d.setDate(1); break;
    case "12m": d.setMonth(d.getMonth() - 12); d.setDate(1); break;
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function ageGroup(dob: string): string {
  const a = age(dob);
  if (a === null) return "Unknown";
  if (a <= 18) return "0–18";
  if (a <= 35) return "19–35";
  if (a <= 50) return "36–50";
  if (a <= 65) return "51–65";
  return "65+";
}

function monthLabel(isoYearMonth: string) {
  return new Date(isoYearMonth + "-01").toLocaleString("en-IN", {
    month: "short", year: "2-digit",
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelPoint   { stage: string; count: number; pct: number }
interface OutcomePoint  { name: string; value: number; rawName: string }
interface NameCount     { name: string; count: number }
interface NameValue     { name: string; value: number }
interface MonthTrend    { month: string; sent: number; received: number }
interface WeekPoint     { week: string; count: number }
interface AgeBand       { band: string; count: number }

// ── Page ──────────────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const { user } = useAuth();

  const [dateRange,     setDateRange]     = useState<DateRange>("6m");
  const [loading,       setLoading]       = useState(true);
  const [hasReferrals,  setHasReferrals]  = useState(false);

  // Section 1 — KPIs
  const [kpis, setKpis] = useState({
    sent: 0, received: 0, acceptanceRate: 0,
    avgResponseHrs: 0, capacityPct: 0, uniqueReferringDocs: 0,
  });

  // Section 2 — Funnel
  const [funnelData, setFunnelData] = useState<FunnelPoint[]>([]);

  // Section 3 — Volume + urgency
  const [trend,       setTrend]       = useState<MonthTrend[]>([]);
  const [urgencyData, setUrgencyData] = useState<NameValue[]>([]);

  // Section 4 — Encounter analytics
  const [encounterTypeData, setEncounterTypeData] = useState<NameValue[]>([]);
  const [weeklyEncounters,  setWeeklyEncounters]  = useState<WeekPoint[]>([]);
  const [uniquePatients,    setUniquePatients]    = useState(0);

  // Section 5 — Patient demographics
  const [genderData,           setGenderData]           = useState<NameValue[]>([]);
  const [ageData,               setAgeData]               = useState<AgeBand[]>([]);
  const [topChronicConditions, setTopChronicConditions] = useState<NameCount[]>([]);

  // Section 6 — Outcomes & network
  const [outcomeData,       setOutcomeData]       = useState<OutcomePoint[]>([]);
  const [topReferrers,      setTopReferrers]      = useState<NameCount[]>([]);
  const [secondOpinionData, setSecondOpinionData] = useState<NameValue[]>([]);

  // AI
  const [analyticsInsights, setAnalyticsInsights] = useState<Insight[]>([]);
  const [insightsLoading,   setInsightsLoading]   = useState(false);
  const [aiCtx,             setAiCtx]             = useState<any>(null);

  // ── Main fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setAnalyticsInsights([]);

    (async () => {
      // 0. Doctor profile
      const { data: myDoc } = await supabase
        .from("doctor_profiles")
        .select("id,referral_acceptance_rate,avg_response_time_hours,current_week_referrals,weekly_referral_cap,unique_referring_doctors")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!myDoc) { setLoading(false); return; }

      const sinceIso = sinceDate(dateRange).toISOString();
      const docId    = (myDoc as any).id as string;

      // 1. Referrals — sent + received
      const [{ data: rawSent }, { data: rawRecv }] = await Promise.all([
        supabase
          .from("referrals")
          .select("id,created_at,status,sent_at,accepted_at,viewed_at,appointment_booked_at,completed_at,urgency,outcome,referral_type,primary_diagnosis,referring_doctor_id")
          .eq("referring_doctor_id", docId)
          .gte("created_at", sinceIso),
        supabase
          .from("referrals")
          .select("id,created_at,status,sent_at,accepted_at,viewed_at,appointment_booked_at,completed_at,urgency,outcome,referral_type,primary_diagnosis,referring_doctor_id")
          .eq("specialist_id", docId)
          .gte("created_at", sinceIso),
      ]);

      if (cancelled) return;

      const sentList = (rawSent ?? []) as any[];
      const recvList = (rawRecv ?? []) as any[];
      const allRefs  = [...sentList, ...recvList];

      setHasReferrals(allRefs.length > 0);

      // 2. Encounters (last 6 months always for trend; respect range for donut)
      const { data: rawEncounters } = await supabase
        .from("patient_encounters")
        .select("id,type,occurred_at,global_patient_id")
        .eq("doctor_user_id", user.id)
        .gte("occurred_at", sinceIso);

      if (cancelled) return;
      const encList = (rawEncounters ?? []) as any[];

      // 3. Patients I created
      const { data: rawPatients } = await supabase
        .from("global_patients")
        .select("id,gender,date_of_birth,chronic_conditions")
        .eq("created_by_user_id", user.id);

      if (cancelled) return;
      const patientList = (rawPatients ?? []) as any[];

      // 4. Top referring doctor names (2-step join: doctor_profiles → profiles)
      const refCountMap = new Map<string, number>();
      for (const r of recvList) {
        const rid = r.referring_doctor_id as string;
        if (rid) refCountMap.set(rid, (refCountMap.get(rid) ?? 0) + 1);
      }
      const topDocIds = Array.from(refCountMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      let topRefNames: NameCount[] = [];
      if (topDocIds.length > 0) {
        const { data: dpRows } = await supabase
          .from("doctor_profiles")
          .select("id,user_id")
          .in("id", topDocIds);
        if (!cancelled && dpRows && (dpRows as any[]).length > 0) {
          const userIds = (dpRows as any[]).map((d) => d.user_id as string);
          const { data: profRows } = await supabase
            .from("profiles")
            .select("id,first_name,last_name")
            .in("id", userIds);
          if (!cancelled && profRows) {
            const userNameMap = new Map(
              (profRows as any[]).map((p) => [p.id as string, `Dr. ${p.first_name} ${p.last_name}`])
            );
            const dpUserMap = new Map(
              (dpRows as any[]).map((d) => [d.id as string, d.user_id as string])
            );
            topRefNames = topDocIds.map((id) => ({
              name:  userNameMap.get(dpUserMap.get(id) ?? "") ?? "Unknown",
              count: refCountMap.get(id) ?? 0,
            }));
          }
        }
      }

      if (cancelled) return;

      // ── KPIs ───────────────────────────────────────────────────────────────
      const acceptedCount  = recvList.filter((r: any) => r.accepted_at).length;
      const acceptanceRate = recvList.length > 0
        ? Math.round((acceptedCount / recvList.length) * 100) : 0;

      const responseTimes = recvList
        .filter((r: any) => r.sent_at && r.accepted_at)
        .map((r: any) => (new Date(r.accepted_at).getTime() - new Date(r.sent_at).getTime()) / 3_600_000)
        .filter((h: number) => h >= 0);
      const avgResponseHrs = responseTimes.length > 0
        ? +(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length).toFixed(1)
        : 0;

      const cap         = (myDoc as any).weekly_referral_cap     as number ?? 0;
      const cur         = (myDoc as any).current_week_referrals  as number ?? 0;
      const capacityPct = cap > 0 ? Math.round((cur / cap) * 100) : 0;

      setKpis({
        sent:                sentList.length,
        received:            recvList.length,
        acceptanceRate,
        avgResponseHrs,
        capacityPct,
        uniqueReferringDocs: (myDoc as any).unique_referring_doctors as number ?? 0,
      });

      // ── Funnel ─────────────────────────────────────────────────────────────
      const funnelRaw = [
        { stage: "Sent",         count: recvList.length },
        { stage: "Viewed",       count: recvList.filter((r: any) => r.viewed_at).length },
        { stage: "Accepted",     count: recvList.filter((r: any) => r.accepted_at).length },
        { stage: "Appt. Booked", count: recvList.filter((r: any) => r.appointment_booked_at).length },
        { stage: "Completed",    count: recvList.filter((r: any) => r.completed_at).length },
      ];
      setFunnelData(
        funnelRaw.map((s, i) => ({
          ...s,
          pct: i === 0 || funnelRaw[i - 1].count === 0
            ? 100
            : Math.round((s.count / funnelRaw[i - 1].count) * 100),
        })),
      );

      // ── Monthly trend ──────────────────────────────────────────────────────
      const numMonths = dateRange === "30d" ? 1 : dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
      const monthMap = new Map<string, { sent: number; received: number }>();
      for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthMap.set(d.toISOString().slice(0, 7), { sent: 0, received: 0 });
      }
      sentList.forEach((r: any) => {
        const k = (r.created_at as string).slice(0, 7);
        const m = monthMap.get(k); if (m) m.sent++;
      });
      recvList.forEach((r: any) => {
        const k = (r.created_at as string).slice(0, 7);
        const m = monthMap.get(k); if (m) m.received++;
      });
      const trendData: MonthTrend[] = Array.from(monthMap.entries()).map(([k, v]) => ({
        month: monthLabel(k), ...v,
      }));
      setTrend(trendData);

      // ── Urgency donut ──────────────────────────────────────────────────────
      const urgMap = new Map<string, number>();
      allRefs.forEach((r: any) => {
        const u = (r.urgency as string) ?? "ROUTINE";
        urgMap.set(u, (urgMap.get(u) ?? 0) + 1);
      });
      setUrgencyData(
        ["ROUTINE", "SEMI_URGENT", "URGENT"].map((k) => ({
          name:  k === "SEMI_URGENT" ? "Semi-urgent" : k.charAt(0) + k.slice(1).toLowerCase(),
          value: urgMap.get(k) ?? 0,
        })).filter((d) => d.value > 0),
      );

      // ── Encounter type breakdown ────────────────────────────────────────────
      const encTypeMap = new Map<string, number>();
      encList.forEach((e: any) => {
        const t = e.type as string;
        encTypeMap.set(t, (encTypeMap.get(t) ?? 0) + 1);
      });
      setEncounterTypeData(
        Array.from(encTypeMap.entries())
          .map(([name, value]) => ({
            name: name.charAt(0) + name.slice(1).toLowerCase(),
            value,
          }))
          .sort((a, b) => b.value - a.value),
      );

      // ── Weekly encounters (last 12 weeks) ──────────────────────────────────
      const nowMs = Date.now();
      const weekBuckets: { label: string; start: number; end: number; count: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        weekBuckets.push({
          label: new Date(nowMs - (i + 1) * 7 * 86_400_000).toLocaleDateString("en-IN", {
            day: "numeric", month: "short",
          }),
          start: nowMs - (i + 1) * 7 * 86_400_000,
          end:   nowMs - i       * 7 * 86_400_000,
          count: 0,
        });
      }
      encList.forEach((e: any) => {
        const t = new Date(e.occurred_at).getTime();
        const w = weekBuckets.find((b) => t >= b.start && t < b.end);
        if (w) w.count++;
      });
      setWeeklyEncounters(weekBuckets.map((w) => ({ week: w.label, count: w.count })));

      // ── Unique patients seen ───────────────────────────────────────────────
      const uPatients = new Set(encList.map((e: any) => e.global_patient_id as string)).size;
      setUniquePatients(uPatients);

      // ── Gender split ───────────────────────────────────────────────────────
      const genderMap = new Map<string, number>();
      patientList.forEach((p: any) => {
        const g = (p.gender as string) ?? "OTHER";
        genderMap.set(g, (genderMap.get(g) ?? 0) + 1);
      });
      setGenderData(
        [
          { name: "Male",   value: genderMap.get("MALE")   ?? 0 },
          { name: "Female", value: genderMap.get("FEMALE") ?? 0 },
          { name: "Other",  value: genderMap.get("OTHER")  ?? 0 },
        ].filter((d) => d.value > 0),
      );

      // ── Age distribution ───────────────────────────────────────────────────
      const BANDS = ["0–18", "19–35", "36–50", "51–65", "65+"];
      const ageBandMap = new Map<string, number>(BANDS.map((b) => [b, 0]));
      patientList.forEach((p: any) => {
        const g = ageGroup(p.date_of_birth);
        if (ageBandMap.has(g)) ageBandMap.set(g, (ageBandMap.get(g) ?? 0) + 1);
      });
      setAgeData(BANDS.map((b) => ({ band: b, count: ageBandMap.get(b) ?? 0 })));

      // ── Top 5 chronic conditions ───────────────────────────────────────────
      const condMap = new Map<string, number>();
      patientList.forEach((p: any) => {
        ((p.chronic_conditions as string[]) ?? []).forEach((c) => {
          if (c) condMap.set(c, (condMap.get(c) ?? 0) + 1);
        });
      });
      setTopChronicConditions(
        Array.from(condMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
      );

      // ── Outcome distribution ───────────────────────────────────────────────
      const outMap = new Map<string, number>();
      recvList.filter((r: any) => r.outcome).forEach((r: any) => {
        const o = r.outcome as string;
        outMap.set(o, (outMap.get(o) ?? 0) + 1);
      });
      setOutcomeData(
        Array.from(outMap.entries()).map(([rawName, value]) => ({
          rawName,
          name:  OUTCOME_DISPLAY[rawName] ?? rawName,
          value,
        })),
      );

      // ── Top 5 referring doctors ────────────────────────────────────────────
      setTopReferrers(topRefNames);

      // ── Second opinion / referral type split ──────────────────────────────
      const soCount  = allRefs.filter((r: any) => r.referral_type === "SECOND_OPINION").length;
      const refCount = allRefs.length - soCount;
      setSecondOpinionData(
        [
          { name: "Referral",       value: refCount },
          { name: "Second Opinion", value: soCount  },
        ].filter((d) => d.value > 0),
      );

      // ── AI context ─────────────────────────────────────────────────────────
      const topConditions = allRefs
        .reduce((acc: NameCount[], r: any) => {
          const k = ((r.primary_diagnosis ?? "Unknown") as string).slice(0, 40);
          const e = acc.find((a) => a.name === k);
          if (e) e.count++; else acc.push({ name: k, count: 1 });
          return acc;
        }, [])
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const byStatus = Array.from(
        recvList.reduce((m: Map<string, number>, r: any) => {
          m.set(r.status, (m.get(r.status) ?? 0) + 1); return m;
        }, new Map<string, number>()).entries()
      ).map(([name, value]) => ({ name, value }));

      setAiCtx({
        sent:         sentList.length,
        received:     recvList.length,
        acceptance:   acceptanceRate,
        avgResponse:  avgResponseHrs,
        topConditions,
        byStatus,
        trend:        trendData,
        uniquePatients: uPatients,
        totalEncounters: encList.length,
        capacityPct,
        funnelData: funnelRaw.map((s, i) => ({
          ...s,
          pct: i === 0 || funnelRaw[i - 1].count === 0
            ? 100
            : Math.round((s.count / funnelRaw[i - 1].count) * 100),
        })),
        outcomeData: Array.from(outMap.entries()).map(([name, value]) => ({ name, value })),
      });

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, dateRange]);

  // ── AI insights ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !aiCtx) return;
    let cancelled = false;
    setInsightsLoading(true);
    getAnalyticsInsightsAI(aiCtx).then((result) => {
      if (!cancelled) { setAnalyticsInsights(result); setInsightsLoading(false); }
    });
    return () => { cancelled = true; };
  }, [loading, aiCtx]);

  const rangeShort = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.short ?? "6mo";

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <PageHeader
          title="Analytics"
          description="Your practice metrics and referral performance."
          actions={
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {loading ? (
          <AnalyticsSkeleton />
        ) : (
          <div className="space-y-6">

            {/* ── Section 1 — KPI row ──────────────────────────────────────── */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KPI label={`Referrals sent (${rangeShort})`}     value={String(kpis.sent)} />
              <KPI label={`Referrals received (${rangeShort})`} value={String(kpis.received)} />
              <KPI
                label="Acceptance rate"
                value={kpis.received > 0 ? `${kpis.acceptanceRate}%` : "—"}
                sub={kpis.received > 0 ? "of received referrals" : undefined}
              />
              <KPI
                label="Avg response time"
                value={kpis.avgResponseHrs > 0 ? `${kpis.avgResponseHrs}h` : "—"}
                sub={kpis.avgResponseHrs > 0 ? "sent → accepted" : undefined}
              />
              <KPI
                label="Capacity utilisation"
                value={kpis.capacityPct > 0 ? `${kpis.capacityPct}%` : "—"}
                sub={kpis.capacityPct > 0 ? "of weekly cap" : "no cap set"}
              />
              <KPI
                label="Unique referring doctors"
                value={String(kpis.uniqueReferringDocs)}
              />
            </div>

            {/* ── AI Insights ──────────────────────────────────────────────── */}
            <AIInsightsPanel insights={analyticsInsights} loading={insightsLoading} />

            {/* ── Section 2 — Referral funnel ──────────────────────────────── */}
            <Card title="Referral funnel — received referrals by stage" fullWidth>
              {!hasReferrals ? <NoReferrals /> : <FunnelBarChart data={funnelData} />}
            </Card>

            {/* ── Section 3 — Volume & urgency ─────────────────────────────── */}
            <SectionDivider>Volume &amp; urgency</SectionDivider>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={`Monthly sent vs received (${rangeShort})`}>
                {!hasReferrals ? <NoReferrals /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={trend} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="sent"     name="Sent"     fill={COLORS[0]} radius={[4,4,0,0]} />
                      <Bar dataKey="received" name="Received" fill={COLORS[1]} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Urgency distribution (all referrals)">
                {!hasReferrals ? <NoReferrals /> : urgencyData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={urgencyData} dataKey="value" nameKey="name"
                        innerRadius={65} outerRadius={95} paddingAngle={2}>
                        {urgencyData.map((d) => (
                          <Cell key={d.name}
                            fill={
                              d.name === "Routine"     ? URGENCY_COLORS.ROUTINE :
                              d.name === "Semi-urgent" ? URGENCY_COLORS.SEMI_URGENT :
                              URGENCY_COLORS.URGENT
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* ── Section 4 — Encounter analytics ──────────────────────────── */}
            <SectionDivider>Encounter analytics</SectionDivider>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Encounter type breakdown">
                {encounterTypeData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={encounterTypeData} dataKey="value" nameKey="name"
                        innerRadius={55} outerRadius={88} paddingAngle={2}>
                        {encounterTypeData.map((d) => (
                          <Cell key={d.name}
                            fill={ENCOUNTER_COLORS[d.name.toUpperCase()] ?? COLORS[0]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Weekly encounter volume (last 12 weeks)">
                {weeklyEncounters.every((w) => w.count === 0) ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weeklyEncounters}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                      <XAxis dataKey="week" fontSize={9} interval={2} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Line
                        type="monotone" dataKey="count" name="Encounters"
                        stroke={COLORS[0]} strokeWidth={2}
                        dot={{ r: 2 }} activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Unique patients seen">
                <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center">
                  <div className="text-6xl font-bold tracking-tight">{uniquePatients}</div>
                  <div className="text-sm font-medium text-muted-foreground">
                    distinct patients encountered
                  </div>
                  <div className="mt-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label}
                  </div>
                </div>
              </Card>
            </div>

            {/* ── Section 5 — Patient demographics ─────────────────────────── */}
            <SectionDivider>Patient demographics</SectionDivider>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Gender split (registered patients)">
                {genderData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={genderData} dataKey="value" nameKey="name"
                        innerRadius={65} outerRadius={95} paddingAngle={2}>
                        {genderData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Age distribution (registered patients)">
                {ageData.every((d) => d.count === 0) ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ageData} layout="vertical" margin={{ left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                      <XAxis type="number" fontSize={11} allowDecimals={false} />
                      <YAxis dataKey="band" type="category" fontSize={11} width={44} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" name="Patients" fill={COLORS[3]} radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Top 5 chronic conditions">
                {topChronicConditions.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topChronicConditions} layout="vertical" margin={{ left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                      <XAxis type="number" fontSize={11} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" fontSize={10} width={120} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" name="Patients" fill={COLORS[4]} radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* ── Section 6 — Outcomes & network ───────────────────────────── */}
            <SectionDivider>Referral outcomes &amp; network</SectionDivider>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Outcome distribution (received referrals)">
                {!hasReferrals ? <NoReferrals /> : outcomeData.length === 0 ? (
                  <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground px-4">
                    No outcomes recorded yet.<br />
                    <span className="text-xs mt-1 block">Outcomes are logged when a referral is closed.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={outcomeData} dataKey="value" nameKey="name"
                        innerRadius={55} outerRadius={88} paddingAngle={2}>
                        {outcomeData.map((d) => (
                          <Cell key={d.rawName}
                            fill={OUTCOME_COLORS[d.rawName] ?? COLORS[0]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Top 5 referring doctors">
                {!hasReferrals ? <NoReferrals /> : topReferrers.length === 0 ? <Empty /> : (
                  <div className="mt-3 space-y-3">
                    {topReferrers.map((d, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{d.name}</div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/60 transition-all duration-500"
                              style={{ width: `${Math.round((d.count / (topReferrers[0]?.count ?? 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                          {d.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Referral type split">
                {!hasReferrals ? <NoReferrals /> : secondOpinionData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={secondOpinionData} dataKey="value" nameKey="name"
                        innerRadius={65} outerRadius={95} paddingAngle={2}>
                        {secondOpinionData.map((_, i) => (
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

          </div>
        )}
      </DashboardLayout>
    </ErrorBoundary>

  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Card({
  title, children, fullWidth,
}: {
  title: string; children: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-card${fullWidth ? " w-full" : ""}`}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <h2 className="shrink-0 text-sm font-semibold text-foreground">{children}</h2>
      <div className="flex-1 border-t" />
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      Not enough data yet.
    </div>
  );
}

function NoReferrals() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      No referrals yet.
    </div>
  );
}

// ── Funnel bar chart ──────────────────────────────────────────────────────────

function FunnelBarChart({ data }: { data: FunnelPoint[] }) {
  const maxCount = data[0]?.count ?? 1;
  return (
    <div className="space-y-2.5 py-2">
      {data.map((d, i) => {
        const widthPct = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
        // Lighten the fill progressively
        const lightness = 0.49 + i * 0.055;
        const chroma    = Math.max(0.08, 0.20 - i * 0.025);
        return (
          <div key={d.stage} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
              {d.stage}
            </div>
            <div className="relative h-10 flex-1 overflow-hidden rounded-lg bg-muted/40">
              <div
                className="absolute left-0 top-0 h-full rounded-lg transition-all duration-500"
                style={{
                  width:      `${widthPct}%`,
                  background: `oklch(${lightness.toFixed(2)} ${chroma.toFixed(3)} 277)`,
                  opacity:    0.88,
                }}
              />
              <div className="absolute inset-0 flex items-center gap-2 px-3">
                <span className="relative z-10 text-sm font-bold">
                  {d.count.toLocaleString()}
                </span>
                {i > 0 && (
                  <span className="relative z-10 rounded-full border border-border/40 bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground backdrop-blur-sm">
                    {d.pct}% from prev
                  </span>
                )}
              </div>
            </div>
            <div className="w-12 shrink-0 text-right text-xs text-muted-foreground">
              {widthPct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── AI Insights panel ─────────────────────────────────────────────────────────

const INSIGHT_CONFIG: Record<
  "success" | "tip" | "alert" | "info",
  { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; iconCls: string }
> = {
  success: { icon: CheckCircle2, bg: "bg-success/10",  border: "border-success/20",  iconCls: "text-success-foreground" },
  tip:     { icon: Lightbulb,    bg: "bg-primary/8",   border: "border-primary/20",  iconCls: "text-primary"            },
  alert:   { icon: AlertCircle,  bg: "bg-warning/10",  border: "border-warning/30",  iconCls: "text-warning-foreground" },
  info:    { icon: Info,         bg: "bg-info/10",     border: "border-info/20",     iconCls: "text-info-foreground"    },
};

function AIInsightsPanel({ insights, loading }: { insights: Insight[]; loading?: boolean }) {
  if (!loading && insights.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className={`h-3.5 w-3.5 text-primary ${loading ? "animate-pulse" : ""}`} />
          </div>
          <span className="text-sm font-semibold">AI Practice Insights</span>
          {loading ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground animate-pulse">
              Analysing…
            </span>
          ) : (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {insights.length} insight{insights.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="hidden text-[10px] text-muted-foreground sm:block">
          Suggestions only · always apply clinical judgement
        </p>
      </div>

      {loading && insights.length === 0 && (
        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 px-5 py-4 animate-pulse">
              <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/5 rounded bg-muted" />
                <div className="h-3 w-4/5 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="divide-y">
          {insights.map((ins, i) => {
            const cfg  = INSIGHT_CONFIG[ins.level];
            const Icon = cfg.icon;
            return (
              <div key={i} className={`flex gap-3 px-5 py-4 ${cfg.bg}`}>
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${cfg.border} bg-background/60`}>
                  <Icon className={`h-3.5 w-3.5 ${cfg.iconCls}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{ins.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
