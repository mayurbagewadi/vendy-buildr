import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifyWorkerSecret(req: Request): boolean {
  const expected = Deno.env.get("SHIPPING_SYNC_SECRET")?.trim();
  if (!expected || expected.length < 16) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const header = req.headers.get("x-sync-secret")?.trim();
  const query = new URL(req.url).searchParams.get("secret")?.trim();
  return [bearer, header, query].some((value) => value && value === expected);
}

function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shippedEmailHtml(payload: any) {
  const customerName = cleanText(payload.customer_name) || "Customer";
  const storeName = cleanText(payload.store_name) || "Store";
  const orderNumber = cleanText(payload.order_number);
  const awb = cleanText(payload.awb);
  const trackingUrl = cleanText(payload.tracking_url);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="margin: 0 0 16px; color: #111827;">Your order has shipped</h2>
      <p style="margin: 0 0 16px; color: #374151;">Hi ${customerName}, your order from ${storeName} has been shipped via Delhivery.</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        ${orderNumber ? `<p style="margin: 0 0 8px;"><strong>Order:</strong> ${orderNumber}</p>` : ""}
        <p style="margin: 0 0 8px;"><strong>Courier:</strong> Delhivery</p>
        <p style="margin: 0;"><strong>AWB:</strong> ${awb}</p>
      </div>
      ${trackingUrl ? `<a href="${trackingUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;">Track your order</a>` : ""}
      <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">If the courier status has not updated yet, please check again later.</p>
    </div>
  `;
}

async function sendEmail(job: any) {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!gmailUser || !gmailPassword) {
    throw new Error("Gmail SMTP credentials not configured");
  }

  const payload = job.payload || {};
  const storeName = cleanText(payload.store_name) || "Store";
  const orderNumber = cleanText(payload.order_number);
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });

  await transporter.sendMail({
    from: `"${storeName}" <${gmailUser}>`,
    to: job.recipient,
    subject: orderNumber ? `Your order ${orderNumber} has shipped` : "Your order has shipped",
    html: shippedEmailHtml(payload),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!verifyWorkerSecret(req)) {
    return jsonResponse({ error: "Unauthorized worker" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit || 25), 100);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: jobs, error: jobsError } = await supabase
      .from("shipping_notification_jobs")
      .select("*")
      .eq("channel", "email")
      .eq("template", "shipment_created")
      .in("status", ["pending", "failed"])
      .lt("attempts", 3)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (jobsError) throw jobsError;

    const results = [];
    for (const job of jobs || []) {
      const attempts = Number(job.attempts || 0) + 1;
      await supabase
        .from("shipping_notification_jobs")
        .update({ status: "processing", attempts })
        .eq("id", job.id);

      try {
        await sendEmail(job);
        await supabase
          .from("shipping_notification_jobs")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", job.id);
        results.push({ id: job.id, status: "sent" });
      } catch (error: any) {
        await supabase
          .from("shipping_notification_jobs")
          .update({
            status: attempts >= 3 ? "failed" : "pending",
            attempts,
            last_error: error.message || "Email send failed",
            scheduled_at: new Date(Date.now() + attempts * 10 * 60 * 1000).toISOString(),
          })
          .eq("id", job.id);
        results.push({ id: job.id, status: "failed", error: error.message });
      }
    }

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (error: any) {
    return jsonResponse({ error: error.message || "Notification worker failed" }, 500);
  }
});
