// Seed additional specialist doctors across cities and specialties.
// Idempotent: skips users whose email already exists. Each doctor gets a public,
// accepting-referrals doctor_profile so they appear in /doctors search.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_PASSWORD = "Demo@1234";
const HOST_CLINIC_SLUG = "apollo-demo";

interface Spec {
  email: string;
  first: string;
  last: string;
  title: string;
  specialization: string;
  nmc: string;
  city: string;
  hospital: string;
  qualifications: string[];
  sub_specialties: string[];
  condition_codes: string[];
  languages: string[];
  insurance: string[];
  cap: number;
  received: number;
  acceptance: number;
  responseHrs: number;
  uniqueRefs: number;
  completeness: number;
  telemedicine: boolean;
  bio: string;
  fee: number;
}

const SPECIALISTS: Spec[] = [
  {
    email: "dr.iyer@demo.clinicos.in", first: "Lakshmi", last: "Iyer",
    title: "Senior Consultant Endocrinologist", specialization: "Endocrinology",
    nmc: "TN20451", city: "Chennai", hospital: "Apollo Hospitals Chennai",
    qualifications: ["MBBS", "MD (General Medicine)", "DM (Endocrinology)"],
    sub_specialties: ["Diabetes", "Thyroid Disorders", "PCOS", "Metabolic Syndrome"],
    condition_codes: ["E10", "E11", "E03", "E66"],
    languages: ["English", "Tamil", "Hindi"],
    insurance: ["Star Health", "HDFC Ergo", "ICICI Lombard"],
    cap: 30, received: 256, acceptance: 88.4, responseHrs: 5.2, uniqueRefs: 71, completeness: 94,
    telemedicine: true, fee: 1200,
    bio: "18+ years managing complex diabetes and thyroid disorders. Special interest in adolescent endocrinology and gestational diabetes.",
  },
  {
    email: "dr.menon@demo.clinicos.in", first: "Krishna", last: "Menon",
    title: "Consultant Pulmonologist", specialization: "Pulmonology",
    nmc: "KL11203", city: "Bengaluru", hospital: "Manipal Hospital Old Airport Road",
    qualifications: ["MBBS", "MD (Pulmonary Medicine)", "Fellowship Sleep Medicine"],
    sub_specialties: ["Asthma", "COPD", "Sleep Apnea", "Interstitial Lung Disease"],
    condition_codes: ["J45", "J44", "J18"],
    languages: ["English", "Malayalam", "Kannada", "Hindi"],
    insurance: ["Star Health", "Bajaj Allianz", "Niva Bupa"],
    cap: 25, received: 178, acceptance: 92.1, responseHrs: 3.8, uniqueRefs: 54, completeness: 90,
    telemedicine: true, fee: 1000,
    bio: "Pulmonologist focused on chronic airway disease and sleep medicine. Runs a dedicated pulmonary rehab clinic.",
  },
  {
    email: "dr.banerjee@demo.clinicos.in", first: "Anirban", last: "Banerjee",
    title: "Senior Consultant Neurologist", specialization: "Neurology",
    nmc: "WB30988", city: "Kolkata", hospital: "AMRI Hospital Salt Lake",
    qualifications: ["MBBS", "MD (Medicine)", "DM (Neurology)"],
    sub_specialties: ["Stroke", "Epilepsy", "Movement Disorders", "Headache"],
    condition_codes: ["G43", "G40", "I63"],
    languages: ["English", "Bengali", "Hindi"],
    insurance: ["Star Health", "HDFC Ergo", "Aditya Birla Health"],
    cap: 22, received: 211, acceptance: 85.7, responseHrs: 6.1, uniqueRefs: 63, completeness: 96,
    telemedicine: true, fee: 1500,
    bio: "Stroke and epilepsy specialist with a thrombolysis-ready acute neurology unit. Active researcher in migraine prophylaxis.",
  },
  {
    email: "dr.rao@demo.clinicos.in", first: "Sridhar", last: "Rao",
    title: "Consultant Orthopedic Surgeon", specialization: "Orthopedics",
    nmc: "TS44512", city: "Hyderabad", hospital: "KIMS Hospitals Secunderabad",
    qualifications: ["MBBS", "MS (Orthopedics)", "Fellowship Joint Replacement"],
    sub_specialties: ["Knee Replacement", "Hip Replacement", "Sports Injury", "Spine"],
    condition_codes: ["M17", "M54", "M81"],
    languages: ["English", "Telugu", "Hindi"],
    insurance: ["Star Health", "ICICI Lombard", "Care Health"],
    cap: 20, received: 134, acceptance: 79.5, responseHrs: 8.4, uniqueRefs: 39, completeness: 88,
    telemedicine: false, fee: 1100,
    bio: "Joint replacement surgeon with 1500+ knee and hip arthroplasties. Minimally invasive techniques.",
  },
  {
    email: "dr.fernandes@demo.clinicos.in", first: "Maria", last: "Fernandes",
    title: "Consultant Gastroenterologist", specialization: "Gastroenterology",
    nmc: "GA15677", city: "Mumbai", hospital: "Lilavati Hospital Bandra",
    qualifications: ["MBBS", "MD (Medicine)", "DM (Gastroenterology)"],
    sub_specialties: ["IBD", "Hepatology", "Endoscopy", "GERD"],
    condition_codes: ["K21", "K29", "K76"],
    languages: ["English", "Hindi", "Konkani", "Marathi"],
    insurance: ["Star Health", "HDFC Ergo", "Bajaj Allianz", "Niva Bupa"],
    cap: 28, received: 189, acceptance: 90.3, responseHrs: 4.5, uniqueRefs: 58, completeness: 93,
    telemedicine: true, fee: 1300,
    bio: "Hepatologist and endoscopist; runs a dedicated IBD clinic. Special interest in NAFLD and viral hepatitis.",
  },
  {
    email: "dr.singh@demo.clinicos.in", first: "Harpreet", last: "Singh",
    title: "Senior Consultant Cardiologist", specialization: "Cardiology",
    nmc: "DL55881", city: "New Delhi", hospital: "Fortis Escorts Heart Institute",
    qualifications: ["MBBS", "MD (Medicine)", "DM (Cardiology)", "Fellowship Interventional Cardiology"],
    sub_specialties: ["Coronary Intervention", "Structural Heart", "TAVR", "Heart Failure"],
    condition_codes: ["I10", "I20", "I25", "I50", "I48"],
    languages: ["English", "Hindi", "Punjabi"],
    insurance: ["Star Health", "HDFC Ergo", "Care Health", "Niva Bupa"],
    cap: 35, received: 312, acceptance: 93.5, responseHrs: 2.8, uniqueRefs: 89, completeness: 98,
    telemedicine: true, fee: 1800,
    bio: "Interventional cardiologist with 4000+ coronary procedures. Pioneer in TAVR programmes in North India.",
  },
  {
    email: "dr.deshpande@demo.clinicos.in", first: "Aditi", last: "Deshpande",
    title: "Consultant Nephrologist", specialization: "Nephrology",
    nmc: "MH23901", city: "Pune", hospital: "Ruby Hall Clinic",
    qualifications: ["MBBS", "MD (Medicine)", "DNB (Nephrology)"],
    sub_specialties: ["Dialysis", "CKD", "Hypertension", "Glomerulonephritis"],
    condition_codes: ["N17", "N18", "N19", "N20", "I10"],
    languages: ["English", "Marathi", "Hindi"],
    insurance: ["Star Health", "Aditya Birla Health", "HDFC Ergo"],
    cap: 22, received: 167, acceptance: 86.8, responseHrs: 5.5, uniqueRefs: 47, completeness: 91,
    telemedicine: true, fee: 1100,
    bio: "Nephrologist managing dialysis units across Pune. Special interest in resistant hypertension and lupus nephritis.",
  },
  {
    email: "dr.bose@demo.clinicos.in", first: "Saurav", last: "Bose",
    title: "Consultant Endocrinologist", specialization: "Endocrinology",
    nmc: "WB48720", city: "Kolkata", hospital: "Apollo Gleneagles Kolkata",
    qualifications: ["MBBS", "MD (Medicine)", "DM (Endocrinology)"],
    sub_specialties: ["Diabetes", "Obesity", "Pituitary Disorders"],
    condition_codes: ["E11", "E10", "E66", "E03"],
    languages: ["English", "Bengali", "Hindi"],
    insurance: ["Star Health", "HDFC Ergo"],
    cap: 24, received: 145, acceptance: 84.1, responseHrs: 6.7, uniqueRefs: 41, completeness: 87,
    telemedicine: true, fee: 1000,
    bio: "Endocrinologist with focus on insulin pump therapy, CGM, and obesity medicine.",
  },
  {
    email: "dr.kulkarni@demo.clinicos.in", first: "Rohan", last: "Kulkarni",
    title: "Consultant Neurologist", specialization: "Neurology",
    nmc: "MH61237", city: "Mumbai", hospital: "Hinduja Hospital Mahim",
    qualifications: ["MBBS", "MD (Medicine)", "DM (Neurology)"],
    sub_specialties: ["Movement Disorders", "Parkinson's", "Botulinum Toxin Therapy"],
    condition_codes: ["G43", "G40"],
    languages: ["English", "Marathi", "Hindi"],
    insurance: ["Star Health", "ICICI Lombard", "Niva Bupa"],
    cap: 20, received: 121, acceptance: 88.9, responseHrs: 4.9, uniqueRefs: 38, completeness: 89,
    telemedicine: true, fee: 1400,
    bio: "Movement disorders specialist running a deep brain stimulation programme. EEG and EMG trained.",
  },
  {
    email: "dr.thomas@demo.clinicos.in", first: "Annie", last: "Thomas",
    title: "Consultant Pulmonologist", specialization: "Pulmonology",
    nmc: "KL09234", city: "Kochi", hospital: "Aster Medcity Kochi",
    qualifications: ["MBBS", "MD (Pulmonary Medicine)"],
    sub_specialties: ["TB", "Asthma", "Critical Care"],
    condition_codes: ["J45", "J44", "J18"],
    languages: ["English", "Malayalam", "Hindi", "Tamil"],
    insurance: ["Star Health", "Care Health", "Bajaj Allianz"],
    cap: 18, received: 98, acceptance: 81.6, responseHrs: 7.2, uniqueRefs: 28, completeness: 82,
    telemedicine: true, fee: 900,
    bio: "Pulmonologist with critical care training; manages a 20-bed respiratory ICU. Strong interest in MDR-TB.",
  },
  {
    email: "dr.shah@demo.clinicos.in", first: "Devanshi", last: "Shah",
    title: "Consultant Orthopedic Surgeon", specialization: "Orthopedics",
    nmc: "GJ77192", city: "Ahmedabad", hospital: "Sterling Hospital Ahmedabad",
    qualifications: ["MBBS", "MS (Orthopedics)", "Fellowship Spine Surgery"],
    sub_specialties: ["Spine", "Trauma", "Sports Medicine"],
    condition_codes: ["M54", "M17", "M81"],
    languages: ["English", "Gujarati", "Hindi"],
    insurance: ["Star Health", "HDFC Ergo", "Care Health"],
    cap: 16, received: 87, acceptance: 77.0, responseHrs: 9.1, uniqueRefs: 24, completeness: 80,
    telemedicine: false, fee: 1200,
    bio: "Spine surgeon with focus on minimally invasive disc and deformity correction.",
  },
  {
    email: "dr.krishnan@demo.clinicos.in", first: "Vasudha", last: "Krishnan",
    title: "Consultant Gastroenterologist", specialization: "Gastroenterology",
    nmc: "TN30188", city: "Chennai", hospital: "MIOT International",
    qualifications: ["MBBS", "MD (Medicine)", "DM (Gastroenterology)"],
    sub_specialties: ["Hepatology", "ERCP", "Pancreatic Disorders"],
    condition_codes: ["K21", "K29", "K76"],
    languages: ["English", "Tamil", "Hindi"],
    insurance: ["Star Health", "Niva Bupa", "Aditya Birla Health"],
    cap: 24, received: 156, acceptance: 89.7, responseHrs: 4.1, uniqueRefs: 49, completeness: 92,
    telemedicine: true, fee: 1300,
    bio: "Hepatologist with advanced ERCP and EUS training. Liver transplant evaluation and post-transplant care.",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clinic, error: clinicErr } = await admin
      .from("clinics").select("id, name").eq("slug", HOST_CLINIC_SLUG).maybeSingle();
    if (clinicErr || !clinic) {
      return new Response(JSON.stringify({ error: "Host clinic not found. Run seed-demo first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const created: string[] = [];
    const skipped: string[] = [];

    // List existing users once for idempotency check.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingEmails = new Set((list?.users ?? []).map((u) => u.email?.toLowerCase()).filter(Boolean) as string[]);

    for (const s of SPECIALISTS) {
      if (existingEmails.has(s.email.toLowerCase())) { skipped.push(s.email); continue; }

      const { data: u, error: uErr } = await admin.auth.admin.createUser({
        email: s.email, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: { first_name: s.first, last_name: s.last, clinic_id: clinic.id },
      });
      if (uErr || !u.user) { skipped.push(`${s.email} (auth error: ${uErr?.message})`); continue; }
      const userId = u.user.id;

      const { error: pErr } = await admin.from("profiles").insert({
        id: userId, clinic_id: clinic.id, email: s.email,
        first_name: s.first, last_name: s.last, title: s.title,
        specialization: s.specialization, bio: s.bio, consultation_fee: s.fee,
      });
      if (pErr) { skipped.push(`${s.email} (profile: ${pErr.message})`); continue; }

      await admin.from("user_roles").insert({ user_id: userId, clinic_id: clinic.id, role: "doctor" });

      const { error: dpErr } = await admin.from("doctor_profiles").insert({
        user_id: userId, clinic_id: clinic.id,
        nmc_number: s.nmc, nmc_verified: true, nmc_verified_at: new Date().toISOString(),
        qualifications: s.qualifications,
        sub_specialties: s.sub_specialties,
        condition_codes: s.condition_codes,
        hospital_affiliations: [{ name: s.hospital, role: s.title, since: 2018 }],
        teaching_hospital: s.hospital,
        academic_title: s.title,
        languages_spoken: s.languages,
        insurance_panels: s.insurance,
        telemedicine_enabled: s.telemedicine,
        accepting_referrals: true, is_public: true,
        weekly_referral_cap: s.cap,
        total_referrals_received: s.received,
        referral_acceptance_rate: s.acceptance,
        avg_response_time_hours: s.responseHrs,
        unique_referring_doctors: s.uniqueRefs,
        profile_completeness: s.completeness,
      });
      if (dpErr) { skipped.push(`${s.email} (doctor_profile: ${dpErr.message})`); continue; }

      created.push(s.email);
    }

    return new Response(JSON.stringify({
      success: true, created, skipped,
      message: `Seeded ${created.length} specialists, skipped ${skipped.length}.`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("seed-specialists error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
