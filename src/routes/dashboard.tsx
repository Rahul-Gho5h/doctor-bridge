import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, Send, Inbox, Clock, AlertTriangle, Activity,
  CalendarClock, Bell, GraduationCap, MessageSquareMore, ArrowRight, ArrowUpRight,
  Sparkles, CheckCircle2, Lightbulb, AlertCircle, Info,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UrgencyBadge } from "@/components/common/UrgencyBadge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { relativeTime, formatDateTime } from "@/lib/format";
import { getDashboardBriefingAI, type Insight } from "@/lib/aiInsights";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Doctor Bridge" }] }),
  component: Dashboard,
});

interface KPI {
  patients: number;
  encountersThisWeek: number;
  referralsSent: number;
  referralsReceived: number;
  pendingForMe: number;          // specialist: referrals awaiting my accept/decline
  upcomingAppointments: number;  // referrals with appointment_date in next 7 days
  cmeThisYear: number;           // CME credits earned this year
  openDiscussions: number;       // active case discussions I'm in
}

interface TrendPoint { date: string; sent: number; received: number }

interface RecentReferral {
  id: string; referral_number: string; status: string;
  urgency: string; primary_diagnosis: string;
  referral_type: string | null; created_at: string;
}

interface UpcomingAppt {
  id: string; referral_number: string; primary_diagnosis: string;
  appointment_date: string; appointment_notes: string | null;
  patient_snapshot: { name?: string } | null;
}

interface DueReminder {
  id: string; message: string; referral_id: string; remind_at: string;
}

function Dashboard() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPI>({
    patients: 0, encountersThisWeek: 0, referralsSent: 0, referralsReceived: 0,
    pendingForMe: 0, upcomingAppointments: 0, cmeThisYear: 0, openDiscussions: 0,
  });
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<RecentReferral[]>([]);
  const [recentEncounters, setRecentEncounters] = useState<{ id: string; title: string; type: string; occurred_at: string; global_patient_id: string }[]>([]);
  const [upcomingAppts, setUpcomingAppts] = useState<UpcomingAppt[]>([]);
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const [briefing, setBriefing] = useState<Insight[]>([]);
  const [briefingLoading, setBriefingLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date();
      const since30 = new Date(now); since30.setDate(now.getDate() - 29); since30.setHours(0, 0, 0, 0);
      const since7  = new Date(now); since7.setDate(now.getDate() - 7);
      const next7   = new Date(now); next7.setDate(now.getDate() + 7);
      const yearStart = `${now.getFullYear()}-01-01`;

      const { data: myDoc } = await supabase
        .from("doctor_profiles").select("id").eq("user_id", user.id).maybeSingle();

      // ── Parallel queries ──────────────────────────────────────────────────────
      const [
        { count: patients },
        { count: encWeek },
        { data: trendSent },
        { data: trendReceived },
        { data: recentEnc },
      ] = await Promise.all([
        supabase.from("global_patients").select("id", { count: "exact", head: true }),
        supabase.from("patient_encounters")
          .select("id", { count: "exact", head: true })
          .eq("doctor_user_id", user.id)
          .gte("occurred_at", since7.toISOString()),
        myDoc?.id
          ? supabase.from("referrals").select("created_at")
              .eq("referring_doctor_id", myDoc.id)
              .gte("created_at", since30.toISOString())
          : Promise.resolve({ data: [], error: null } as any),
        myDoc?.id
          ? supabase.from("referrals").select("created_at")
              .eq("specialist_id", myDoc.id)
              .gte("created_at", since30.toISOString())
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("patient_encounters")
          .select("id,title,type,occurred_at,global_patient_id")
          .eq("doctor_user_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(5),
      ]);

      // ── Doctor-specific queries ───────────────────────────────────────────────
      let sent = 0, received = 0, pendingForMe = 0, upcomingApptCount = 0;
      let cmeCredits = 0, openDisc = 0;
      let recentRefs: RecentReferral[] = [];
      let upcomingApptRows: UpcomingAppt[] = [];

      if (myDoc?.id) {
        const [
          { count: s },
          { count: r },
          { count: p },
          { count: apptCount },
          { data: refs },
          { data: appts },
          { data: cme },
        ] = await Promise.all([
          supabase.from("referrals").select("id", { count: "exact", head: true })
            .eq("referring_doctor_id", myDoc.id),
          supabase.from("referrals").select("id", { count: "exact", head: true })
            .eq("specialist_id", myDoc.id),
          // Referrals I need to act on as specialist
          supabase.from("referrals").select("id", { count: "exact", head: true })
            .eq("specialist_id", myDoc.id)
            .in("status", ["SENT", "VIEWED", "ACKNOWLEDGED"]),
          // My upcoming scheduled appointments
          supabase.from("referrals").select("id", { count: "exact", head: true })
            .or(`referring_doctor_id.eq.${myDoc.id},specialist_id.eq.${myDoc.id}`)
            .gte("appointment_date", now.toISOString())
            .lte("appointment_date", next7.toISOString()),
          // Recent referrals (both sent and received)
          supabase.from("referrals")
            .select("id,referral_number,status,urgency,primary_diagnosis,referral_type,created_at")
            .or(`referring_doctor_id.eq.${myDoc.id},specialist_id.eq.${myDoc.id}`)
            .order("created_at", { ascending: false })
            .limit(6),
          // Upcoming appointments detail
          supabase.from("referrals")
            .select("id,referral_number,primary_diagnosis,appointment_date,appointment_notes,patient_snapshot")
            .or(`referring_doctor_id.eq.${myDoc.id},specialist_id.eq.${myDoc.id}`)
            .gte("appointment_date", now.toISOString())
            .lte("appointment_date", next7.toISOString())
            .order("appointment_date")
            .limit(5),
          // CME credits this year
          supabase.from("cme_activities")
            .select("credits")
            .eq("doctor_id", myDoc.id)
            .gte("activity_date", yearStart),
        ]);

        sent = s ?? 0; received = r ?? 0; pendingForMe = p ?? 0; upcomingApptCount = apptCount ?? 0;
        recentRefs = (refs ?? []) as RecentReferral[];
        upcomingApptRows = (appts ?? []) as UpcomingAppt[];
        cmeCredits = (cme ?? []).reduce((acc: number, a: any) => acc + Number(a.credits), 0);
      }

      // Open case discussions
      if (user) {
        const { data: partOf } = await supabase
          .from("case_discussion_participants")
          .select("discussion_id")
          .eq("user_id", user.id);
        const participantIds = (partOf ?? []).map((p: any) => p.discussion_id as string);

        // Build an OR filter: discussions I created OR I'm a participant in
        let discQuery = supabase
          .from("case_discussions")
          .select("id", { count: "exact", head: true })
          .eq("status", "OPEN");

        if (participantIds.length > 0) {
          discQuery = discQuery.or(
            `created_by.eq.${user.id},id.in.(${participantIds.join(",")})`
          );
        } else {
          discQuery = discQuery.eq("created_by", user.id);
        }

        const { count: dc } = await discQuery;
        openDisc = dc ?? 0;
      }

      // Due reminders (next 24 hours, not yet fired)
      const next24 = new Date(now); next24.setDate(now.getDate() + 1);
      const { data: reminders } = await supabase
        .from("follow_up_reminders")
        .select("id,message,referral_id,remind_at")
        .eq("created_by", user.id)
        .lte("remind_at", next24.toISOString())
        .is("fired_at", null)
        .order("remind_at")
        .limit(5);

      // ── Build 30-day trend ────────────────────────────────────────────────────
      const buckets = new Map<string, { sent: number; received: number }>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(since30); d.setDate(since30.getDate() + i);
        buckets.set(d.toISOString().slice(0, 10), { sent: 0, received: 0 });
      }
      (trendSent ?? []).forEach((r: any) => {
        const k = (r.created_at as string).slice(0, 10);
        const b = buckets.get(k); if (b) b.sent++;
      });
      (trendReceived ?? []).forEach((r: any) => {
        const k = (r.created_at as string).slice(0, 10);
        const b = buckets.get(k); if (b) b.received++;
      });

      setTrend(
        Array.from(buckets.entries())
          .map(([date, v]) => ({ date: date.slice(5), ...v }))
      );
      setKpi({
        patients: patients ?? 0,
        encountersThisWeek: encWeek ?? 0,
        referralsSent: sent,
        referralsReceived: received,
        pendingForMe,
        upcomingAppointments: upcomingApptCount,
        cmeThisYear: Math.round(cmeCredits * 10) / 10,
        openDiscussions: openDisc,
      });
      setRecentReferrals(recentRefs);
      setRecentEncounters((recentEnc ?? []) as any);
      setUpcomingAppts(upcomingApptRows);
      setDueReminders((reminders ?? []) as DueReminder[]);
      setLoading(false);
    })();
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // AI Briefing — fires once data has loaded, calls OpenAI with graceful fallback
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setBriefingLoading(true);
    getDashboardBriefingAI({
      pendingForMe:         kpi.pendingForMe,
      dueReminders:         dueReminders.length,
      upcomingAppointments: kpi.upcomingAppointments,
      openDiscussions:      kpi.openDiscussions,
      encountersThisWeek:   kpi.encountersThisWeek,
      referralsSent:        kpi.referralsSent,
      referralsReceived:    kpi.referralsReceived,
      recentUrgentCount:    recentReferrals.filter((r) => r.urgency === "URGENT").length,
    }).then((result) => {
      if (!cancelled) { setBriefing(result); setBriefingLoading(false); }
    });
    return () => { cancelled = true; };
  }, [loading, kpi, dueReminders, recentReferrals]);

  if (loading) {
    return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;
  }

  const kpiCards = [
    { label: "Total Patients",         value: kpi.patients,              icon: Users,            to: "/patients"    as const, accent: "bg-primary/10 text-primary" },
    { label: "Referrals Sent",         value: kpi.referralsSent,         icon: Send,             to: "/referrals"   as const, accent: "bg-info/10 text-info-foreground" },
    { label: "Referrals Received",     value: kpi.referralsReceived,     icon: Inbox,            to: "/referrals"   as const, accent: "bg-success/15 text-success-foreground" },
    { label: "Awaiting My Action",     value: kpi.pendingForMe,          icon: Clock,            to: "/referrals"   as const, accent: kpi.pendingForMe > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground" },
    { label: "Encounters This Week",   value: kpi.encountersThisWeek,    icon: Activity,         to: "/emr"         as const, accent: "bg-primary/10 text-primary" },
    { label: "Upcoming Appointments",  value: kpi.upcomingAppointments,  icon: CalendarClock,    to: "/referrals"   as const, accent: "bg-warning/10 text-warning-foreground" },
    { label: "Open Discussions",       value: kpi.openDiscussions,       icon: MessageSquareMore,to: "/discussions" as const, accent: "bg-info/10 text-info-foreground" },
    { label: "CME Credits (YTD)",      value: kpi.cmeThisYear,           icon: GraduationCap,    to: "/cme"         as const, accent: "bg-accent text-accent-foreground" },
  ];

  // Attention items: things that need action now
  const attentionItems: { label: string; to: string; count: number; color: string }[] = [];
  if (kpi.pendingForMe > 0)      attentionItems.push({ label: `${kpi.pendingForMe} referral${kpi.pendingForMe > 1 ? "s" : ""} awaiting your decision`, to: "/referrals", count: kpi.pendingForMe, color: "border-destructive/30 bg-destructive/10 text-destructive font-semibold" });
  if (dueReminders.length > 0)   attentionItems.push({ label: `${dueReminders.length} reminder${dueReminders.length > 1 ? "s" : ""} due within 24 hours`, to: "/referrals", count: dueReminders.length, color: "border-warning/40 bg-warning/10 text-warning font-semibold" });
  if (kpi.openDiscussions > 0)   attentionItems.push({ label: `${kpi.openDiscussions} open case discussion${kpi.openDiscussions > 1 ? "s" : ""}`, to: "/discussions", count: kpi.openDiscussions, color: "border-primary/20 bg-primary-soft/30 text-accent-foreground font-semibold" });


  return (
    <ErrorBoundary>
      <DashboardLayout>

        {/* ── Hero greeting ───────────────────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="relative px-6 py-6 sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{today}</p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
                  {greeting}{profile ? `, Dr. ${profile.first_name}` : ""}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground max-w-lg">
                  {kpi.pendingForMe > 0
                    ? `You have ${kpi.pendingForMe} referral${kpi.pendingForMe > 1 ? "s" : ""} awaiting your decision.`
                    : kpi.referralsReceived > 0
                    ? `${kpi.referralsReceived} referrals received · ${kpi.referralsSent} sent · ${kpi.encountersThisWeek} encounters this week.`
                    : "Welcome to your practice dashboard."}
                </p>
              </div>
              <Link
                to="/referrals/new"
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
              >
                <Send className="h-4 w-4" /> New Referral
              </Link>
            </div>
          </div>
          {attentionItems.length > 0 && (
            <div className="border-t divide-y">
              {attentionItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to as any}
                  className={`flex items-center justify-between px-6 py-2.5 text-xs font-medium transition-colors hover:opacity-80 sm:px-8 ${item.color}`}
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── AI Briefing ──────────────────────────────────────────────────────── */}
        {briefing.length > 0 && <AIBriefingCard insights={briefing} />}

        {/* ── KPI Metrics ─────────────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpiCards.map(({ label, value, icon: Icon, to, accent }) => (
            <Link
              key={label}
              to={to}
              className="group flex flex-col justify-between rounded-xl border bg-card p-4 shadow-card transition-all hover:border-primary/30 hover:shadow-elevated"
            >
              <div className="flex items-start justify-between">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground/50" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
                <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Referral Activity Chart ───────────────────────────────────────── */}
        <div className="mb-6 rounded-2xl border bg-card p-6 shadow-card transition-all hover:shadow-md">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Referral Activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">Volume sent and received over the last 30 days</p>
            </div>
            <div className="flex items-center gap-5 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />Sent</span>
              <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-success" />Received</span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" opacity={0.5} vertical={false} />
                <XAxis 
                  dataKey="date" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: "var(--muted-foreground)" }} 
                  dy={10}
                  interval={4} 
                />
                <YAxis 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: "var(--muted-foreground)" }} 
                  dx={-10}
                  allowDecimals={false} 
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
                          <p className="mb-2 text-xs font-semibold text-foreground">{label}</p>
                          <div className="flex flex-col gap-1.5">
                            {payload.map((entry: any) => (
                              <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  {entry.name === "sent" ? "Sent" : "Received"}
                                </span>
                                <span className="font-semibold text-foreground tabular-nums">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.4 }}
                />
                <Area 
                  type="natural" 
                  dataKey="sent" 
                  stroke="var(--primary)" 
                  fill="url(#gSent)" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 5, strokeWidth: 0, fill: "var(--primary)" }} 
                  name="sent" 
                  animationDuration={1500}
                />
                <Area 
                  type="natural" 
                  dataKey="received" 
                  stroke="var(--success)" 
                  fill="url(#gRec)" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 5, strokeWidth: 0, fill: "var(--success)" }} 
                  name="received" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Upcoming appointments ────────────────────────────────────────────── */}
        {upcomingAppts.length > 0 && (
          <div className="mb-6 rounded-xl border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Upcoming Appointments</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Next 7 days</p>
              </div>
              <Link to="/referrals" className="text-xs font-medium text-primary hover:underline">View all →</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingAppts.map((a) => (
                <Link
                  key={a.id}
                  to="/referrals/$referralId"
                  params={{ referralId: a.id }}
                  className="group rounded-xl border bg-muted/20 p-4 transition-all hover:border-primary/40 hover:bg-card hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-primary">{formatDateTime(a.appointment_date)}</div>
                      <div className="mt-0.5 truncate text-sm font-semibold">{a.patient_snapshot?.name ?? "Patient"}</div>
                      <div className="truncate text-xs text-muted-foreground">{a.primary_diagnosis}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Due reminders ────────────────────────────────────────────────────── */}
        {dueReminders.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-xl border border-warning/40 bg-card shadow-card">
            <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-6 py-3">
              <Bell className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold text-foreground">Reminders Due Soon</span>
            </div>
            <ul className="divide-y">
              {dueReminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                  <span className="font-medium text-foreground">{r.message}</span>
                  <span className="shrink-0 text-xs font-medium text-warning">{relativeTime(r.remind_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Recent referrals + Clinical entries ──────────────────────────────── */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {/* Recent referrals */}
          <div className="rounded-xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold">Recent Referrals</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Sent and received</p>
              </div>
              <Link to="/referrals" className="text-xs font-medium text-primary hover:underline">View all →</Link>
            </div>
            {recentReferrals.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No referrals yet.{" "}
                <Link to="/referrals/new" className="font-medium text-primary hover:underline">Send one now →</Link>
              </div>
            ) : (
              <ul className="divide-y">
                {recentReferrals.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/referrals/$referralId"
                      params={{ referralId: r.id }}
                      className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{r.referral_number}</span>
                          {r.referral_type === "SECOND_OPINION" && (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                              2nd opinion
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-medium">{r.primary_diagnosis}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={r.status} />
                        <span className="text-[10px] text-muted-foreground">{relativeTime(r.created_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent clinical entries */}
          <div className="rounded-xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold">Recent Clinical Entries</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">My latest encounters</p>
              </div>
              <Link to="/emr" className="text-xs font-medium text-primary hover:underline">View all →</Link>
            </div>
            {recentEncounters.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No entries yet.{" "}
                <Link to="/patients" className="font-medium text-primary hover:underline">Open a patient →</Link>
              </div>
            ) : (
              <ul className="divide-y">
                {recentEncounters.map((e) => (
                  <li key={e.id}>
                    <Link
                      to="/patients/$patientId"
                      params={{ patientId: e.global_patient_id }}
                      className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success-foreground">
                          <Activity className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{e.title}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.type.replace(/_/g, " ")}</div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(e.occurred_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── CME progress ─────────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">CME / CPD Progress</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{new Date().getFullYear()} · NMC renewal tracker</p>
            </div>
            <Link to="/cme" className="text-xs font-medium text-primary hover:underline">Manage →</Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Annual target</span>
                <span className="font-semibold tabular-nums">{kpi.cmeThisYear} / 6 credits</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${kpi.cmeThisYear >= 6 ? "bg-success" : kpi.cmeThisYear >= 3 ? "bg-primary" : "bg-warning"}`}
                  style={{ width: `${Math.min(100, (kpi.cmeThisYear / 6) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {kpi.cmeThisYear >= 6 ? "✓ Annual target met" : `${(6 - kpi.cmeThisYear).toFixed(1)} credits to annual goal`}
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">NMC 5-year cycle</span>
                <span className="font-semibold tabular-nums">{kpi.cmeThisYear} / 30 credits</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${kpi.cmeThisYear >= 30 ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (kpi.cmeThisYear / 30) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {kpi.cmeThisYear >= 30 ? "✓ NMC renewal target met" : `${(30 - kpi.cmeThisYear).toFixed(1)} credits remaining`}
              </p>
            </div>
          </div>
        </div>

      </DashboardLayout>
    </ErrorBoundary>
  );
}
// ── AI Briefing card ─────────────────────────────────────────────────────────

const BRIEF_CONFIG: Record<
  Insight["level"],
  { icon: React.ComponentType<{ className?: string }>; dot: string; label: string }
> = {
  alert:   { icon: AlertCircle,  dot: "bg-warning",         label: "text-warning-foreground" },
  info:    { icon: Info,         dot: "bg-info-foreground",  label: "text-info-foreground" },
  tip:     { icon: Lightbulb,    dot: "bg-primary",          label: "text-primary" },
  success: { icon: CheckCircle2, dot: "bg-success-foreground",label: "text-success-foreground" },
};

function AIBriefingCard({ insights }: { insights: Insight[] }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Briefing</span>
        <span className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
          Suggestions only · always apply clinical judgement
        </span>
      </div>
      <div className="divide-y">
        {insights.map((ins, i) => {
          const cfg = BRIEF_CONFIG[ins.level];
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.label}`} />
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">{ins.title}</span>
                {" "}
                <span className="text-xs text-muted-foreground">{ins.body}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
