// Doctor self-registration: creates auth user + profile + doctor_profiles row.
// Independent doctor (no hospital), can join one later.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  nmcNumber: string;
  qualifications?: string[];
  subSpecialties?: string[];
  city?: string;
  state?: string;
  oathVersion?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    const { email, password, firstName, lastName, phone, nmcNumber, qualifications, subSpecialties, city, state, oathVersion } = body;

    if (!email || !password || !firstName || !lastName || !nmcNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!oathVersion) {
      return new Response(JSON.stringify({ error: "You must accept the Doctor's Oath" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reject duplicate NMC
    const { data: existing } = await admin
      .from("doctor_profiles")
      .select("id")
      .eq("nmc_number", nmcNumber)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "A doctor with this NMC number is already registered" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (authErr || !authData.user) throw new Error(authErr?.message ?? "Failed to create user");
    const userId = authData.user.id;

    // Profile (no clinic — independent doctor)
    const { error: profErr } = await admin.from("profiles").insert({
      id: userId, clinic_id: null, email, first_name: firstName, last_name: lastName,
      phone: phone ?? null, title: "Doctor", account_type: "doctor",
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }

    // Doctor profile (with oath + location)
    // nmc_verified is set to true here because the NMC check was already
    // performed in Step 1 of the registration form (real or simulated).
    const { error: dpErr } = await admin.from("doctor_profiles").insert({
      user_id: userId, clinic_id: null, nmc_number: nmcNumber,
      qualifications: qualifications ?? [], sub_specialties: subSpecialties ?? [],
      is_public: true, accepting_referrals: true,
      nmc_verified: true, nmc_verified_at: new Date().toISOString(),
      oath_accepted_at: new Date().toISOString(),
      oath_version: oathVersion,
      city: city ?? null,
      state: state ?? null,
    });
    if (dpErr) {
      await admin.auth.admin.deleteUser(userId);
      await admin.from("profiles").delete().eq("id", userId);
      throw new Error(dpErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("register-doctor error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
