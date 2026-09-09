import { createClient } from "npm:@supabase/supabase-js@2";
import { renderEmailHtml, renderEmailText } from "../_shared/email-template.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOTCONVERSA_KEY = Deno.env.get("BOTCONVERSA_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "RC360 CRM <onboarding@resend.dev>";
const RESEND_REPLY_TO = Deno.env.get("RESEND_REPLY_TO");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const BOT_BASE = "https://backend.botconversa.com.br/api/v1/webhook";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function sendWhatsApp(phone: string, message: string) {
  if (!BOTCONVERSA_KEY) throw new Error("BOTCONVERSA_API_KEY not configured");
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;

  const lookup = await fetch(`${BOT_BASE}/subscriber/get_by_phone/${normalized}/`, {
    headers: { "API-KEY": BOTCONVERSA_KEY },
  });
  if (!lookup.ok) throw new Error(`BotConversa lookup failed: ${lookup.status}`);
  const subscriber = await lookup.json();
  if (!subscriber?.id) throw new Error("BotConversa subscriber not found");

  const sent = await fetch(`${BOT_BASE}/subscriber/${subscriber.id}/send_message/`, {
    method: "POST",
    headers: { "API-KEY": BOTCONVERSA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text", value: message }),
  });
  if (!sent.ok) throw new Error(`BotConversa send failed: ${sent.status}`);
}

async function sendEmail(
  email: string,
  subject: string,
  message: string,
  _metadata: Record<string, unknown>,
) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const content = { heading: subject, bodyText: message };
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject,
      html: renderEmailHtml(content),
      text: renderEmailText(content),
      ...(RESEND_REPLY_TO ? { reply_to: RESEND_REPLY_TO } : {}),
    }),
  });
  if (!sent.ok) throw new Error(`Resend request failed: ${sent.status}`);
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: queue, error } = await db
    .from("automation_queue")
    .select("*, contacts(id,name,email,phone,whatsapp_opt_in,email_opt_in)")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let blocked = 0;
  let failed = 0;

  for (const item of queue ?? []) {
    const contact = item.contacts;
    const attempts = Number(item.attempts ?? 0) + 1;
    try {
      await db
        .from("automation_queue")
        .update({ status: "processing", attempts })
        .eq("id", item.id);

      if (item.channel === "whatsapp") {
        if (!contact?.whatsapp_opt_in || !contact?.phone) {
          blocked++;
          await db
            .from("automation_queue")
            .update({ status: "blocked", last_error: "WhatsApp sem opt-in ou telefone" })
            .eq("id", item.id);
          continue;
        }
        await sendWhatsApp(contact.phone, item.message || "");
      } else {
        if (!contact?.email_opt_in || !contact?.email) {
          blocked++;
          await db
            .from("automation_queue")
            .update({ status: "blocked", last_error: "E-mail sem opt-in ou endereço" })
            .eq("id", item.id);
          continue;
        }
        await sendEmail(
          contact.email,
          item.subject || "RC360",
          item.message || "",
          item.metadata || {},
        );
      }

      sent++;
      await db
        .from("automation_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", item.id);
      await db.from("activities").insert({
        organization_id: item.organization_id,
        contact_id: item.contact_id,
        action: `Automação ${item.channel} enviada`,
        entity_type: "automation_queue",
        entity_id: item.id,
        details: { automation_type: item.automation_type, message: item.message },
      });
    } catch (error) {
      failed++;
      await db
        .from("automation_queue")
        .update({
          status: attempts >= 3 ? "failed" : "pending",
          last_error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", item.id);
    }
  }

  return json({ scanned: queue?.length ?? 0, sent, blocked, failed });
});
