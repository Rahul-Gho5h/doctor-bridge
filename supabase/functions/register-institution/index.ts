/**
 * register-institution
 *
 * Public endpoint — no JWT required from the caller.
 * Uses the Supabase admin client (service role key) for all operations
 * so it bypasses RLS entirely. This is intentional: the registration
 * form is unauthenticated (the user doesn't have an account yet).
 *
 * Write order:
 *  1. auth user       — createUser with email_confirm: true
 *  2. clinics         — PENDING verification, TRIAL plan
 *  3. profiles        — links the admin user to the clinic
 *  4. user_roles      — grants clinic_admin role
 *
 * Rollback: each step's failure handler deletes everything created so far
 * in reverse order, then returns a 400 with the error message.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

interface Payload {
  // Institution
  institutionName: string;
  entityType: "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "DIAGNOSTIC_CENTER";
  gstNumber: string;
  registrationNumber: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  institutionEmail: string;
  equipment: string[];
  workingHours: string;
  // Admin account
  firstName: string;
  lastName: string;
  adminEmail: string;
  adminPhone: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a URL-safe slug with a random 4-character alphanumeric suffix */
function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // ── Preflight ──────────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // ── Parse body ───────────────────────────────────────────────────────────
    let body: Payload;
    try {
      body = (await req.json()) as Payload;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const {
      institutionName, entityType, gstNumber, registrationNumber,
      city, state, address, phone, institutionEmail,
      equipment, workingHours,
      firstName, lastName, adminEmail, adminPhone, password,
    } = body;

    // ── Basic validation ──────────────────────────────────────────────────────
    const missing = [
      !institutionName && "institutionName",
      !entityType      && "entityType",
      !gstNumber       && "gstNumber",
      !city            && "city",
      !state           && "state",
      !address         && "address",
      !adminEmail      && "adminEmail",
      !password        && "password",
      !firstName       && "firstName",
      !lastName        && "lastName",
    ].filter(Boolean);

    if (missing.length) {
      return json({ error: `Missing required fields: ${missing.join(", ")}` }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }

    // ── Admin client ──────────────────────────────────────────────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();

    // ── Step 1: Create auth user ──────────────────────────────────────────────
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authErr || !authData.user) {
      console.error("register-institution: auth createUser failed:", authErr);
      return json({ error: authErr?.message ?? "Failed to create auth user" }, 400);
    }

    const userId = authData.user.id;
    console.log(`register-institution: auth user created ${userId}`);

    // ── Step 2: Insert clinic ─────────────────────────────────────────────────
    const { data: clinicData, error: clinicErr } = await admin
      .from("clinics")
      .insert({
        name:                institutionName,
        email:               institutionEmail || null,
        phone:               phone || null,
        address:             address,
        city:                city,
        state:               state,
        country:             "IN",
        timezone:            "Asia/Kolkata",
        entity_type:         entityType,
        gst_number:          gstNumber,
        registration_number: registrationNumber || null,
        equipment:           equipment?.length > 0 ? equipment : null,
        verification_status: "PENDING",
        plan:                "TRIAL",
        slug:                makeSlug(institutionName),
        working_hours:       workingHours ? { text: workingHours } : {},
        is_active:           true,
        settings:            {},
      })
      .select("id")
      .single();

    if (clinicErr || !clinicData) {
      console.error("register-institution: clinics insert failed:", clinicErr);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: clinicErr?.message ?? "Failed to create institution record" }, 400);
    }

    const clinicId = clinicData.id as string;
    console.log(`register-institution: clinic created ${clinicId}`);

    // ── Step 3: Insert profile ────────────────────────────────────────────────
    const { error: profileErr } = await admin
      .from("profiles")
      .insert({
        id:           userId,
        clinic_id:    clinicId,
        email:        adminEmail,
        first_name:   firstName,
        last_name:    lastName,
        phone:        adminPhone || null,
        account_type: "clinic_staff",
        is_active:    true,
      });

    if (profileErr) {
      console.error("register-institution: profiles insert failed:", profileErr);
      await admin.from("clinics").delete().eq("id", clinicId);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: profileErr.message }, 400);
    }

    console.log(`register-institution: profile created for ${userId}`);

    // ── Step 4: Insert user_roles ─────────────────────────────────────────────
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({
        user_id:   userId,
        clinic_id: clinicId,
        role:      "clinic_admin",
      });

    if (roleErr) {
      console.error("register-institution: user_roles insert failed:", roleErr);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.from("clinics").delete().eq("id", clinicId);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: roleErr.message }, 400);
    }

    console.log(`register-institution: clinic_admin role granted to ${userId}`);

    // ── Send Email ────────────────────────────────────────────────────────────
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: "Doctor Bridge <admin@doctorbridge.in>",
            to: [adminEmail],
            subject: "Application Received - Doctor Bridge",
            html: `<h3>Hello ${firstName},</h3>
                   <p>We have successfully received the onboarding application for <strong>${institutionName}</strong>.</p>
                   <p>Our administration team is currently reviewing your application and verifying your documents. You will receive an email once the verification is complete.</p>
                   <br/>
                   <p>Thank you,<br/>The Doctor Bridge Team</p>`,
          })
        });
      } catch (e) {
        console.error("Failed to send welcome email", e);
      }
    }

    // ── Success ───────────────────────────────────────────────────────────────
    return json({ success: true, clinicId, userId });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("register-institution: unhandled error:", message);
    return json({ error: message }, 400);
  }
});
