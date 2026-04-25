// Verifies an NMC license number via the Surepass API.
// In development (no SUREPASS_TOKEN), returns mock data so the UI flow can be tested.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SurepassData {
  full_name?: string;
  registration_date?: string;
  qualification_name?: string;
  state_medical_council?: string;
  status?: string;
}

interface SurepassResponse {
  data?: SurepassData;
  message?: string;
  status_code?: number;
  success?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nmc_number } = (await req.json()) as { nmc_number?: string };

    if (!nmc_number || typeof nmc_number !== "string" || nmc_number.trim() === "") {
      return new Response(
        JSON.stringify({ verified: false, reason: "NMC number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = Deno.env.get("SUREPASS_TOKEN");

    // Development / mock mode — no token configured
    if (!token) {
      return new Response(
        JSON.stringify({
          verified: true,
          data: {
            full_name: "Verified Doctor",
            registration_date: null,
            qualification: "MBBS, MD",
            council: "NMC",
            status: "Active",
          },
          mock: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call Surepass NMC verification API
    const surepassRes = await fetch(
      "https://kyc-api.surepass.io/api/v1/nmc/nmc-verification",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id_number: nmc_number.trim() }),
      },
    );

    const surepassJson = (await surepassRes.json()) as SurepassResponse;

    if (!surepassRes.ok || !surepassJson.success || !surepassJson.data) {
      return new Response(
        JSON.stringify({
          verified: false,
          reason: "NMC number not found in registry",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const d = surepassJson.data;

    return new Response(
      JSON.stringify({
        verified: true,
        data: {
          full_name: d.full_name ?? null,
          registration_date: d.registration_date ?? null,
          qualification: d.qualification_name ?? null,
          council: d.state_medical_council ?? null,
          status: d.status ?? null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("verify-nmc error:", message);
    return new Response(
      JSON.stringify({ verified: false, reason: "Verification service unavailable. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
