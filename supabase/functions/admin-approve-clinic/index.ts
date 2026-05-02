import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

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

// Resend Email Helper
async function sendEmail(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not set. Skipping email send.");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: "Doctor Bridge <admin@doctorbridge.in>",
        to: [to],
        subject,
        html,
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API error:", errorText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email via Resend:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify platform admin
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isSuperAdmin = (roleRows ?? []).some((r) => r.role === "super_admin");
    if (!isSuperAdmin) return json({ error: "Forbidden — platform admins only" }, 403);

    const { clinicId, status, reason } = await req.json();
    if (!clinicId || !status) return json({ error: "Missing required fields" }, 400);

    // Update clinic status
    const { data: clinic, error: updateErr } = await admin
      .from("clinics")
      .update({
        verification_status: status,
        verified_at: new Date().toISOString(),
        verified_by: callerId
      })
      .eq("id", clinicId)
      .select("name, email")
      .single();

    if (updateErr || !clinic) {
      return json({ error: updateErr?.message ?? "Failed to update clinic" }, 400);
    }

    // Get the hospital admin's email (from profiles where role = clinic_admin for this clinic)
    const { data: adminProfiles } = await admin
      .from("profiles")
      .select("email, first_name")
      .eq("clinic_id", clinicId)
      .eq("account_type", "clinic_staff")
      .limit(1)
      .single();

    const recipientEmail = adminProfiles?.email || clinic.email;

    if (recipientEmail) {
      if (status === "ACTIVE" || status === "APPROVED") {
        await sendEmail(
          recipientEmail,
          "Congratulations! Your hospital is approved on Doctor Bridge",
          `<h3>Congratulations ${adminProfiles?.first_name || "Admin"},</h3>
           <p>Your institution, <strong>${clinic.name}</strong>, has been successfully verified and approved on the Doctor Bridge network.</p>
           <p>You can now log in to your dashboard to manage your hospital, onboard your doctors, and start receiving digital referrals.</p>
           <br/>
           <p>Regards,<br/>The Doctor Bridge Team</p>`
        );
      } else if (status === "DECLINED" || status === "SUSPENDED") {
        await sendEmail(
          recipientEmail,
          "Action Required: Doctor Bridge Registration Update",
          `<h3>Dear ${adminProfiles?.first_name || "Admin"},</h3>
           <p>We have reviewed your application for <strong>${clinic.name}</strong>. Unfortunately, we cannot approve your registration at this time.</p>
           <p><strong>Reason:</strong> ${reason || "Information provided did not meet verification standards."}</p>
           <p>Please fix the aforementioned issues and contact us at admin@doctorbridge.in to reapply.</p>
           <br/>
           <p>Apologies,<br/>The Doctor Bridge Team</p>`
        );
      }
    }

    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 400);
  }
});
