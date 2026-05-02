const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // We'll tighten this across all functions next
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InsightRequest {
  prompt: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as InsightRequest;
    const { prompt } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key missing from environment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = 
      "You are a clinical practice AI assistant for Doctor Bridge, a referral management platform. " +
      "Your role is to provide SUGGESTIONS, SUMMARIES, and NEXT-STEP NUDGES only — " +
      "you NEVER override, replace, or contradict a doctor's clinical judgement or patient-care instructions. " +
      "Respond strictly with JSON in this format: " +
      '{ "insights": [{ "level": "info"|"tip"|"alert"|"success", "title": "string", "body": "string" }] } ' +
      "Maximum 4 items. Each body is 1-2 sentences. Be specific and actionable.";

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI API error:", errText);
      return new Response(JSON.stringify({ error: "OpenAI API error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiJson = await openaiRes.json();
    return new Response(JSON.stringify(openaiJson), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("ai-insights error:", message);
    return new Response(JSON.stringify({ error: "AI insights service unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
