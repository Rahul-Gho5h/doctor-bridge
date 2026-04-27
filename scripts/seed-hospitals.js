#!/usr/bin/env node
/**
 * scripts/seed-hospitals.js
 *
 * Creates test data for Doctor Bridge:
 *   Hospital 1 – Agarwal Medical Centre, Raipur  → cardiologist + neurologist
 *   Hospital 2 – City Hospital Mumbai            → orthopaedic + general physician
 *
 * Steps per hospital:
 *   1. POST /functions/v1/register-institution    (public, no JWT needed)
 *   2. PATCH /rest/v1/clinics?id=eq.{id}          (needs SERVICE_ROLE_KEY)
 *   3. POST /auth/v1/token  → get admin JWT
 *   4. POST /functions/v1/admin-create-doctor × 2 (needs admin JWT)
 *
 * To enable clinic approval paste your service_role key below.
 * Get it from: Supabase Dashboard → Settings → API → service_role (secret)
 */

const SUPABASE_URL  = "https://zvfvhndcbwfdcfessycn.supabase.co";
const ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZnZobmRjYndmZGNmZXNzeWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1Mjc4ODUsImV4cCI6MjA5MjEwMzg4NX0.wsnCf7UH6ZYoKqQhrvQ_bXiKvKl_beFVazJppkrCKj0";

// ← Paste service_role key from Supabase Dashboard > Settings > API
// Leave empty to skip approval (doctors can still be created)
const SERVICE_ROLE_KEY = "";

// ── Logging helpers ──────────────────────────────────────────────────────────

const ts  = () => new Date().toISOString().slice(11, 23);
const log = (m)  => console.log(`[${ts()}] ${m}`);
const ok  = (m)  => console.log(`  ✓  ${m}`);
const bad = (m)  => console.error(`  ✗  ${m}`);
const sep = (m)  => console.log(`\n${"─".repeat(62)}\n  ${m}\n${"─".repeat(62)}`);

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function postJSON(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, ...extraHeaders },
    body:    JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

async function patchJSON(url, body, key) {
  const res = await fetch(url, {
    method:  "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Prefer":        "return=representation",
      apikey:          key,
      Authorization:  `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

// ── Domain helpers ───────────────────────────────────────────────────────────

// Always send Authorization header — Supabase gateway rejects calls without it
// even on public functions unless verify_jwt=false is set for that exact fn name.
// Passing the anon key as a bearer token satisfies the gateway; the function
// itself may still ignore it and use its own service-role client internally.
const edgeFn = (name, body, jwt) =>
  postJSON(
    `${SUPABASE_URL}/functions/v1/${name}`,
    body,
    { Authorization: `Bearer ${jwt ?? ANON_KEY}` },
  );

const signIn = (email, password) =>
  postJSON(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { email, password });

async function approveClinic(clinicId) {
  if (!SERVICE_ROLE_KEY) {
    log("SERVICE_ROLE_KEY not set → skipping approval (clinic stays PENDING)");
    log("admin-create-doctor does NOT check verification_status — doctors will still be created.");
    return { skipped: true };
  }
  return patchJSON(
    `${SUPABASE_URL}/rest/v1/clinics?id=eq.${clinicId}`,
    { verification_status: "ACTIVE" },
    SERVICE_ROLE_KEY,
  );
}

// ── Seed data ────────────────────────────────────────────────────────────────

const HOSPITALS = [
  {
    // ── Registration payload ───────────────────────────────────────────────
    institutionName:    "Agarwal Medical Centre",
    entityType:         "HOSPITAL",
    gstNumber:          "22AAAAA0000A1Z5",
    registrationNumber: "RPUR-CG-2024-001",
    city:               "Raipur",
    state:              "Chhattisgarh",
    address:            "12, Civil Lines, Raipur, Chhattisgarh 492001",
    phone:              "+917712345678",
    institutionEmail:   "info@agarwalmedical.in",
    equipment:          ["ECG", "Ultrasound", "X-Ray", "ICU"],
    workingHours:       "Mon–Sat 8am–8pm, Sun 9am–2pm",
    firstName:          "Rajesh",
    lastName:           "Agarwal",
    adminEmail:         "admin@agarwalmedical.in",
    adminPhone:         "+917712345679",
    password:           "Admin@12345",
    // ── Doctors to create ─────────────────────────────────────────────────
    doctors: [
      {
        firstName:      "Priya",
        lastName:       "Sharma",
        email:          "priya.sharma@agarwalmedical.in",
        tempPassword:   "Doctor@12345",
        nmcNumber:      "NMC-CG-2019-44711",
        qualifications: ["MBBS", "MD Cardiology", "DM Cardiology"],
        displayId:      "DR-AG-001",
        role:           "Cardiologist",
      },
      {
        firstName:      "Vikram",
        lastName:       "Desai",
        email:          "vikram.desai@agarwalmedical.in",
        tempPassword:   "Doctor@12345",
        nmcNumber:      "NMC-CG-2017-38922",
        qualifications: ["MBBS", "MD Neurology", "DM Neurology"],
        displayId:      "DR-AG-002",
        role:           "Neurologist",
      },
    ],
  },
  {
    // ── Registration payload ───────────────────────────────────────────────
    institutionName:    "City Hospital Mumbai",
    entityType:         "HOSPITAL",
    gstNumber:          "27BBBBB0000B1Z4",
    registrationNumber: "MUM-MH-2023-089",
    city:               "Mumbai",
    state:              "Maharashtra",
    address:            "45, Andheri East, Mumbai, Maharashtra 400069",
    phone:              "+912222334455",
    institutionEmail:   "info@cityhospitalmumbai.in",
    equipment:          ["MRI", "CT Scan", "Dialysis", "Ventilators", "Cath Lab"],
    workingHours:       "24×7",
    firstName:          "Meera",
    lastName:           "Kapoor",
    adminEmail:         "admin@cityhospitalmumbai.in",
    adminPhone:         "+912222334456",
    password:           "Admin@12345",
    // ── Doctors to create ─────────────────────────────────────────────────
    doctors: [
      {
        firstName:      "Arjun",
        lastName:       "Mehta",
        email:          "arjun.mehta@cityhospitalmumbai.in",
        tempPassword:   "Doctor@12345",
        nmcNumber:      "NMC-MH-2020-77141",
        qualifications: ["MBBS", "MS Orthopaedics", "Fellowship Joint Replacement"],
        displayId:      "DR-CH-001",
        role:           "Orthopaedic Surgeon",
      },
      {
        firstName:      "Sunita",
        lastName:       "Rao",
        email:          "sunita.rao@cityhospitalmumbai.in",
        tempPassword:   "Doctor@12345",
        nmcNumber:      "NMC-MH-2015-22561",
        qualifications: ["MBBS", "MD General Medicine"],
        displayId:      "DR-CH-002",
        role:           "General Physician",
      },
    ],
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  sep("Doctor Bridge — Hospital & Doctor Seed");
  log(`Target: ${SUPABASE_URL}`);
  log(`Service role key: ${SERVICE_ROLE_KEY ? "PROVIDED ✓" : "NOT SET — approval will be skipped"}`);

  const results = [];

  for (const hospital of HOSPITALS) {
    sep(`HOSPITAL: ${hospital.institutionName}`);

    // ── 1. Register institution ─────────────────────────────────────────────
    log(`[1/4] Calling register-institution…`);
    const { institutionName, entityType, gstNumber, registrationNumber,
            city, state, address, phone, institutionEmail,
            equipment, workingHours, firstName, lastName,
            adminEmail, adminPhone, password } = hospital;

    const { status: s1, data: d1 } = await edgeFn("register-institution", {
      institutionName, entityType, gstNumber, registrationNumber,
      city, state, address, phone, institutionEmail,
      equipment, workingHours,
      firstName, lastName, adminEmail, adminPhone, password,
    });

    log(`  → HTTP ${s1}  |  ${JSON.stringify(d1)}`);

    if (d1.error) {
      bad(`register-institution failed: ${d1.error}`);
      // If it already exists, try to proceed with sign-in anyway
      if (!d1.error.includes("already")) {
        results.push({ hospital: institutionName, status: "FAILED", reason: d1.error });
        continue;
      }
      log("  (Looks like a duplicate — attempting to sign in anyway)");
    } else {
      ok(`Institution created  clinicId=${d1.clinicId}  adminUserId=${d1.userId}`);
    }

    const clinicId = d1.clinicId;

    // ── 2. Approve clinic ───────────────────────────────────────────────────
    log(`[2/4] Approving clinic ${clinicId ?? "(id unknown — skipping approval)"}…`);
    if (clinicId) {
      const approveRes = await approveClinic(clinicId);
      if (approveRes.skipped) {
        // logged inside approveClinic
      } else if (approveRes.status === 200 || approveRes.status === 204) {
        ok(`Clinic set to ACTIVE  clinicId=${clinicId}`);
      } else {
        bad(`Approval failed  HTTP ${approveRes.status}: ${JSON.stringify(approveRes.data)}`);
        log("  Continuing — admin-create-doctor will still work");
      }
    }

    // ── 3. Sign in as admin ─────────────────────────────────────────────────
    log(`[3/4] Signing in as ${adminEmail}…`);
    const { status: s3, data: d3 } = await signIn(adminEmail, password);
    log(`  → HTTP ${s3}  |  ${d3.access_token ? "JWT obtained" : JSON.stringify(d3)}`);

    if (!d3.access_token) {
      bad(`Sign-in failed: ${JSON.stringify(d3)}`);
      results.push({ hospital: institutionName, status: "FAILED", reason: "admin sign-in failed" });
      continue;
    }

    const adminJwt = d3.access_token;
    ok(`Admin JWT obtained  (${adminJwt.slice(0, 40)}…)`);

    // ── 4. Create doctors ───────────────────────────────────────────────────
    log(`[4/4] Creating ${hospital.doctors.length} doctors…`);
    const doctorResults = [];

    for (const doctor of hospital.doctors) {
      log(`  Creating ${doctor.role}: Dr. ${doctor.firstName} ${doctor.lastName} <${doctor.email}>`);

      const { status: sd, data: dd } = await edgeFn(
        "admin-create-doctor",
        {
          email:          doctor.email,
          tempPassword:   doctor.tempPassword,
          userId:         doctor.displayId,
          nmcNumber:      doctor.nmcNumber,
          firstName:      doctor.firstName,
          lastName:       doctor.lastName,
          qualifications: doctor.qualifications,
          clinicId:       clinicId ?? "",
        },
        adminJwt,
      );

      log(`    → HTTP ${sd}  |  ${JSON.stringify(dd)}`);

      if (dd.success) {
        ok(`Doctor created  doctorUserId=${dd.doctorUserId}  doctorProfileId=${dd.doctorProfileId}`);
        doctorResults.push({ role: doctor.role, name: `Dr. ${doctor.firstName} ${doctor.lastName}`, ...dd });
      } else {
        bad(`Doctor creation failed: ${dd.error}`);
        doctorResults.push({ role: doctor.role, name: `Dr. ${doctor.firstName} ${doctor.lastName}`, error: dd.error });
      }
    }

    results.push({ hospital: institutionName, clinicId, status: "OK", doctors: doctorResults });
  }

  // ── Final summary ───────────────────────────────────────────────────────────
  sep("SUMMARY");
  for (const r of results) {
    if (r.status === "FAILED") {
      bad(`${r.hospital}  FAILED — ${r.reason}`);
      continue;
    }
    ok(`${r.hospital}  clinicId=${r.clinicId}`);
    for (const d of r.doctors ?? []) {
      if (d.error) {
        bad(`    ${d.role}: ${d.name} — ${d.error}`);
      } else {
        ok(`    ${d.role}: ${d.name}  userId=${d.doctorUserId}`);
      }
    }
  }

  if (!SERVICE_ROLE_KEY) {
    console.log("\n⚠️  Clinics are PENDING (no SERVICE_ROLE_KEY was provided).");
    console.log("   To activate, run this SQL in Supabase Dashboard > SQL Editor:");
    console.log("   UPDATE clinics SET verification_status = 'ACTIVE'");
    console.log("   WHERE name IN ('Agarwal Medical Centre', 'City Hospital Mumbai');");
    console.log("\n   Or add your service_role key to SERVICE_ROLE_KEY at the top of this script and re-run.");
  }

  log("Done.");
}

main().catch((e) => {
  console.error("\nUnhandled error:", e);
  process.exit(1);
});
