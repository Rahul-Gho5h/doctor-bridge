/**
 * aiInsights.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Clinical practice AI assistant.
 * Uses OpenAI (VITE_OPENAI_API_KEY) for natural-language insights.
 * Falls back to rule-based logic if no key is present or the API call fails.
 *
 * All insights are ADVISORY ONLY — they never override doctor instructions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type InsightLevel = "info" | "tip" | "alert" | "success";

export interface Insight {
  level: InsightLevel;
  title: string;
  body: string;
}

// ── OpenAI caller ─────────────────────────────────────────────────────────────

async function callOpenAI(userPrompt: string): Promise<Insight[]> {
  const key =
    (import.meta as any).env?.VITE_OPENAI_API_KEY ??
    (import.meta as any).env?.OPENAI_API_KEY;

  if (!key) return [];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "You are a clinical practice AI assistant for Doctor Bridge, a referral management platform. " +
              "Your role is to provide SUGGESTIONS, SUMMARIES, and NEXT-STEP NUDGES only — " +
              "you NEVER override, replace, or contradict a doctor's clinical judgement or patient-care instructions. " +
              "Respond strictly with JSON in this format: " +
              '{ "insights": [{ "level": "info"|"tip"|"alert"|"success", "title": "string", "body": "string" }] } ' +
              "Maximum 4 items. Each body is 1-2 sentences. Be specific and actionable.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    const items: Insight[] = parsed?.insights ?? [];
    return items
      .filter(
        (i) =>
          i &&
          ["info", "tip", "alert", "success"].includes(i.level) &&
          i.title &&
          i.body,
      )
      .slice(0, 4);
  } catch {
    return [];
  }
}

// ── Analytics insights ────────────────────────────────────────────────────────

export interface AnalyticsContext {
  sent: number;
  received: number;
  acceptance: number;
  avgResponse: number;
  topConditions: { name: string; count: number }[];
  byStatus: { name: string; value: number }[];
  trend: { month: string; sent: number; received: number }[];
}

export async function getAnalyticsInsightsAI(
  ctx: AnalyticsContext,
): Promise<Insight[]> {
  const topList = ctx.topConditions
    .slice(0, 4)
    .map((c) => `${c.name} (${c.count} cases)`)
    .join(", ");
  const statusList = ctx.byStatus
    .map((s) => `${s.name}: ${s.value}`)
    .join(", ");
  const lastTwo = ctx.trend.slice(-2);
  const trendStr =
    lastTwo.length >= 2
      ? `Last month ${lastTwo[1].sent + lastTwo[1].received} total vs previous ${lastTwo[0].sent + lastTwo[0].received}`
      : "insufficient trend data";

  const prompt = `Doctor Bridge practice analytics summary (last 6 months):
- Referrals sent: ${ctx.sent}
- Referrals received: ${ctx.received}
- Referral acceptance rate: ${ctx.acceptance}%
- Average response time: ${ctx.avgResponse > 0 ? ctx.avgResponse + "h" : "not available"}
- Top conditions referred: ${topList || "none yet"}
- Received referrals by status: ${statusList || "none"}
- Volume trend: ${trendStr}

Analyse this doctor's practice performance and provide 3-4 specific, data-driven insights. 
Include observations on: efficiency (acceptance rate, response time), workload patterns, top conditions (template suggestions), and any concerning trends.
Use level "alert" for issues needing attention, "success" for strong metrics, "tip" for efficiency suggestions, "info" for neutral observations.`;

  const aiResult = await callOpenAI(prompt);
  return aiResult.length > 0 ? aiResult : getAnalyticsInsightsFallback(ctx);
}

// ── Dashboard briefing ─────────────────────────────────────────────────────────

export interface DashboardContext {
  pendingForMe: number;
  dueReminders: number;
  upcomingAppointments: number;
  openDiscussions: number;
  encountersThisWeek: number;
  referralsSent: number;
  referralsReceived: number;
  recentUrgentCount: number;
}

export async function getDashboardBriefingAI(
  ctx: DashboardContext,
): Promise<Insight[]> {
  const prompt = `Doctor's practice status at start of session:
- Referrals awaiting my decision: ${ctx.pendingForMe}${ctx.recentUrgentCount > 0 ? ` (${ctx.recentUrgentCount} URGENT)` : ""}
- Follow-up reminders due today: ${ctx.dueReminders}
- Appointments in the next 7 days: ${ctx.upcomingAppointments}
- Open case discussions I'm part of: ${ctx.openDiscussions}
- Patient encounters logged this week: ${ctx.encountersThisWeek}
- Total referrals sent: ${ctx.referralsSent}, received: ${ctx.referralsReceived}

Generate 2-3 prioritised advisory items for the doctor's day. 
Prioritise urgent actions first (pending referrals, reminders), then awareness (appointments, discussions), then positive/motivational notes if nothing needs attention.
Keep each body to 1 concise sentence. Advisory only — no clinical decisions.`;

  const aiResult = await callOpenAI(prompt);
  return aiResult.length > 0 ? aiResult : getDashboardBriefingFallback(ctx);
}

// ── Rule-based fallbacks (used when OpenAI key is absent or call fails) ────────

function getAnalyticsInsightsFallback(ctx: AnalyticsContext): Insight[] {
  const insights: Insight[] = [];
  const total = ctx.sent + ctx.received;

  if (ctx.acceptance >= 90)
    insights.push({ level: "success", title: "High acceptance rate", body: `Your ${ctx.acceptance}% acceptance rate is excellent — specialists are acting on your referrals promptly.` });
  else if (ctx.acceptance > 0 && ctx.acceptance < 70)
    insights.push({ level: "alert", title: "Acceptance rate below average", body: `Your ${ctx.acceptance}% acceptance rate is lower than typical. More detailed clinical summaries often improve uptake.` });

  if (ctx.avgResponse > 24)
    insights.push({ level: "alert", title: `Response time: ${ctx.avgResponse.toFixed(0)}h average`, body: "Following up on unacknowledged referrals reduces delays in patient care." });
  else if (ctx.avgResponse > 0 && ctx.avgResponse < 4)
    insights.push({ level: "success", title: "Excellent responsiveness", body: `Responding in under ${ctx.avgResponse.toFixed(0)}h on average — well within best-practice thresholds.` });

  if (ctx.topConditions.length > 0) {
    const top = ctx.topConditions[0];
    const pct = total > 0 ? Math.round((top.count / total) * 100) : 0;
    insights.push({ level: "info", title: `Top condition: ${top.name}`, body: `"${top.name}" is ${pct}% of your caseload (${top.count} cases).${pct > 25 ? " Consider saving a referral template for this condition." : ""}` });
  }

  const unactioned = (ctx.byStatus.find(s => s.name === "Sent")?.value ?? 0) + (ctx.byStatus.find(s => s.name === "Viewed")?.value ?? 0);
  if (unactioned >= 2)
    insights.push({ level: "alert", title: `${unactioned} referrals need follow-up`, body: "These received referrals have no response yet. A brief follow-up can reduce patient waiting times." });

  return insights.slice(0, 4);
}

function getDashboardBriefingFallback(ctx: DashboardContext): Insight[] {
  const items: Insight[] = [];

  if (ctx.pendingForMe > 0)
    items.push({ level: "alert", title: `${ctx.pendingForMe} referral${ctx.pendingForMe > 1 ? "s" : ""} awaiting your decision`, body: ctx.recentUrgentCount > 0 ? `${ctx.recentUrgentCount} ${ctx.recentUrgentCount > 1 ? "are" : "is"} marked Urgent — review these first to prevent delays in patient care.` : "Timely acknowledgement keeps the referring doctor and patient informed." });

  if (ctx.dueReminders > 0)
    items.push({ level: "alert", title: `${ctx.dueReminders} follow-up reminder${ctx.dueReminders > 1 ? "s" : ""} due today`, body: "Review the relevant referrals and patient notes before reaching out." });

  if (ctx.upcomingAppointments > 0)
    items.push({ level: "info", title: `${ctx.upcomingAppointments} appointment${ctx.upcomingAppointments > 1 ? "s" : ""} this week`, body: "Reviewing referral notes before each appointment supports continuity of care." });

  if (items.length === 0)
    items.push(ctx.encountersThisWeek > 0
      ? { level: "success", title: `${ctx.encountersThisWeek} encounters logged this week`, body: "Well-documented encounters support better referral context and continuity of care." }
      : { level: "tip", title: "No pending actions right now", body: "A good time to review your patient list for proactive follow-ups, or update your availability." });

  return items.slice(0, 3);
}
