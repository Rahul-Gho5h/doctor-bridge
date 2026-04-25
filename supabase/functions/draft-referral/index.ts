// draft-referral Edge Function
// Takes patient snapshot, EMR history, diagnosis, and specialist context.
// Calls OpenAI (gpt-4o-mini) to draft a clinical summary + referral reason.
// Falls back to a structured template if OPENAI_API_KEY is not set (dev mode).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Encounter {
  type: string;
  title: string;
  details: string | null;
  occurred_at: string;
  hospital_name: string | null;
}

interface DraftRequest {
  patient: {
    name: string;
    age: number;
    gender: string;
    chronic_conditions: string[];
    phone?: string;
  };
  diagnosis: string;
  condition_code?: string;
  urgency: string;
  specialist_specialization: string;
  encounters: Encounter[];  // recent EMR entries for this patient
  referring_doctor_name: string;
}

interface DraftResponse {
  clinical_summary: string;
  referral_reason: string;
  mock?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as DraftRequest;
    const { patient, diagnosis, condition_code, urgency, specialist_specialization, encounters, referring_doctor_name } = body;

    if (!patient || !diagnosis) {
      return new Response(
        JSON.stringify({ error: "patient and diagnosis are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    // ── DEV / MOCK MODE ──────────────────────────────────────────────────────
    if (!apiKey) {
      const mockResponse: DraftResponse = {
        clinical_summary: buildMockSummary(patient, diagnosis, encounters),
        referral_reason: buildMockReason(diagnosis, specialist_specialization, urgency),
        mock: true,
      };
      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PRODUCTION: call OpenAI ───────────────────────────────────────────────
    const encounterText = encounters.length > 0
      ? encounters
          .slice(0, 8)
          .map((e) =>
            `- [${e.type}] ${new Date(e.occurred_at).toLocaleDateString("en-IN")} · ${e.title}${e.details ? `: ${e.details}` : ""}${e.hospital_name ? ` (at ${e.hospital_name})` : ""}`
          )
          .join("\n")
      : "No prior clinical encounters on record.";

    const systemPrompt = `You are a clinical assistant helping an Indian doctor write structured specialist referrals. Always respond with valid JSON only — no markdown, no extra text.`;

    const userPrompt = `Write a specialist referral for the following patient.

PATIENT:
- Name: ${patient.name}
- Age: ${patient.age} years, ${patient.gender}
- Chronic conditions: ${patient.chronic_conditions.length > 0 ? patient.chronic_conditions.join(", ") : "None recorded"}

REFERRAL DETAILS:
- Primary diagnosis: ${diagnosis}${condition_code ? ` (ICD-10: ${condition_code})` : ""}
- Urgency: ${urgency}
- Referring to: ${specialist_specialization} specialist
- Referring doctor: ${referring_doctor_name}

RECENT CLINICAL HISTORY (EMR):
${encounterText}

Write two sections:

1. CLINICAL SUMMARY (3-5 sentences): Summarise the patient's relevant history, current presentation, key findings, and any medications/investigations already done. Be specific and factual. Use medical terminology appropriate for a specialist.

2. REASON FOR REFERRAL (2-3 sentences): State clearly what clinical question or management you need the specialist's help with. Be specific about what you want them to do.

Respond with this JSON structure only:
{"clinical_summary": "...", "referral_reason": "..."}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 600,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI API error:", errText);
      return new Response(
        JSON.stringify({
          ...buildMockDraft(patient, diagnosis, encounters, specialist_specialization, urgency),
          mock: true,
          fallback_reason: "AI service temporarily unavailable",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiJson = await openaiRes.json();
    const rawText = openaiJson?.choices?.[0]?.message?.content ?? "";

    // Parse the JSON OpenAI returned
    let parsed: { clinical_summary: string; referral_reason: string };
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        clinical_summary: rawText,
        referral_reason: buildMockReason(diagnosis, specialist_specialization, urgency),
      };
    }

    return new Response(
      JSON.stringify({ clinical_summary: parsed.clinical_summary, referral_reason: parsed.referral_reason }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("draft-referral error:", message);
    return new Response(
      JSON.stringify({ error: "Draft service unavailable. Please write the referral manually." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Mock / fallback helpers ───────────────────────────────────────────────────

function buildMockSummary(
  patient: DraftRequest["patient"],
  diagnosis: string,
  encounters: Encounter[],
): string {
  const chronic = patient.chronic_conditions.length > 0
    ? ` Known comorbidities include ${patient.chronic_conditions.join(", ")}.`
    : "";

  const recentEnc = encounters.slice(0, 2).map((e) => e.title).join("; ");
  const historyLine = recentEnc
    ? ` Recent clinical entries include: ${recentEnc}.`
    : " No prior specialist encounters on record.";

  return `${patient.name} is a ${patient.age}-year-old ${patient.gender.toLowerCase()} presenting with ${diagnosis}.${chronic}${historyLine} I am referring this patient for further evaluation and management of the above condition. All relevant investigations and clinical notes are attached.`;
}

function buildMockReason(diagnosis: string, specialization: string, urgency: string): string {
  const urgencyText = urgency === "URGENT"
    ? "urgently"
    : urgency === "SEMI_URGENT"
    ? "at your earliest convenience"
    : "at a routine appointment";

  return `I would appreciate your expert assessment and management of this patient's ${diagnosis} ${urgencyText}. Please advise on further investigations, treatment plan, and any procedural intervention you consider appropriate. Kindly communicate your findings back to me following the consultation.`;
}

function buildMockDraft(
  patient: DraftRequest["patient"],
  diagnosis: string,
  encounters: Encounter[],
  specialization: string,
  urgency: string,
): DraftResponse {
  return {
    clinical_summary: buildMockSummary(patient, diagnosis, encounters),
    referral_reason: buildMockReason(diagnosis, specialization, urgency),
  };
}
