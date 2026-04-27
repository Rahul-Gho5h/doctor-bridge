import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Sparkles, CheckCircle2, Lightbulb, AlertCircle, Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { AnalyticsSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAnalyticsInsightsAI, type Insight } from "@/lib/aiInsights";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Doctor Bridge" }] }),
  component: AnalyticsPage,
});

const COLORS = [
  "oklch(0.49 0.20 277)", "oklch(0.65 0.16 152)", "oklch(0.78 0.16 75)",
  "oklch(0.65 0.13 230)", "oklch(0.55 0.22 27)",  "oklch(0.55 0.10 320)",
];

// Friendly status labels for the pie chart
const STATUS_LABEL: Record<string, string> = {
  SENT:        "Sent",
  VIEWED:      "Viewed",
  ACKNOWLEDGED:"Acknowledged",
  ACCEPTED:    "Accepted",
  DECLINED:    "Declined",
  COMPLETED:   "Completed",
};

function AnalyticsPage() {
  const { user } = useAuth();

  const [loading, setLoading]             = useState(true);
  const [hasData, setHasData]             = useState(false);
  const [trend, setTrend]                 = useState<{ month: string; sent: number; received: number }[]>([]);
  const [byStatus, setByStatus]           = useState<{ name: string; value: number }[]>([]);
  const [topConditions, setTopConditions] = useState<{ name: string; count: number }[]>([]);
  const [responseTime, setResponseTime]   = useState<{ week: string; hours: number }[]>([]);
  const [summary, setSummary]             = useState({
    sent: 0, received: 0, acceptance: 0, avgResponse: 0,
  });
  const [analyticsInsights, setAnalyticsInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading]     = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data: myDoc } = await supabase
        .from("doctor_profiles")
        .select("id,referral_acceptance_rate,avg_response_time_hours")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!myDoc) { setLoading(false); return; }

      // ── 6-month window ────────────────────────────────────────────────────
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const [{ data: refs }, { data: refsRecv }] = await Promise.all([
        supabase
          .from("referrals")
          .select("created_at,status,primary_diagnosis,sent_at,accepted_at")
          .eq("referring_doctor_id", myDoc.id)
          .gte("created_at", since.toISOString()),
        supabase
          .from("referrals")
          .select("created_at,status,primary_diagnosis,sent_at,accepted_at")
          .eq("specialist_id", myDoc.id)
          .gte("created_at", since.toISOString()),
      ]);

      if (cancelled) return;

      const sentList = refs     ?? [];
      const recvList = refsRecv ?? [];
      const total    = sentList.length + recvList.length;
      setHasData(total > 0);

      // ── Monthly trend ─────────────────────────────────────────────────────
      const months = new Map<string, { sent: number; received: number }>();
      for (let i = 0; i < 6; i++) {
        const d = new Date(since);
        d.setMonth(since.getMonth() + i);
        months.set(d.toISOString().slice(0, 7), { sent: 0, received: 0 });
      }
      sentList.forEach((r: any) => {
        const k = (r.created_at as string).slice(0, 7);
        const m = months.get(k); if (m) m.sent++;
      });
      recvList.forEach((r: any) => {
        const k = (r.created_at as string).slice(0, 7);
        const m = months.get(k); if (m) m.received++;
      });
      setTrend(
        Array.from(months.entries()).map(([k, v]) => ({
          month: new Date(k + "-01").toLocaleString("en-IN", { month: "short", year: "2-digit" }),
          ...v,
        })),
      );

      // ── Status breakdown (received referrals) ─────────────────────────────
      const statusMap = new Map<string, number>();
      recvList.forEach((r: any) =>
        statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1),
      );
      setByStatus(
        Array.from(statusMap.entries()).map(([name, value]) => ({
          name: STATUS_LABEL[name] ?? name,
          value,
        })),
      );

      // ── Top conditions (sent + received) ─────────────────────────────────
      const cond = new Map<string, number>();
      [...sentList, ...recvList].forEach((r: any) => {
        const k = ((r.primary_diagnosis ?? "Unknown") as string).slice(0, 32);
        cond.set(k, (cond.get(k) ?? 0) + 1);
      });
      setTopConditions(
        Array.from(cond.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, count]) => ({ name, count })),
      );

      // ── Response time — last 8 weeks (using accepted_at, not acknowledged_at) ──
      const nowMs = Date.now();
      const weekBuckets: {
        label: string; startMs: number; endMs: number; sum: number; n: number;
      }[] = [];
      for (let i = 7; i >= 0; i--) {
        const startMs = nowMs - (i + 1) * 7 * 86_400_000;
        const endMs   = nowMs - i       * 7 * 86_400_000;
        const label   = new Date(startMs).toLocaleDateString("en-IN", {
          day: "numeric", month: "short",
        });
        weekBuckets.push({ label, startMs, endMs, sum: 0, n: 0 });
      }
      recvList.forEach((r: any) => {
        if (!r.sent_at || !r.accepted_at) return;
        const sentMs = new Date(r.sent_at).getTime();
        const hrs    = (new Date(r.accepted_at).getTime() - sentMs) / 3_600_000;
        if (hrs < 0) return; // guard against bad data
        const bucket = weekBuckets.find(
          (b) => sentMs >= b.startMs && sentMs < b.endMs,
        );
        if (bucket) { bucket.sum += hrs; bucket.n++; }
      });
      setResponseTime(
        weekBuckets.map((b) => ({
          week:  b.label,
          hours: b.n ? +(b.sum / b.n).toFixed(1) : 0,
        })),
      );

      // ── Summary KPIs ──────────────────────────────────────────────────────
      setSummary({
        sent:        sentList.length,
        received:    recvList.length,
        acceptance:  myDoc.referral_acceptance_rate ?? 0,
        avgResponse: myDoc.avg_response_time_hours  ?? 0,
      });

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  // AI Insights — async OpenAI call, fires once data is loaded
  useEffect(() => {
    if (loading || !hasData) return;
    let cancelled = false;
    setInsightsLoading(true);
    getAnalyticsInsightsAI({ sent: summary.sent, received: summary.received, acceptance: summary.acceptance, avgResponse: summary.avgResponse, topConditions, byStatus, trend })
      .then((result) => { if (!cancelled) { setAnalyticsInsights(result); setInsightsLoading(false); } });
    return () => { cancelled = true; };
  }, [loading, hasData, summary, topConditions, byStatus, trend]);

  return (
    <ErrorBoundary>
    <DashboardLayout>
      <PageHeader
        title="Analytics"
        description="Your practice metrics and referral performance over time."
      />

      {loading ? (
        <AnalyticsSkeleton />
      ) : !hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="No data yet"
          description="Analytics will appear once you've sent or received referrals. Come back after your first referral."
        />
      ) : (
        <>
          {/* ── AI Insights ─────────────────────────────────────────────────── */}
          <AIInsightsPanel insights={analyticsInsights} loading={insightsLoading} />
          {/* ── KPI row ───────────────────────────────────────────────────── */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPI label="Referrals sent (6mo)"     value={String(summary.sent)}          />
            <KPI label="Referrals received (6mo)" value={String(summary.received)}      />
            <KPI label="Acceptance rate"          value={`${summary.acceptance}%`}      />
            <KPI label="Avg response time"        value={
              summary.avgResponse ? `${summary.avgResponse}h` : "—"
            } />
          </div>

          {/* ── Charts ────────────────────────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">

            <Card title="Referrals — sent vs received (6 months)">
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
            </Card>

            <Card title="Received referrals by status">
              {byStatus.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={byStatus}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {byStatus.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Top conditions referred (6 months)">
              {topConditions.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topConditions} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                    <XAxis type="number" fontSize={11} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" fontSize={11} width={148} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" name="Cases" fill={COLORS[0]} radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Avg response time — last 8 weeks">
              {responseTime.every((w) => w.hours === 0) ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={responseTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                    <XAxis dataKey="week" fontSize={11} />
                    <YAxis fontSize={11} unit="h" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}h`, "Avg response"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke={COLORS[3]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

          </div>
        </>
      )}
    </DashboardLayout>
    </ErrorBoundary>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
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

// ── AI Insights panel ────────────────────────────────────────────────────────

const INSIGHT_CONFIG: Record<
  Insight["level"],
  { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; iconCls: string }
> = {
  success: { icon: CheckCircle2, bg: "bg-success/10",  border: "border-success/20",  iconCls: "text-success-foreground" },
  tip:     { icon: Lightbulb,    bg: "bg-primary/8",   border: "border-primary/20",  iconCls: "text-primary" },
  alert:   { icon: AlertCircle,  bg: "bg-warning/10",  border: "border-warning/30",  iconCls: "text-warning-foreground" },
  info:    { icon: Info,         bg: "bg-info/10",     border: "border-info/20",     iconCls: "text-info-foreground" },
};

function AIInsightsPanel({ insights, loading }: { insights: Insight[]; loading?: boolean }) {
  if (!loading && insights.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className={`h-3.5 w-3.5 text-primary ${loading ? "animate-pulse" : ""}`} />
          </div>
          <span className="text-sm font-semibold">AI Practice Insights</span>
          {loading ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground animate-pulse">Analysing…</span>
          ) : (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {insights.length} insight{insights.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          Suggestions only · always apply clinical judgement
        </p>
      </div>
      {/* Loading shimmer */}
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
      {/* Insights list */}
      {insights.length > 0 && (
        <div className="divide-y">
          {insights.map((ins, i) => {
            const cfg = INSIGHT_CONFIG[ins.level];
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
