// Curated ICD-10 codes for common Indian outpatient referrals.
// Used for specialist search + referral wizard.

export interface Condition {
  code: string;
  name: string;
  specialty: string;
}

export const CONDITIONS: Condition[] = [
  // Cardiology
  { code: "I10", name: "Essential hypertension", specialty: "Cardiology" },
  { code: "I20", name: "Angina pectoris", specialty: "Cardiology" },
  { code: "I25", name: "Chronic ischemic heart disease", specialty: "Cardiology" },
  { code: "I50", name: "Heart failure", specialty: "Cardiology" },
  { code: "I48", name: "Atrial fibrillation", specialty: "Cardiology" },
  // Nephrology
  { code: "N17", name: "Acute kidney injury", specialty: "Nephrology" },
  { code: "N18", name: "Chronic kidney disease", specialty: "Nephrology" },
  { code: "N19", name: "Unspecified kidney failure", specialty: "Nephrology" },
  { code: "N20", name: "Renal calculus", specialty: "Nephrology" },
  // Endocrinology
  { code: "E11", name: "Type 2 diabetes mellitus", specialty: "Endocrinology" },
  { code: "E10", name: "Type 1 diabetes mellitus", specialty: "Endocrinology" },
  { code: "E03", name: "Hypothyroidism", specialty: "Endocrinology" },
  { code: "E66", name: "Obesity", specialty: "Endocrinology" },
  // Pulmonology
  { code: "J45", name: "Asthma", specialty: "Pulmonology" },
  { code: "J44", name: "COPD", specialty: "Pulmonology" },
  { code: "J18", name: "Pneumonia", specialty: "Pulmonology" },
  // Gastroenterology
  { code: "K21", name: "Gastro-esophageal reflux disease", specialty: "Gastroenterology" },
  { code: "K29", name: "Gastritis and duodenitis", specialty: "Gastroenterology" },
  { code: "K76", name: "Other diseases of liver", specialty: "Gastroenterology" },
  // Neurology
  { code: "G43", name: "Migraine", specialty: "Neurology" },
  { code: "G40", name: "Epilepsy", specialty: "Neurology" },
  { code: "I63", name: "Cerebral infarction (stroke)", specialty: "Neurology" },
  // Orthopedics
  { code: "M17", name: "Osteoarthritis of knee", specialty: "Orthopedics" },
  { code: "M54", name: "Dorsalgia (back pain)", specialty: "Orthopedics" },
  { code: "M81", name: "Osteoporosis", specialty: "Orthopedics" },
];

export function findCondition(code: string): Condition | undefined {
  return CONDITIONS.find((c) => c.code === code);
}
