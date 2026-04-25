/**
 * printReferral
 * Opens a formatted referral letter in a new window and triggers the browser
 * print dialog. The user can "Save as PDF" from there.
 *
 * No extra dependencies — inline CSS keeps the output clean regardless of
 * whether Tailwind is loaded in the print context.
 */

export interface ReferralLetterData {
  referral_number: string;
  primary_diagnosis: string;
  diagnosis_code: string | null;
  urgency: string;
  status: string;
  clinical_summary: string;
  referral_reason: string;
  originating_clinic_name: string;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  decline_reason: string | null;

  patient_snapshot: {
    name?: string;
    age?: number;
    gender?: string;
    mrn?: string;
    phone?: string;
    chronic_conditions?: string[];
  };

  referring_doctor: {
    profile: { first_name: string; last_name: string } | null;
  } | null;

  specialist: {
    profile: {
      first_name: string;
      last_name: string;
      specialization: string | null;
    } | null;
  } | null;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function urgencyLabel(u: string): string {
  return u === "URGENT" ? "URGENT" : u === "SEMI_URGENT" ? "Semi-urgent" : "Routine";
}

function urgencyColor(u: string): string {
  return u === "URGENT" ? "#dc2626" : u === "SEMI_URGENT" ? "#d97706" : "#16a34a";
}

export function printReferralLetter(r: ReferralLetterData): void {
  const refName = r.referring_doctor?.profile
    ? `Dr. ${r.referring_doctor.profile.first_name} ${r.referring_doctor.profile.last_name}`
    : "—";
  const spName = r.specialist?.profile
    ? `Dr. ${r.specialist.profile.first_name} ${r.specialist.profile.last_name}`
    : "—";
  const spSpec = r.specialist?.profile?.specialization ?? "Specialist";
  const chronic = (r.patient_snapshot?.chronic_conditions ?? []).join(", ") || "None recorded";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Referral Letter — ${r.referral_number}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      color: #111;
      background: #fff;
      padding: 0;
    }

    .page {
      max-width: 700px;
      margin: 0 auto;
      padding: 36px 48px 48px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand-name {
      font-size: 20pt;
      font-weight: 700;
      color: #1e3a5f;
      letter-spacing: -0.5px;
    }
    .brand-tagline {
      font-size: 8pt;
      color: #555;
      margin-top: 2px;
    }
    .ref-meta {
      text-align: right;
      font-size: 9pt;
      color: #444;
      line-height: 1.6;
    }
    .ref-meta strong { color: #111; }

    /* ── Title ── */
    .letter-title {
      font-size: 13pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #1e3a5f;
      margin: 18px 0 4px;
    }
    .urgency-banner {
      text-align: center;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 18px;
    }

    /* ── Parties ── */
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f4f7fb;
      border: 1px solid #d0dbe8;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }
    .party-label {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #555;
      margin-bottom: 3px;
    }
    .party-name { font-size: 11pt; font-weight: 700; }
    .party-sub { font-size: 9pt; color: #555; }

    /* ── Section ── */
    .section { margin-bottom: 16px; }
    .section-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1e3a5f;
      border-bottom: 1px solid #c8d8e8;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }

    /* ── Patient table ── */
    .patient-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    .patient-table td {
      padding: 4px 8px 4px 0;
      vertical-align: top;
    }
    .patient-table td:first-child {
      color: #555;
      width: 130px;
      font-size: 9pt;
    }
    .patient-table td:last-child { font-weight: 600; }

    /* ── Body text ── */
    .body-text {
      font-size: 11pt;
      line-height: 1.7;
      white-space: pre-line;
    }

    /* ── Signature block ── */
    .signature {
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .sig-left { font-size: 10pt; line-height: 1.8; }
    .sig-line {
      border-top: 1px solid #333;
      width: 200px;
      padding-top: 4px;
      font-size: 10pt;
      text-align: center;
      color: #333;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      border-top: 1px solid #d0dbe8;
      padding-top: 8px;
      font-size: 8pt;
      color: #888;
      text-align: center;
      line-height: 1.6;
    }

    /* ── Outcome block (shown only when outcome exists) ── */
    .outcome-box {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 10pt;
    }

    @media print {
      body { padding: 0; }
      .page { padding: 24px 32px; }
      @page { margin: 12mm 14mm; size: A4; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-name">Doctor Bridge</div>
      <div class="brand-tagline">Verified Specialist Referral Network · India</div>
    </div>
    <div class="ref-meta">
      <div><strong>Ref No:</strong> ${r.referral_number}</div>
      <div><strong>Date:</strong> ${fmt(r.sent_at ?? r.created_at)}</div>
      <div><strong>Status:</strong> ${r.status.replace(/_/g, " ")}</div>
    </div>
  </div>

  <!-- Title -->
  <div class="letter-title">Medical Referral Letter</div>
  <div class="urgency-banner" style="color:${urgencyColor(r.urgency)}">
    ▲ ${urgencyLabel(r.urgency).toUpperCase()} REFERRAL
  </div>

  <!-- Parties -->
  <div class="parties">
    <div>
      <div class="party-label">Referring Physician</div>
      <div class="party-name">${refName}</div>
      <div class="party-sub">${r.originating_clinic_name}</div>
    </div>
    <div>
      <div class="party-label">Referred To</div>
      <div class="party-name">${spName}</div>
      <div class="party-sub">${spSpec}</div>
    </div>
  </div>

  <!-- Patient -->
  <div class="section">
    <div class="section-title">Patient Information</div>
    <table class="patient-table">
      <tr>
        <td>Full name</td>
        <td>${r.patient_snapshot?.name ?? "—"}</td>
        <td style="width:50px"></td>
        <td style="color:#555;width:130px;font-size:9pt">Age / Sex</td>
        <td style="font-weight:600">${r.patient_snapshot?.age ?? "—"} yrs / ${r.patient_snapshot?.gender ?? "—"}</td>
      </tr>
      <tr>
        <td>Patient ID</td>
        <td style="font-family:monospace">${r.patient_snapshot?.mrn ?? "—"}</td>
        <td></td>
        <td style="color:#555;font-size:9pt">Phone</td>
        <td style="font-weight:600;font-family:monospace">${r.patient_snapshot?.phone ?? "—"}</td>
      </tr>
      <tr>
        <td>Diagnosis</td>
        <td style="font-weight:700;color:#1e3a5f">
          ${r.primary_diagnosis}${r.diagnosis_code ? ` <span style="font-weight:400;color:#555;font-family:monospace">(${r.diagnosis_code})</span>` : ""}
        </td>
        <td></td>
        <td style="color:#555;font-size:9pt">Comorbidities</td>
        <td style="font-weight:600">${chronic}</td>
      </tr>
    </table>
  </div>

  <!-- Clinical Summary -->
  <div class="section">
    <div class="section-title">Clinical Summary</div>
    <p class="body-text">${r.clinical_summary}</p>
  </div>

  <!-- Reason for Referral -->
  <div class="section">
    <div class="section-title">Reason for Referral</div>
    <p class="body-text">${r.referral_reason}</p>
  </div>

  ${r.outcome ? `
  <!-- Outcome -->
  <div class="section">
    <div class="section-title">Outcome</div>
    <div class="outcome-box">
      <strong>${r.outcome.replace(/_/g, " ")}</strong>
      ${r.outcome_notes ? `<br/><span style="color:#444">${r.outcome_notes}</span>` : ""}
    </div>
  </div>
  ` : ""}

  ${r.decline_reason ? `
  <div class="section">
    <div class="section-title">Declined — Reason</div>
    <p class="body-text" style="color:#b91c1c">${r.decline_reason}</p>
  </div>
  ` : ""}

  <!-- Signature -->
  <div class="signature">
    <div class="sig-left">
      <div>Yours sincerely,</div>
      <div style="margin-top:32px"><strong>${refName}</strong></div>
      <div style="color:#555;font-size:9.5pt">${r.originating_clinic_name}</div>
      <div style="color:#555;font-size:9.5pt">Date: ${fmt(r.sent_at ?? r.created_at)}</div>
    </div>
    <div style="text-align:right">
      <div class="sig-line">Signature &amp; Stamp</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    This referral was generated by Doctor Bridge — India's verified specialist referral network.<br/>
    Referral No. ${r.referral_number} · Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
  </div>

</div>

<script>
  window.onload = function () {
    window.print();
    window.addEventListener("afterprint", function () { window.close(); });
  };
<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for this site to download the PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
