#!/usr/bin/env node
/**
 * scripts/seed-patients.js
 *
 * Creates 20 test patients + ~55 encounters for Doctor Bridge.
 *   - Signs in as each of the 4 seeded doctors
 *   - Calls upsert_global_patient RPC (5 patients per doctor)
 *   - Inserts 2-3 patient_encounters per patient via REST API
 *
 * Run:  node scripts/seed-patients.js
 */

const SUPABASE_URL = "https://zvfvhndcbwfdcfessycn.supabase.co";
const ANON_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZnZobmRjYndmZGNmZXNzeWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1Mjc4ODUsImV4cCI6MjA5MjEwMzg4NX0.wsnCf7UH6ZYoKqQhrvQ_bXiKvKl_beFVazJppkrCKj0";

// ── Logging ──────────────────────────────────────────────────────────────────

const ts  = () => new Date().toISOString().slice(11, 23);
const log = (m) => console.log(`[${ts()}] ${m}`);
const ok  = (m) => console.log(`  ✓  ${m}`);
const bad = (m) => console.error(`  ✗  ${m}`);
const sep = (m) => console.log(`\n${"─".repeat(64)}\n  ${m}\n${"─".repeat(64)}`);

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function req(method, url, body, jwt) {
  const headers = {
    "Content-Type": "application/json",
    apikey:        ANON_KEY,
    Authorization: `Bearer ${jwt ?? ANON_KEY}`,
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

const postRpc  = (rpc,  body, jwt) => req("POST", `${SUPABASE_URL}/rest/v1/rpc/${rpc}`, body, jwt);
const postRest = (tbl,  body, jwt) => req("POST", `${SUPABASE_URL}/rest/v1/${tbl}`,     body, jwt);
const signIn   = (email, pw)       => req("POST",
  `${SUPABASE_URL}/auth/v1/token?grant_type=password`, { email, password: pw });

/** Extract auth uid from the JWT payload (avoids an extra /auth/v1/user round-trip) */
function jwtUserId(token) {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  return payload.sub;
}

// ── Seed data ────────────────────────────────────────────────────────────────
// Phone numbers are all unique so upsert_global_patient never de-dupes across doctors.

const DOCTORS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DR. PRIYA SHARMA — Cardiologist, Agarwal Medical Centre, Raipur
  // ═══════════════════════════════════════════════════════════════════════════
  {
    email:           "priya.sharma@agarwalmedical.in",
    password:        "Doctor@12345",
    doctorName:      "Dr. Priya Sharma",
    hospitalName:    "Agarwal Medical Centre",
    hospitalClinicId:"93d2db29-4293-4da4-af93-237ca0dbdef6",
    patients: [
      {
        _first_name: "Ramesh",   _last_name: "Kumar",
        _phone: "+919876541001", _dob: "1958-03-15", _gender: "MALE",
        _blood_group: "A+", _city: "New Delhi", _state: "Delhi", _pincode: "110001",
        encounters: [
          { type: "VISIT", title: "Chest pain evaluation",
            occurred_at: "2026-02-12T09:30:00Z",
            details: "65-year-old male presenting with chest tightness on moderate exertion for 2 weeks. No radiation to arm. HTN history × 10 years.",
            data: { chief_complaint: "Chest tightness on exertion", bp_systolic: 152, bp_diastolic: 96, heart_rate: 88, temperature: 37.1, weight: 78, spo2: 97 } },
          { type: "DIAGNOSIS", title: "Hypertensive Heart Disease",
            occurred_at: "2026-02-12T10:15:00Z",
            details: "Echo: mild LVH. BP diary average 150/94. Increased CVD risk. Statin initiated.",
            data: { diagnosis_name: "Hypertensive heart disease without heart failure", icd_code: "I11.9", severity: "Moderate", notes: "LVH on echocardiogram. Statin indicated for CVD risk reduction." } },
          { type: "PRESCRIPTION", title: "Antihypertensive + Statin",
            occurred_at: "2026-02-12T10:30:00Z",
            details: "Review BP in 4 weeks. Low-salt diet counselled.",
            data: { medications: [
              { name: "Amlodipine",   dose: "5 mg",  frequency: "Once daily",        duration: "90 days" },
              { name: "Atorvastatin", dose: "20 mg", frequency: "Once daily at night", duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Savita",   _last_name: "Patel",
        _phone: "+919876541002", _dob: "1972-07-22", _gender: "FEMALE",
        _blood_group: "B+", _city: "Ahmedabad", _state: "Gujarat", _pincode: "380001",
        encounters: [
          { type: "VISIT", title: "Palpitations & irregular heartbeat",
            occurred_at: "2026-02-18T11:00:00Z",
            details: "51-year-old female with 3-week history of episodic palpitations, mild dizziness. No syncope.",
            data: { chief_complaint: "Episodic palpitations and dizziness", bp_systolic: 130, bp_diastolic: 85, heart_rate: 98, temperature: 36.8, weight: 64, spo2: 99 } },
          { type: "DIAGNOSIS", title: "Paroxysmal Atrial Fibrillation",
            occurred_at: "2026-02-18T12:00:00Z",
            details: "24-hour Holter: multiple AF episodes, longest 4 min. Thyroid function normal.",
            data: { diagnosis_name: "Paroxysmal atrial fibrillation", icd_code: "I48.0", severity: "Mild", notes: "CHA2DS2-VASc score 2. Anticoagulation and rate control initiated." } },
          { type: "PRESCRIPTION", title: "Rate control & anticoagulation",
            occurred_at: "2026-02-18T12:20:00Z",
            details: "Cardiology review in 6 weeks. Advised to report any bleeding symptoms.",
            data: { medications: [
              { name: "Metoprolol Succinate", dose: "25 mg", frequency: "Twice daily", duration: "60 days" },
              { name: "Rivaroxaban",          dose: "20 mg", frequency: "Once daily with dinner", duration: "60 days" },
            ] } },
        ],
      },
      {
        _first_name: "Mohan",    _last_name: "Singh",
        _phone: "+919876541003", _dob: "1965-11-08", _gender: "MALE",
        _blood_group: "O+", _city: "Chandigarh", _state: "Chandigarh", _pincode: "160001",
        encounters: [
          { type: "VISIT", title: "Dyspnoea on exertion",
            occurred_at: "2026-03-05T09:00:00Z",
            details: "58-year-old male with progressive breathlessness on climbing stairs. Bilateral ankle oedema noted on examination.",
            data: { chief_complaint: "Breathlessness on exertion and ankle swelling", bp_systolic: 148, bp_diastolic: 92, heart_rate: 84, temperature: 37.0, weight: 82, spo2: 95 } },
          { type: "DIAGNOSIS", title: "Congestive Heart Failure — HFrEF",
            occurred_at: "2026-03-05T10:30:00Z",
            details: "Echo EF 38%. LVEDV raised. Bilateral basal crepitations. BNP elevated.",
            data: { diagnosis_name: "Heart failure with reduced ejection fraction", icd_code: "I50.20", severity: "Moderate", notes: "EF 38% on echo. Neurohormonal blockade commenced." } },
          { type: "PRESCRIPTION", title: "HFrEF regimen",
            occurred_at: "2026-03-05T11:00:00Z",
            details: "Fluid restriction 1.5L/day. Daily weight monitoring. Cardiology follow-up in 2 weeks.",
            data: { medications: [
              { name: "Sacubitril/Valsartan", dose: "50 mg", frequency: "Twice daily", duration: "90 days" },
              { name: "Furosemide",           dose: "40 mg", frequency: "Once daily morning", duration: "30 days" },
              { name: "Spironolactone",       dose: "25 mg", frequency: "Once daily", duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Lakshmi",  _last_name: "Iyer",
        _phone: "+919876541004", _dob: "1980-04-30", _gender: "FEMALE",
        _blood_group: "AB+", _city: "Chennai", _state: "Tamil Nadu", _pincode: "600001",
        encounters: [
          { type: "VISIT", title: "Fatigue and exertional chest discomfort",
            occurred_at: "2026-03-15T10:00:00Z",
            details: "43-year-old female. Intermittent atypical chest pain and fatigue for 3 months. No cardiovascular risk factors.",
            data: { chief_complaint: "Fatigue and mild exertional chest discomfort", bp_systolic: 118, bp_diastolic: 76, heart_rate: 72, temperature: 36.9, weight: 58, spo2: 99 } },
          { type: "DIAGNOSIS", title: "Mitral Valve Prolapse",
            occurred_at: "2026-03-15T11:30:00Z",
            details: "Echo: posterior leaflet MVP with trivial MR. No significant haemodynamic compromise.",
            data: { diagnosis_name: "Mitral valve prolapse without regurgitation", icd_code: "I34.1", severity: "Mild", notes: "MVP confirmed on echo. Annual surveillance echo recommended." } },
        ],
      },
      {
        _first_name: "Suresh",   _last_name: "Agarwal",
        _phone: "+919876541005", _dob: "1950-09-12", _gender: "MALE",
        _blood_group: "A-", _city: "Lucknow", _state: "Uttar Pradesh", _pincode: "226001",
        encounters: [
          { type: "VISIT", title: "Acute chest pain",
            occurred_at: "2026-04-01T08:15:00Z",
            details: "73-year-old male presenting to OPD with central chest pain radiating to left arm, onset 2 hours ago. Diaphoretic. Known diabetic.",
            data: { chief_complaint: "Central chest pain radiating to left arm", bp_systolic: 162, bp_diastolic: 102, heart_rate: 94, temperature: 37.2, weight: 74, spo2: 94 } },
          { type: "DIAGNOSIS", title: "Unstable Angina",
            occurred_at: "2026-04-01T09:00:00Z",
            details: "ECG: ST depression V4-V6. Troponin borderline. Referred for urgent cath.",
            data: { diagnosis_name: "Unstable angina", icd_code: "I20.0", severity: "Severe", notes: "ST depression on ECG leads V4–V6. Troponin I mildly elevated. Urgent cardiology referral placed." } },
          { type: "PRESCRIPTION", title: "ACS loading + anticoagulation",
            occurred_at: "2026-04-01T09:15:00Z",
            details: "Admitted to CCU. Cath lab booked. Aspirin and P2Y12 loaded.",
            data: { medications: [
              { name: "Aspirin",     dose: "300 mg", frequency: "Loading dose, then 75 mg OD", duration: "Ongoing" },
              { name: "Clopidogrel", dose: "600 mg", frequency: "Loading dose, then 75 mg OD",  duration: "Ongoing" },
              { name: "Enoxaparin",  dose: "1 mg/kg", frequency: "Subcutaneous twice daily",    duration: "5 days" },
            ] } },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DR. VIKRAM DESAI — Neurologist, Agarwal Medical Centre, Raipur
  // ═══════════════════════════════════════════════════════════════════════════
  {
    email:           "vikram.desai@agarwalmedical.in",
    password:        "Doctor@12345",
    doctorName:      "Dr. Vikram Desai",
    hospitalName:    "Agarwal Medical Centre",
    hospitalClinicId:"93d2db29-4293-4da4-af93-237ca0dbdef6",
    patients: [
      {
        _first_name: "Anita",    _last_name: "Sharma",
        _phone: "+919876541006", _dob: "1985-06-18", _gender: "FEMALE",
        _blood_group: "B-", _city: "Jaipur", _state: "Rajasthan", _pincode: "302001",
        encounters: [
          { type: "VISIT", title: "Recurrent severe headaches",
            occurred_at: "2026-02-20T10:00:00Z",
            details: "38-year-old female with 6-month history of unilateral throbbing headaches lasting 4-72 h, associated with nausea and photophobia.",
            data: { chief_complaint: "Severe unilateral throbbing headache with nausea", bp_systolic: 122, bp_diastolic: 80, heart_rate: 76, temperature: 37.0, weight: 56, spo2: 99 } },
          { type: "DIAGNOSIS", title: "Migraine without Aura",
            occurred_at: "2026-02-20T11:00:00Z",
            details: "Meets ICHD-3 criteria for episodic migraine without aura. MRI brain normal. Triggers: stress and disrupted sleep.",
            data: { diagnosis_name: "Migraine without aura", icd_code: "G43.0", severity: "Moderate", notes: "MIDAS grade III (moderate disability). Prophylaxis initiated." } },
          { type: "PRESCRIPTION", title: "Migraine abortive + prophylaxis",
            occurred_at: "2026-02-20T11:20:00Z",
            details: "Headache diary advised. Review in 8 weeks to assess prophylaxis response.",
            data: { medications: [
              { name: "Sumatriptan",  dose: "50 mg",  frequency: "At onset, may repeat after 2 h if needed", duration: "PRN" },
              { name: "Topiramate",   dose: "25 mg",  frequency: "Once daily at night, titrate to 50 mg",    duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Rajiv",    _last_name: "Nair",
        _phone: "+919876541007", _dob: "1978-01-25", _gender: "MALE",
        _blood_group: "O+", _city: "Kochi", _state: "Kerala", _pincode: "682001",
        encounters: [
          { type: "VISIT", title: "Memory lapses and confusion",
            occurred_at: "2026-03-08T09:30:00Z",
            details: "45-year-old male brought by wife. Progressive forgetfulness over 1 year. Getting lost on familiar routes. MMSE 22/30.",
            data: { chief_complaint: "Progressive memory loss and disorientation", bp_systolic: 136, bp_diastolic: 88, heart_rate: 78, temperature: 37.1, weight: 72, spo2: 98 } },
          { type: "DIAGNOSIS", title: "Early Alzheimer's Disease",
            occurred_at: "2026-03-08T11:00:00Z",
            details: "MRI: hippocampal atrophy bilaterally. PET: temporo-parietal hypometabolism. CSF biomarkers consistent with AD.",
            data: { diagnosis_name: "Alzheimer's disease with early onset", icd_code: "G30.0", severity: "Mild", notes: "MMSE 22/30. Cholinesterase inhibitor started. Caregiver education provided." } },
          { type: "PRESCRIPTION", title: "Cognitive enhancer therapy",
            occurred_at: "2026-03-08T11:30:00Z",
            details: "3-monthly MMSE monitoring. OT referral made. Safety assessment at home recommended.",
            data: { medications: [
              { name: "Donepezil", dose: "5 mg", frequency: "Once daily at night", duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Preethi",  _last_name: "Menon",
        _phone: "+919876541008", _dob: "1992-12-03", _gender: "FEMALE",
        _blood_group: "A+", _city: "Bengaluru", _state: "Karnataka", _pincode: "560001",
        encounters: [
          { type: "VISIT", title: "Post-seizure assessment",
            occurred_at: "2026-03-12T14:00:00Z",
            details: "31-year-old female. First witnessed generalised tonic-clonic seizure this morning. No prior episodes. No head trauma or fever.",
            data: { chief_complaint: "First unprovoked generalised seizure", bp_systolic: 112, bp_diastolic: 72, heart_rate: 70, temperature: 36.8, weight: 52, spo2: 100 } },
          { type: "DIAGNOSIS", title: "Juvenile Myoclonic Epilepsy",
            occurred_at: "2026-03-12T15:30:00Z",
            details: "EEG: generalised 4-6 Hz spike-and-wave discharges, enhanced on photic stimulation. History of early-morning myoclonic jerks confirmed.",
            data: { diagnosis_name: "Juvenile myoclonic epilepsy", icd_code: "G40.3", severity: "Moderate", notes: "EEG confirms JME pattern. Driving restrictions discussed. Sleep hygiene emphasised." } },
          { type: "PRESCRIPTION", title: "Anti-seizure medication",
            occurred_at: "2026-03-12T15:45:00Z",
            details: "Lifestyle modifications counselled: regular sleep, avoid alcohol. MRI brain booked.",
            data: { medications: [
              { name: "Sodium Valproate", dose: "500 mg", frequency: "Twice daily with food", duration: "180 days" },
            ] } },
        ],
      },
      {
        _first_name: "Deepak",   _last_name: "Verma",
        _phone: "+919876541009", _dob: "1969-08-14", _gender: "MALE",
        _blood_group: "B+", _city: "Bhopal", _state: "Madhya Pradesh", _pincode: "462001",
        encounters: [
          { type: "VISIT", title: "Tremors and gait disturbance",
            occurred_at: "2026-03-20T10:30:00Z",
            details: "54-year-old male. 18-month history of right-hand pill-rolling tremor at rest, shuffling gait, and micrographia. Positive cogwheel rigidity.",
            data: { chief_complaint: "Resting tremor of right hand, slow gait", bp_systolic: 126, bp_diastolic: 82, heart_rate: 68, temperature: 36.9, weight: 68, spo2: 98 } },
          { type: "DIAGNOSIS", title: "Parkinson's Disease",
            occurred_at: "2026-03-20T11:30:00Z",
            details: "UK Parkinson's Disease Brain Bank criteria met. DaT SPECT scan confirmed presynaptic dopaminergic deficit.",
            data: { diagnosis_name: "Parkinson's disease", icd_code: "G20", severity: "Moderate (H&Y stage 2)", notes: "DaT SPECT: reduced uptake bilaterally, R>L. Levodopa trial commenced." } },
          { type: "PRESCRIPTION", title: "Dopaminergic therapy",
            occurred_at: "2026-03-20T11:45:00Z",
            details: "Physio and OT referrals placed. UPDRS baseline documented. Review in 6 weeks.",
            data: { medications: [
              { name: "Levodopa/Carbidopa", dose: "100/25 mg", frequency: "Three times daily 30 min before meals", duration: "90 days" },
              { name: "Pramipexole",         dose: "0.5 mg",    frequency: "Twice daily",                           duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Kavitha",  _last_name: "Reddy",
        _phone: "+919876541010", _dob: "1955-03-27", _gender: "FEMALE",
        _blood_group: "O-", _city: "Hyderabad", _state: "Telangana", _pincode: "500001",
        encounters: [
          { type: "VISIT", title: "Limb weakness and numbness",
            occurred_at: "2026-04-05T09:00:00Z",
            details: "68-year-old female with 6-month progressive numbness in both hands and difficulty gripping. Walks with slight broad-based gait.",
            data: { chief_complaint: "Bilateral hand numbness and weak grip", bp_systolic: 142, bp_diastolic: 90, heart_rate: 74, temperature: 37.0, weight: 62, spo2: 97 } },
          { type: "DIAGNOSIS", title: "Cervical Spondylosis with Myelopathy",
            occurred_at: "2026-04-05T10:30:00Z",
            details: "MRI cervical spine: multilevel disc degeneration with cord compression at C4-C5 and C5-C6. Myelomalacia signal change.",
            data: { diagnosis_name: "Cervical spondylosis with myelopathy", icd_code: "M47.12", severity: "Moderate", notes: "C4-C5 and C5-C6 cord compression on MRI. Neurosurgery referral placed urgently." } },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DR. ARJUN MEHTA — Orthopaedic Surgeon, City Hospital Mumbai
  // ═══════════════════════════════════════════════════════════════════════════
  {
    email:           "arjun.mehta@cityhospitalmumbai.in",
    password:        "Doctor@12345",
    doctorName:      "Dr. Arjun Mehta",
    hospitalName:    "City Hospital Mumbai",
    hospitalClinicId:"cb7b476e-6589-45bf-8064-ac4fa52c5b93",
    patients: [
      {
        _first_name: "Shivaji",  _last_name: "Patil",
        _phone: "+919876541011", _dob: "1962-05-20", _gender: "MALE",
        _blood_group: "A+", _city: "Pune", _state: "Maharashtra", _pincode: "411001",
        encounters: [
          { type: "VISIT", title: "Bilateral knee pain",
            occurred_at: "2026-02-14T11:00:00Z",
            details: "61-year-old male. 2-year history of bilateral knee pain, worse on stairs and rising from sitting. Crepitus noted bilaterally. BMI 29.",
            data: { chief_complaint: "Bilateral knee pain worse on stair climbing", bp_systolic: 138, bp_diastolic: 86, heart_rate: 76, temperature: 36.9, weight: 81, spo2: 98 } },
          { type: "DIAGNOSIS", title: "Bilateral Knee Osteoarthritis",
            occurred_at: "2026-02-14T12:00:00Z",
            details: "X-ray: Kellgren-Lawrence grade III bilateral medial compartment OA. Joint space reduced. Osteophytes present.",
            data: { diagnosis_name: "Primary osteoarthritis of both knees", icd_code: "M17.1", severity: "Moderate-severe (KL grade III)", notes: "X-ray KL grade III bilaterally. Weight loss and physiotherapy commenced. TKR discussed for future." } },
          { type: "PRESCRIPTION", title: "OA management",
            occurred_at: "2026-02-14T12:15:00Z",
            details: "Referred to physiotherapy. Weight reduction target 5 kg over 3 months. Review in 6 weeks.",
            data: { medications: [
              { name: "Diclofenac",   dose: "50 mg",  frequency: "Twice daily with food",      duration: "30 days" },
              { name: "Omeprazole",   dose: "20 mg",  frequency: "Once daily (gastric cover)",  duration: "30 days" },
              { name: "Glucosamine Sulphate", dose: "500 mg", frequency: "Three times daily",   duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Neha",     _last_name: "Joshi",
        _phone: "+919876541012", _dob: "1990-09-11", _gender: "FEMALE",
        _blood_group: "B+", _city: "Nagpur", _state: "Maharashtra", _pincode: "440001",
        encounters: [
          { type: "VISIT", title: "Low back pain after fall",
            occurred_at: "2026-02-25T10:00:00Z",
            details: "33-year-old female. Acute low back pain after slipping in bathroom 5 days ago. Pain radiating to left leg below knee. Positive SLR left at 40°.",
            data: { chief_complaint: "Low back pain with radiation to left leg", bp_systolic: 114, bp_diastolic: 74, heart_rate: 80, temperature: 36.8, weight: 58, spo2: 99 } },
          { type: "DIAGNOSIS", title: "L4–L5 Disc Herniation",
            occurred_at: "2026-02-25T11:30:00Z",
            details: "MRI lumbar: large central-left paracentral L4-L5 disc extrusion compressing left L5 nerve root.",
            data: { diagnosis_name: "Intervertebral disc herniation L4-L5", icd_code: "M51.1", severity: "Moderate", notes: "MRI confirms L4-L5 disc extrusion with L5 root compression. Conservative management first; surgery if no improvement in 6 weeks." } },
          { type: "PRESCRIPTION", title: "Disc herniation management",
            occurred_at: "2026-02-25T11:45:00Z",
            details: "Rest for 2 weeks then graded physiotherapy. Epidural steroid injection discussed as next step.",
            data: { medications: [
              { name: "Etoricoxib",        dose: "90 mg",  frequency: "Once daily with food",  duration: "14 days" },
              { name: "Pregabalin",         dose: "75 mg",  frequency: "Twice daily",           duration: "30 days" },
              { name: "Methocarbamol",      dose: "500 mg", frequency: "Three times daily",     duration: "14 days" },
            ] } },
        ],
      },
      {
        _first_name: "Arun",     _last_name: "Desai",
        _phone: "+919876541013", _dob: "1975-02-28", _gender: "MALE",
        _blood_group: "O+", _city: "Kolhapur", _state: "Maharashtra", _pincode: "416001",
        encounters: [
          { type: "VISIT", title: "Right shoulder pain and restricted movement",
            occurred_at: "2026-03-10T09:30:00Z",
            details: "48-year-old male, manual worker. 3-month history of right shoulder pain, cannot abduct beyond 80°. Night pain disturbing sleep.",
            data: { chief_complaint: "Right shoulder pain with restricted abduction", bp_systolic: 128, bp_diastolic: 80, heart_rate: 72, temperature: 37.1, weight: 76, spo2: 99 } },
          { type: "DIAGNOSIS", title: "Partial Rotator Cuff Tear",
            occurred_at: "2026-03-10T10:30:00Z",
            details: "MRI shoulder: partial-thickness articular-sided supraspinatus tear, 60% thickness. No full-thickness tear. Subacromial bursitis.",
            data: { diagnosis_name: "Rotator cuff tear, partial thickness", icd_code: "M75.1", severity: "Moderate", notes: "MRI: partial supraspinatus tear with bursitis. Subacromial corticosteroid injection given. Physiotherapy commenced." } },
          { type: "PRESCRIPTION", title: "Shoulder rehabilitation",
            occurred_at: "2026-03-10T10:45:00Z",
            details: "Physio plan for 8 weeks. Activity modification. Repeat MRI in 3 months if no improvement.",
            data: { medications: [
              { name: "Ibuprofen",   dose: "400 mg", frequency: "Three times daily with food", duration: "14 days" },
              { name: "Pantoprazole", dose: "40 mg",  frequency: "Once daily (gastric cover)",  duration: "14 days" },
            ] } },
        ],
      },
      {
        _first_name: "Sunanda",  _last_name: "Kulkarni",
        _phone: "+919876541014", _dob: "1948-10-05", _gender: "FEMALE",
        _blood_group: "AB-", _city: "Nashik", _state: "Maharashtra", _pincode: "422001",
        encounters: [
          { type: "VISIT", title: "Hip pain and difficulty walking",
            occurred_at: "2026-03-22T10:00:00Z",
            details: "75-year-old female. Progressive right hip pain for 2 years, now unable to walk > 100 m without pain. Antalgic gait. Limited internal rotation.",
            data: { chief_complaint: "Right hip pain with restricted walking", bp_systolic: 148, bp_diastolic: 88, heart_rate: 80, temperature: 36.9, weight: 60, spo2: 97 } },
          { type: "DIAGNOSIS", title: "Severe Hip Osteoarthritis",
            occurred_at: "2026-03-22T11:00:00Z",
            details: "X-ray: obliteration of right hip joint space, subchondral cysts, large osteophytes. Kellgren-Lawrence grade IV.",
            data: { diagnosis_name: "Primary osteoarthritis of right hip", icd_code: "M16.1", severity: "Severe (KL grade IV)", notes: "X-ray confirms severe right hip OA. Total hip replacement discussed and planned. Pre-op assessment initiated." } },
        ],
      },
      {
        _first_name: "Vinay",    _last_name: "Sawant",
        _phone: "+919876541015", _dob: "1988-07-16", _gender: "MALE",
        _blood_group: "A-", _city: "Thane", _state: "Maharashtra", _pincode: "400601",
        encounters: [
          { type: "VISIT", title: "Acute ankle sprain",
            occurred_at: "2026-04-10T14:00:00Z",
            details: "35-year-old male. Inversion injury of left ankle while playing cricket 2 days ago. Lateral swelling and bruising. Weight-bearing painful.",
            data: { chief_complaint: "Left ankle swelling and pain after sports injury", bp_systolic: 118, bp_diastolic: 76, heart_rate: 82, temperature: 36.8, weight: 73, spo2: 99 } },
          { type: "DIAGNOSIS", title: "Grade II Lateral Ankle Sprain",
            occurred_at: "2026-04-10T14:30:00Z",
            details: "X-ray: no fracture. ATFL tender on palpation. Partial ligament tear on clinical assessment. Ottawa criteria negative for fracture.",
            data: { diagnosis_name: "Sprain of ankle, lateral ligament complex", icd_code: "S93.401", severity: "Grade II (partial tear)", notes: "X-ray negative. ATFL partial tear clinically. RICE protocol. Functional rehabilitation programme." } },
          { type: "PRESCRIPTION", title: "Ankle sprain management",
            occurred_at: "2026-04-10T14:45:00Z",
            details: "Crepe bandage applied. Crutches for 1 week. Proprioceptive exercises after 3 days.",
            data: { medications: [
              { name: "Diclofenac Gel 1%",  dose: "Apply topically", frequency: "Three times daily", duration: "10 days" },
              { name: "Paracetamol",         dose: "500 mg",          frequency: "Four times daily PRN", duration: "7 days" },
            ] } },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DR. SUNITA RAO — General Physician, City Hospital Mumbai
  // ═══════════════════════════════════════════════════════════════════════════
  {
    email:           "sunita.rao@cityhospitalmumbai.in",
    password:        "Doctor@12345",
    doctorName:      "Dr. Sunita Rao",
    hospitalName:    "City Hospital Mumbai",
    hospitalClinicId:"cb7b476e-6589-45bf-8064-ac4fa52c5b93",
    patients: [
      {
        _first_name: "Fatima",   _last_name: "Sheikh",
        _phone: "+919876541016", _dob: "1983-04-08", _gender: "FEMALE",
        _blood_group: "O+", _city: "Mumbai", _state: "Maharashtra", _pincode: "400001",
        encounters: [
          { type: "VISIT", title: "Fever and sore throat",
            occurred_at: "2026-02-08T09:00:00Z",
            details: "40-year-old female. 3-day history of fever (38.8°C at home), severe sore throat, difficulty swallowing. Tonsillar exudate present.",
            data: { chief_complaint: "Fever with severe sore throat for 3 days", bp_systolic: 110, bp_diastolic: 72, heart_rate: 96, temperature: 38.8, weight: 60, spo2: 98 } },
          { type: "DIAGNOSIS", title: "Acute Bacterial Pharyngotonsillitis",
            occurred_at: "2026-02-08T09:30:00Z",
            details: "Centor score 4. Rapid strep test positive. Bilateral tonsillar enlargement with white exudate.",
            data: { diagnosis_name: "Acute pharyngotonsillitis, bacterial", icd_code: "J02.0", severity: "Moderate", notes: "Rapid strep positive. Centor score 4. Antibiotic therapy warranted." } },
          { type: "PRESCRIPTION", title: "Antibiotic + symptomatic relief",
            occurred_at: "2026-02-08T09:45:00Z",
            details: "Review in 48 h if no improvement. Complete full antibiotic course.",
            data: { medications: [
              { name: "Amoxicillin",  dose: "500 mg",  frequency: "Three times daily",      duration: "7 days" },
              { name: "Paracetamol", dose: "650 mg",  frequency: "Four times daily PRN",    duration: "5 days" },
              { name: "Benzydamine Gargle", dose: "0.15%", frequency: "Every 3 hours",      duration: "5 days" },
            ] } },
        ],
      },
      {
        _first_name: "Ramkumar", _last_name: "Pillai",
        _phone: "+919876541017", _dob: "1970-11-30", _gender: "MALE",
        _blood_group: "B+", _city: "Mumbai", _state: "Maharashtra", _pincode: "400002",
        encounters: [
          { type: "VISIT", title: "Fatigue and unexplained weight gain",
            occurred_at: "2026-02-22T10:30:00Z",
            details: "52-year-old male. 6-month history of fatigue, cold intolerance, constipation, and 5 kg weight gain. Dry skin and bradycardia on examination.",
            data: { chief_complaint: "Fatigue, weight gain and cold intolerance for 6 months", bp_systolic: 130, bp_diastolic: 84, heart_rate: 56, temperature: 36.3, weight: 84, spo2: 98 } },
          { type: "DIAGNOSIS", title: "Hypothyroidism",
            occurred_at: "2026-02-22T11:30:00Z",
            details: "TSH 18.4 mU/L (high), fT4 7.2 pmol/L (low). TPO antibodies strongly positive. Primary autoimmune hypothyroidism.",
            data: { diagnosis_name: "Hypothyroidism, primary", icd_code: "E03.9", severity: "Moderate (TSH 18.4)", notes: "TSH 18.4, fT4 low, TPO-Ab positive. Hashimoto thyroiditis. Levothyroxine replacement commenced." } },
          { type: "PRESCRIPTION", title: "Thyroid hormone replacement",
            occurred_at: "2026-02-22T11:45:00Z",
            details: "TFTs to be rechecked in 6-8 weeks. Fasting morning dose 30 min before food.",
            data: { medications: [
              { name: "Levothyroxine", dose: "50 mcg", frequency: "Once daily fasting, 30 min before breakfast", duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Geeta",    _last_name: "Mishra",
        _phone: "+919876541018", _dob: "1960-07-19", _gender: "FEMALE",
        _blood_group: "A+", _city: "Mumbai", _state: "Maharashtra", _pincode: "400003",
        encounters: [
          { type: "VISIT", title: "Uncontrolled blood glucose",
            occurred_at: "2026-03-03T09:00:00Z",
            details: "63-year-old female with T2DM × 8 years. Recent RBS readings 250-310 mg/dL. Polyuria, polydipsia. Weight loss of 3 kg in 2 months.",
            data: { chief_complaint: "Polyuria, polydipsia and high blood sugar readings", bp_systolic: 140, bp_diastolic: 88, heart_rate: 78, temperature: 37.0, weight: 66, spo2: 98 } },
          { type: "DIAGNOSIS", title: "Type 2 Diabetes — Poorly Controlled",
            occurred_at: "2026-03-03T10:00:00Z",
            details: "HbA1c 10.2%. eGFR 68 ml/min/1.73m². Urine microalbumin 45 mg/24h. Diabetic nephropathy stage 2.",
            data: { diagnosis_name: "Type 2 diabetes mellitus with diabetic nephropathy", icd_code: "E11.65", severity: "Uncontrolled (HbA1c 10.2%)", notes: "HbA1c 10.2%. Microalbuminuria present — nephropathy stage 2. Intensification of glycaemic control and renal protection." } },
          { type: "PRESCRIPTION", title: "Intensified diabetes regimen",
            occurred_at: "2026-03-03T10:30:00Z",
            details: "Diabetologist co-management. HbA1c target < 7.5%. Diet counselling. SMBG twice daily.",
            data: { medications: [
              { name: "Metformin",      dose: "1000 mg", frequency: "Twice daily with meals",        duration: "90 days" },
              { name: "Glimepiride",    dose: "2 mg",    frequency: "Once daily before breakfast",   duration: "90 days" },
              { name: "Empagliflozin", dose: "10 mg",   frequency: "Once daily (renal protection)", duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Ajit",     _last_name: "Pawar",
        _phone: "+919876541019", _dob: "1995-01-14", _gender: "MALE",
        _blood_group: "AB+", _city: "Mumbai", _state: "Maharashtra", _pincode: "400004",
        encounters: [
          { type: "VISIT", title: "Acne and facial skin changes",
            occurred_at: "2026-03-18T11:00:00Z",
            details: "29-year-old male. Persistent acne for 2 years, not responding to topical treatment. Grade III acne on face and upper back.",
            data: { chief_complaint: "Persistent moderate-severe acne on face and back", bp_systolic: 118, bp_diastolic: 76, heart_rate: 74, temperature: 36.7, weight: 70, spo2: 100 } },
          { type: "DIAGNOSIS", title: "Moderate-Severe Acne Vulgaris",
            occurred_at: "2026-03-18T11:30:00Z",
            details: "Multiple comedones, papules, and pustules on face and upper back. Grade III (moderate-severe). No cysts.",
            data: { diagnosis_name: "Acne vulgaris, moderate-severe", icd_code: "L70.0", severity: "Grade III", notes: "Topical treatment failed. Systemic antibiotic and topical retinoid initiated." } },
          { type: "PRESCRIPTION", title: "Systemic acne treatment",
            occurred_at: "2026-03-18T11:45:00Z",
            details: "Dermatology referral placed for consideration of isotretinoin. Sun protection advised.",
            data: { medications: [
              { name: "Doxycycline",         dose: "100 mg",  frequency: "Once daily with food",        duration: "56 days" },
              { name: "Adapalene 0.1% Gel",  dose: "Pea-size", frequency: "Once nightly on affected areas", duration: "90 days" },
              { name: "Clindamycin 1% Lotion", dose: "Apply",  frequency: "Twice daily",                   duration: "90 days" },
            ] } },
        ],
      },
      {
        _first_name: "Anjali",   _last_name: "Bhatt",
        _phone: "+919876541020", _dob: "1977-08-25", _gender: "FEMALE",
        _blood_group: "O-", _city: "Mumbai", _state: "Maharashtra", _pincode: "400005",
        encounters: [
          { type: "VISIT", title: "Persistent cough with fever",
            occurred_at: "2026-04-08T08:30:00Z",
            details: "46-year-old female. 7-day history of productive cough with purulent sputum, fever (39.1°C), pleuritic chest pain. Bronchial breathing right lower zone.",
            data: { chief_complaint: "7-day productive cough with fever and right-sided chest pain", bp_systolic: 118, bp_diastolic: 76, heart_rate: 102, temperature: 39.1, weight: 62, spo2: 92 } },
          { type: "DIAGNOSIS", title: "Community-Acquired Pneumonia",
            occurred_at: "2026-04-08T09:30:00Z",
            details: "CXR: right lower lobe consolidation. WBC 16.8 × 10⁹/L, CRP 148. CURB-65 score 1. Outpatient treatment appropriate.",
            data: { diagnosis_name: "Community-acquired pneumonia, unspecified", icd_code: "J18.9", severity: "Moderate (CURB-65: 1, SpO2 92%)", notes: "CXR RLL consolidation. CURB-65 score 1. Oral antibiotics, review in 48 h, admission if SpO2 worsens." } },
          { type: "PRESCRIPTION", title: "Pneumonia antibiotic regimen",
            occurred_at: "2026-04-08T09:45:00Z",
            details: "Review in 48 h mandatory. ER if SpO2 drops below 90% or increased breathlessness.",
            data: { medications: [
              { name: "Amoxicillin-Clavulanate", dose: "625 mg",    frequency: "Three times daily",        duration: "7 days" },
              { name: "Azithromycin",             dose: "500 mg",    frequency: "Once daily",               duration: "5 days" },
              { name: "Salbutamol Inhaler",       dose: "2 puffs",   frequency: "Four times daily PRN",     duration: "10 days" },
              { name: "Paracetamol",              dose: "650 mg",    frequency: "Four times daily PRN",     duration: "5 days" },
            ] } },
        ],
      },
    ],
  },
];

// ── REST helper for table inserts (needs Prefer: return=representation) ───────

async function insertRow(table, row, jwt) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Prefer":        "return=representation",
      apikey:          ANON_KEY,
      Authorization:  `Bearer ${jwt}`,
    },
    body: JSON.stringify(row),
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { status: res.status, data };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  sep("Doctor Bridge — Patient & Encounter Seed");
  log(`Target: ${SUPABASE_URL}`);

  const summary = [];   // for final table

  for (const doctor of DOCTORS) {
    sep(`DOCTOR: ${doctor.doctorName}  (${doctor.hospitalName})`);

    // 1. Sign in ──────────────────────────────────────────────────────────────
    log(`Signing in as ${doctor.email}…`);
    const { status: authSt, data: authData } = await signIn(doctor.email, doctor.password);
    if (!authData.access_token) {
      bad(`Sign-in failed (HTTP ${authSt}): ${JSON.stringify(authData)}`);
      continue;
    }
    const jwt       = authData.access_token;
    const doctorUid = jwtUserId(jwt);
    ok(`Signed in  uid=${doctorUid}`);

    // 2. Create patients + encounters ─────────────────────────────────────────
    for (const patient of doctor.patients) {
      const fullName = `${patient._first_name} ${patient._last_name}`;
      log(`\n  Patient: ${fullName}  (${patient._dob}, ${patient._gender}, ${patient._blood_group})`);

      // upsert_global_patient RPC
      const rpcArgs = {
        _first_name:  patient._first_name,
        _last_name:   patient._last_name,
        _phone:       patient._phone,
        _dob:         patient._dob,
        _gender:      patient._gender,
        _blood_group: patient._blood_group,
        _city:        patient._city,
        _state:       patient._state,
        _pincode:     patient._pincode,
      };
      const { status: pSt, data: pData } = await postRpc("upsert_global_patient", rpcArgs, jwt);

      // RPC returns a plain UUID string (PostgREST scalar response)
      const patientId = typeof pData === "string" ? pData : pData?.id ?? pData;

      if (pSt !== 200 || !patientId) {
        bad(`upsert_global_patient HTTP ${pSt}: ${JSON.stringify(pData)}`);
        continue;
      }
      ok(`Patient upserted  id=${patientId}`);

      // Create encounters
      const encResults = [];
      for (const enc of patient.encounters) {
        const row = {
          global_patient_id: patientId,
          doctor_user_id:    doctorUid,
          doctor_name:       doctor.doctorName,
          type:              enc.type,
          title:             enc.title,
          data:              enc.data,
          details:           enc.details ?? null,
          hospital_name:     doctor.hospitalName,
          hospital_clinic_id: doctor.hospitalClinicId,
          occurred_at:       enc.occurred_at,
          attachments:       [],
        };

        const { status: eSt, data: eData } = await insertRow("patient_encounters", row, jwt);
        const encId = Array.isArray(eData) ? eData[0]?.id : eData?.id;

        if (eSt === 201 && encId) {
          ok(`  [${enc.type}] "${enc.title}"  id=${encId}`);
          encResults.push({ type: enc.type, title: enc.title, ok: true });
        } else {
          bad(`  [${enc.type}] "${enc.title}"  HTTP ${eSt}: ${JSON.stringify(eData)}`);
          encResults.push({ type: enc.type, title: enc.title, ok: false, err: JSON.stringify(eData) });
        }
      }

      summary.push({
        doctor:     doctor.doctorName,
        hospital:   doctor.hospitalName,
        patient:    fullName,
        dob:        patient._dob,
        gender:     patient._gender,
        bloodGroup: patient._blood_group,
        city:       patient._city,
        patientId,
        encounters: encResults,
      });
    }
  }

  // ── Summary table ───────────────────────────────────────────────────────────
  sep("SUMMARY");

  let totalPatients = 0, totalEncounters = 0, failedEnc = 0;

  for (const row of summary) {
    totalPatients++;
    const encLine = row.encounters.map(e => `${e.ok ? "✓" : "✗"} ${e.type}`).join("  ");
    console.log(
      `  ${row.patient.padEnd(22)} | ${row.gender.slice(0,1)} | ${row.bloodGroup.padEnd(3)} | ${row.city.padEnd(16)} | ` +
      `${row.doctor.replace("Dr. ", "Dr.").padEnd(20)} | ${encLine}`
    );
    row.encounters.forEach(e => { totalEncounters++; if (!e.ok) failedEnc++; });
  }

  console.log(`\n  Patients created  : ${totalPatients}`);
  console.log(`  Encounters created: ${totalEncounters - failedEnc} / ${totalEncounters}`);
  if (failedEnc > 0) console.log(`  Failed encounters : ${failedEnc}`);
  log("Done.");
}

main().catch(e => { console.error("Unhandled error:", e); process.exit(1); });
