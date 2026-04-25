/**
 * admin-create-doctor
 *
 * Creates a new doctor account pre-linked to the calling admin's hospital.
 *
 * Authorization model (two layers):
 *  1. JWT in Authorization header must belong to a user with role = 'clinic_admin'.
 *  2. The `clinicId` in the request body must match that user's own `clinic_id`
 *     in the profiles table — prevents one admin creating doctors for another clinic.
 *
 * On success the function:
 *  - Creates an auth user (email_confirm = true — no email verification needed)
 *  - Inserts profiles row (account_type = 'clinic_staff', is_active = false until OTP)
 *  - Inserts doctor_profiles row (nmc_verified = true, nmc_verified_at stamped)
 *  - Inserts user_roles row (role = 'doctor')
 *  - Inserts hospital_doctor_links row (status = 'ACTIVE')
 *
 * Rollback: if any insert after auth-user creation fails, the auth user is deleted
 * so the database is never left in a half-created state.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

interface Payload {
  email: string;
  tempPassword: string;
  /** DR-XXX display identifier generated on the frontend — stored in user_metadata */
  userId: string;
  nmcNumber: string;
  firstName: string;
  lastName: string;
  qualifications: string[];
  clinicId: string;
  /** Optional — pass to skip the doctor_profiles insert if one already exists */
  doctorProfileId?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // ── 1. Extract + verify JWT ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized — missing Authorization header" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized — invalid or expired token" }, 401);
    }
    const callerId = userData.user.id;

    // ── 2. Admin client (service role — bypasses RLS) ────────────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 3. Verify caller has clinic_admin role ───────────────────────────────
    const { data: roleRows, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    if (roleErr) throw new Error(`Role lookup failed: ${roleErr.message}`);

    const isAdmin = (roleRows ?? []).some(
      (r) => r.role === "clinic_admin" || r.role === "super_admin",
    );
    if (!isAdmin) {
      return json({ error: "Forbidden — only clinic admins can onboard doctors" }, 403);
    }

    // ── 4. Parse + validate request body ─────────────────────────────────────
    let body: Payload;
    try {
      body = (await req.json()) as Payload;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { email, tempPassword, userId: displayId, nmcNumber, firstName, lastName, qualifications, clinicId } = body;

    if (!email || !tempPassword || !nmcNumber || !firstName || !lastName || !clinicId) {
      return json({ error: "Missing required fields: email, tempPassword, nmcNumber, firstName, lastName, clinicId" }, 400);
    }
    if (tempPassword.length < 6) {
      return json({ error: "tempPassword must be at least 6 characters" }, 400);
    }

    // ── 5. Verify clinic ownership — caller's clinic_id must match body ───────
    const { data: callerProfile, error: profLookupErr } = await admin
      .from("profiles")
      .select("clinic_id")
      .eq("id", callerId)
      .single();

    if (profLookupErr || !callerProfile) {
      return json({ error: "Forbidden — caller profile not found" }, 403);
    }
    if (callerProfile.clinic_id !== clinicId) {
      return json({ error: "Forbidden — clinicId does not match your institution" }, 403);
    }

    // ── 6. Guard: reject duplicate NMC numbers ────────────────────────────────
    const { data: existingDp } = await admin
      .from("doctor_profiles")
      .select("id")
      .eq("nmc_number", nmcNumber)
      .maybeSingle();

    if (existingDp) {
      return json(
        { error: "A doctor with this NMC number is already registered. Use the affiliation flow to link them instead." },
        400,
      );
    }

    // ── 7. Create auth user ────────────────────────────────────────────────────
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,                    // skip email verification — admin vouches for them
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        clinic_id: clinicId,
        display_id: displayId ?? null,        // store the DR-XXX display identifier
      },
    });

    if (authErr || !authData.user) {
      throw new Error(authErr?.message ?? "Failed to create auth user");
    }
    const newUserId = authData.user.id;
    const now = new Date().toISOString();

    // Helper: clean up auth user on any downstream failure
    const rollback = async (reason: string) => {
      await admin.auth.admin.deleteUser(newUserId);
      throw new Error(reason);
    };

    // ── 8. Insert profiles row ─────────────────────────────────────────────────
    const { error: profileErr } = await admin.from("profiles").insert({
      id: newUserId,
      clinic_id: clinicId,
      email,
      first_name: firstName,
      last_name: lastName,
      account_type: "clinic_staff",
      is_active: false,                       // inactive until doctor completes first-login OTP
    });
    if (profileErr) await rollback(`profiles insert failed: ${profileErr.message}`);

    // ── 9. Insert doctor_profiles row ──────────────────────────────────────────
    let doctorProfileId = body.doctorProfileId ?? null;

    if (!doctorProfileId) {
      const { data: dpData, error: dpErr } = await admin
        .from("doctor_profiles")
        .insert({
          user_id: newUserId,
          clinic_id: clinicId,
          nmc_number: nmcNumber,
          nmc_verified: true,
          nmc_verified_at: now,
          qualifications: qualifications ?? [],
          sub_specialties: [],
          is_public: true,
          accepting_referrals: true,
          profile_completeness: 0,
        })
        .select("id")
        .single();

      if (dpErr || !dpData) {
        await admin.from("profiles").delete().eq("id", newUserId);
        await rollback(`doctor_profiles insert failed: ${dpErr?.message ?? "no data returned"}`);
      }
      doctorProfileId = dpData!.id as string;
    }

    // ── 10. Insert user_roles row ──────────────────────────────────────────────
    const { error: roleInsertErr } = await admin.from("user_roles").insert({
      user_id: newUserId,
      clinic_id: clinicId,
      role: "doctor",
    });
    if (roleInsertErr) {
      await admin.from("doctor_profiles").delete().eq("id", doctorProfileId);
      await admin.from("profiles").delete().eq("id", newUserId);
      await rollback(`user_roles insert failed: ${roleInsertErr.message}`);
    }

    // ── 11. Insert hospital_doctor_links row ───────────────────────────────────
    const { error: linkErr } = await admin.from("hospital_doctor_links").insert({
      hospital_clinic_id: clinicId,
      doctor_profile_id: doctorProfileId,
      doctor_user_id: newUserId,
      status: "ACTIVE",
      joined_at: now,
    });
    if (linkErr) {
      await admin.from("user_roles").delete().eq("user_id", newUserId);
      await admin.from("doctor_profiles").delete().eq("id", doctorProfileId);
      await admin.from("profiles").delete().eq("id", newUserId);
      await rollback(`hospital_doctor_links insert failed: ${linkErr.message}`);
    }

    // ── 12. Success ────────────────────────────────────────────────────────────
    console.log(`admin-create-doctor: created doctor ${newUserId} for clinic ${clinicId}`);

    return json({
      success: true,
      doctorUserId: newUserId,
      doctorProfileId,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("admin-create-doctor error:", message);
    return json({ error: message }, 400);
  }
});
