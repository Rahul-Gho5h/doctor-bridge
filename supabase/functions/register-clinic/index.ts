// Register a new clinic + admin user atomically.
// Public endpoint (verify_jwt = false). Uses service role to bypass RLS for the
// initial bootstrap (clinic, admin profile, default departments + rooms, role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RegisterPayload {
  clinicName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  timezone?: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as RegisterPayload;
    const { clinicName, email, password, firstName, lastName, phone, city, timezone } = body;

    if (!clinicName || !email || !password || !firstName || !lastName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Generate a unique slug
    const baseSlug = slugify(clinicName) || "clinic";
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await admin
        .from("clinics")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // 1. Create clinic
    const { data: clinic, error: clinicErr } = await admin
      .from("clinics")
      .insert({
        name: clinicName,
        slug,
        email,
        phone: phone ?? null,
        city: city ?? null,
        timezone: timezone ?? "Asia/Kolkata",
        country: "IN",
        plan: "TRIAL",
        plan_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (clinicErr || !clinic) throw new Error(clinicErr?.message ?? "Failed to create clinic");

    // 2. Create auth user (auto-confirmed for dev)
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, clinic_id: clinic.id },
    });
    if (authErr || !authData.user) {
      // Roll back clinic
      await admin.from("clinics").delete().eq("id", clinic.id);
      throw new Error(authErr?.message ?? "Failed to create user");
    }
    const userId = authData.user.id;

    // 3. Create profile
    const { error: profileErr } = await admin.from("profiles").insert({
      id: userId,
      clinic_id: clinic.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone: phone ?? null,
      title: "Administrator",
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(userId);
      await admin.from("clinics").delete().eq("id", clinic.id);
      throw new Error(profileErr.message);
    }

    // 4. Assign clinic_admin role
    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: userId,
      clinic_id: clinic.id,
      role: "clinic_admin",
    });
    if (roleErr) throw new Error(roleErr.message);

    // 5. Default departments
    const defaultDepartments = ["General", "Reception", "Billing", "Laboratory", "Pharmacy"];
    await admin.from("departments").insert(
      defaultDepartments.map((name) => ({ clinic_id: clinic.id, name })),
    );

    // 6. Default rooms
    await admin.from("rooms").insert([
      { clinic_id: clinic.id, name: "Consultation 1", type: "CONSULTATION" },
      { clinic_id: clinic.id, name: "Consultation 2", type: "CONSULTATION" },
      { clinic_id: clinic.id, name: "Examination 1", type: "EXAMINATION" },
      { clinic_id: clinic.id, name: "Waiting Area", type: "WAITING" },
    ]);

    return new Response(
      JSON.stringify({ success: true, clinicId: clinic.id, userId, slug }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("register-clinic error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
