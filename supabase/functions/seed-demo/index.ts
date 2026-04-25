// Idempotent demo seed. Creates the Apollo Demo Clinic, 5 users, doctor profiles,
// 10 patients, 5 appointments, 3 referrals. Safe to call multiple times — checks
// for the demo clinic by slug first.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_PASSWORD = "Demo@1234";
const DEMO_SLUG = "apollo-demo";

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  role: "clinic_admin" | "doctor" | "nurse" | "receptionist";
  title?: string;
  specialization?: string;
}

const USERS: SeedUser[] = [
  { email: "admin@demo.clinicos.in", firstName: "Anita", lastName: "Verma", role: "clinic_admin", title: "Clinic Administrator" },
  { email: "dr.sharma@demo.clinicos.in", firstName: "Rajesh", lastName: "Sharma", role: "doctor", title: "Senior Consultant", specialization: "Nephrology" },
  { email: "dr.patel@demo.clinicos.in", firstName: "Priya", lastName: "Patel", role: "doctor", title: "Senior Consultant", specialization: "Cardiology" },
  { email: "reception@demo.clinicos.in", firstName: "Meena", lastName: "Iyer", role: "receptionist", title: "Front Desk" },
  { email: "nurse@demo.clinicos.in", firstName: "Sunita", lastName: "Reddy", role: "nurse", title: "Senior Nurse" },
];

const PATIENTS = [
  { first: "Arjun", last: "Mehta", phone: "+919811000001", dob: "1968-03-14", gender: "MALE",   chronic: ["Hypertension","CKD Stage 3"] },
  { first: "Kavita", last: "Singh", phone: "+919811000002", dob: "1975-07-22", gender: "FEMALE", chronic: ["Type 2 Diabetes"] },
  { first: "Rohit", last: "Kapoor", phone: "+919811000003", dob: "1982-11-05", gender: "MALE",   chronic: [] },
  { first: "Sneha", last: "Joshi", phone: "+919811000004", dob: "1990-05-18", gender: "FEMALE", chronic: ["Asthma"] },
  { first: "Vikram", last: "Nair", phone: "+919811000005", dob: "1955-09-30", gender: "MALE",   chronic: ["Coronary Artery Disease"] },
  { first: "Pooja", last: "Desai", phone: "+919811000006", dob: "1988-12-11", gender: "FEMALE", chronic: [] },
  { first: "Amit", last: "Gupta", phone: "+919811000007", dob: "1972-02-25", gender: "MALE", chronic: ["Hypertension"] },
  { first: "Neha", last: "Bhat", phone: "+919811000008", dob: "1995-08-08", gender: "FEMALE", chronic: [] },
  { first: "Sanjay", last: "Rao", phone: "+919811000009", dob: "1962-04-17", gender: "MALE", chronic: ["Type 2 Diabetes","Hypertension"] },
  { first: "Divya", last: "Menon", phone: "+919811000010", dob: "1985-10-29", gender: "FEMALE", chronic: ["Hypothyroidism"] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: if clinic exists, return early
    const { data: existing } = await admin.from("clinics").select("id").eq("slug", DEMO_SLUG).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({
        message: "Demo data already seeded",
        clinicId: existing.id,
        credentials: USERS.map((u) => ({ email: u.email, password: DEMO_PASSWORD, role: u.role })),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Clinic
    const { data: clinic, error: clinicErr } = await admin.from("clinics").insert({
      name: "Apollo Demo Clinic",
      slug: DEMO_SLUG,
      email: "contact@apollo-demo.clinicos.in",
      phone: "+912266100000",
      address: "1 Apollo Road, Andheri East",
      city: "Mumbai", state: "Maharashtra", country: "IN",
      timezone: "Asia/Kolkata",
      plan: "PROFESSIONAL",
      plan_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    if (clinicErr || !clinic) throw new Error(`clinic: ${clinicErr?.message}`);

    // 2. Departments + rooms
    await admin.from("departments").insert(
      ["General","Reception","Billing","Laboratory","Pharmacy","Cardiology","Nephrology"].map((name) => ({ clinic_id: clinic.id, name })),
    );
    await admin.from("rooms").insert([
      { clinic_id: clinic.id, name: "Consultation 1", type: "CONSULTATION" },
      { clinic_id: clinic.id, name: "Consultation 2", type: "CONSULTATION" },
      { clinic_id: clinic.id, name: "Examination 1", type: "EXAMINATION" },
      { clinic_id: clinic.id, name: "Waiting Area", type: "WAITING" },
    ]);

    // 3. Users + profiles + roles
    const userIds: Record<string, string> = {};
    for (const u of USERS) {
      const { data: created, error: uErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: u.firstName, last_name: u.lastName, clinic_id: clinic.id },
      });
      if (uErr || !created.user) throw new Error(`user ${u.email}: ${uErr?.message}`);
      userIds[u.email] = created.user.id;

      await admin.from("profiles").insert({
        id: created.user.id,
        clinic_id: clinic.id,
        email: u.email,
        first_name: u.firstName,
        last_name: u.lastName,
        title: u.title ?? null,
        specialization: u.specialization ?? null,
      });
      await admin.from("user_roles").insert({
        user_id: created.user.id,
        clinic_id: clinic.id,
        role: u.role,
      });
    }

    // 4. Doctor profiles
    const sharmaUserId = userIds["dr.sharma@demo.clinicos.in"];
    const patelUserId = userIds["dr.patel@demo.clinicos.in"];

    const { data: drSharma, error: dpErr1 } = await admin.from("doctor_profiles").insert({
      user_id: sharmaUserId,
      clinic_id: clinic.id,
      nmc_number: "MH12345",
      nmc_verified: true,
      nmc_verified_at: new Date().toISOString(),
      qualifications: ["MBBS", "MD (Internal Medicine)", "DM (Nephrology)"],
      sub_specialties: ["Nephrology","Dialysis","Kidney Transplant"],
      condition_codes: ["N17","N18","N19","E11","I10"],
      hospital_affiliations: [{ name: "Apollo Hospital Mumbai", role: "Senior Consultant", since: 2015 }],
      teaching_hospital: "Apollo Hospital Mumbai",
      academic_title: "Senior Consultant",
      languages_spoken: ["English","Hindi","Marathi"],
      insurance_panels: ["Star Health","HDFC Ergo","Bajaj Allianz"],
      telemedicine_enabled: true,
      weekly_referral_cap: 25,
      total_referrals_received: 142,
      referral_acceptance_rate: 87.5,
      avg_response_time_hours: 4.2,
      unique_referring_doctors: 48,
      profile_completeness: 95,
    }).select().single();
    if (dpErr1) throw new Error(`doc1: ${dpErr1.message}`);

    const { data: drPatel, error: dpErr2 } = await admin.from("doctor_profiles").insert({
      user_id: patelUserId,
      clinic_id: clinic.id,
      nmc_number: "MH67890",
      nmc_verified: true,
      nmc_verified_at: new Date().toISOString(),
      qualifications: ["MBBS","MD (Medicine)","DM (Cardiology)"],
      sub_specialties: ["Interventional Cardiology","Heart Failure","Echocardiography"],
      condition_codes: ["I10","I20","I25","I50"],
      hospital_affiliations: [{ name: "Apollo Hospital Mumbai", role: "Senior Consultant", since: 2018 }],
      teaching_hospital: "Apollo Hospital Mumbai",
      academic_title: "Senior Consultant",
      languages_spoken: ["English","Hindi","Gujarati"],
      insurance_panels: ["Star Health","HDFC Ergo"],
      telemedicine_enabled: true,
      weekly_referral_cap: 30,
      total_referrals_received: 198,
      referral_acceptance_rate: 91.2,
      avg_response_time_hours: 3.1,
      unique_referring_doctors: 62,
      profile_completeness: 92,
    }).select().single();
    if (dpErr2) throw new Error(`doc2: ${dpErr2.message}`);

    // 5. Patients
    const { data: patientRows, error: pErr } = await admin.from("patients").insert(
      PATIENTS.map((p) => ({
        clinic_id: clinic.id,
        mrn: `MRN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        first_name: p.first, last_name: p.last,
        phone: p.phone, date_of_birth: p.dob,
        gender: p.gender as "MALE" | "FEMALE",
        city: "Mumbai", state: "Maharashtra",
        chronic_conditions: p.chronic,
      })),
    ).select();
    if (pErr || !patientRows) throw new Error(`patients: ${pErr?.message}`);

    // 6. Appointments
    const now = Date.now();
    const appts = [
      { patient: patientRows[0], doctor: sharmaUserId, offsetHours: -48, status: "COMPLETED" as const },
      { patient: patientRows[1], doctor: sharmaUserId, offsetHours: -24, status: "COMPLETED" as const },
      { patient: patientRows[2], doctor: patelUserId,  offsetHours: 2,   status: "SCHEDULED" as const },
      { patient: patientRows[3], doctor: patelUserId,  offsetHours: 4,   status: "SCHEDULED" as const },
      { patient: patientRows[4], doctor: sharmaUserId, offsetHours: 24,  status: "CONFIRMED" as const },
    ];
    await admin.from("appointments").insert(
      appts.map((a) => ({
        clinic_id: clinic.id,
        patient_id: a.patient.id,
        doctor_id: a.doctor,
        created_by_id: userIds["reception@demo.clinicos.in"],
        scheduled_at: new Date(now + a.offsetHours * 3600 * 1000).toISOString(),
        end_time: new Date(now + (a.offsetHours + 0.5) * 3600 * 1000).toISOString(),
        duration: 30,
        status: a.status,
        type: "IN_PERSON",
        reason: "Routine consultation",
      })),
    );

    // 7. Referrals — Patel refers to Sharma
    const refs = [
      {
        status: "SENT",
        urgency: "URGENT",
        diagnosis: "Acute kidney injury secondary to hypertensive crisis",
        code: "N17",
        summary: "65y M with BP 220/130, creatinine rose from 1.2 to 3.4 over 72h. Stable on IV labetalol.",
        reason: "Urgent nephrology evaluation for AKI workup and management.",
        offsetDays: -1,
        patient: patientRows[4],
      },
      {
        status: "ACCEPTED",
        urgency: "SEMI_URGENT",
        diagnosis: "CKD Stage 3 with poorly controlled diabetes",
        code: "N18",
        summary: "58y M, eGFR 42, HbA1c 9.8%. On metformin and ramipril. Proteinuria 1.2g/24h.",
        reason: "Co-management for CKD progression and diabetic nephropathy.",
        offsetDays: -5,
        patient: patientRows[8],
      },
      {
        status: "COMPLETED",
        urgency: "ROUTINE",
        diagnosis: "Microalbuminuria in T2DM",
        code: "E11",
        summary: "Postmenopausal F with 8y T2DM, urine ACR 80 mg/g, BP controlled.",
        reason: "Baseline nephrology assessment.",
        offsetDays: -30,
        patient: patientRows[1],
        outcome: "TREATED_AND_DISCHARGED" as const,
        outcomeNotes: "ACE inhibitor optimised, repeat ACR in 3 months. Discharged back to PCP.",
      },
    ];
    for (const r of refs) {
      const { data: refNumData } = await admin.rpc("generate_referral_number");
      const sentAt = new Date(now + r.offsetDays * 86400 * 1000).toISOString();
      const acceptedAt = r.status === "ACCEPTED" || r.status === "COMPLETED"
        ? new Date(now + (r.offsetDays + 0.2) * 86400 * 1000).toISOString() : null;
      const completedAt = r.status === "COMPLETED"
        ? new Date(now + (r.offsetDays + 5) * 86400 * 1000).toISOString() : null;

      await admin.from("referrals").insert({
        referral_number: refNumData ?? `REF-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
        referring_doctor_id: drPatel!.id,
        specialist_id: drSharma!.id,
        patient_snapshot: {
          name: `${r.patient.first_name} ${r.patient.last_name}`,
          age: new Date().getFullYear() - new Date(r.patient.date_of_birth).getFullYear(),
          gender: r.patient.gender, mrn: r.patient.mrn, phone: r.patient.phone,
          chronic_conditions: r.patient.chronic_conditions,
        },
        primary_diagnosis: r.diagnosis,
        diagnosis_code: r.code,
        urgency: r.urgency as "ROUTINE" | "SEMI_URGENT" | "URGENT",
        clinical_summary: r.summary,
        referral_reason: r.reason,
        status: r.status as "SENT" | "ACCEPTED" | "COMPLETED",
        sent_at: sentAt,
        accepted_at: acceptedAt,
        completed_at: completedAt,
        outcome: r.status === "COMPLETED" ? r.outcome : null,
        outcome_notes: r.status === "COMPLETED" ? r.outcomeNotes : null,
        outcome_recorded_at: completedAt,
        originating_clinic_id: clinic.id,
        originating_clinic_name: clinic.name,
        expires_at: new Date(now + 90 * 86400 * 1000).toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        clinicId: clinic.id,
        message: "Demo clinic seeded.",
        credentials: USERS.map((u) => ({ email: u.email, password: DEMO_PASSWORD, role: u.role })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("seed-demo error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
