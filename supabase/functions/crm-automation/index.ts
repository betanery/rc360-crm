import { createClient } from "npm:@supabase/supabase-js@2";
import { renderEmailHtml, renderEmailText } from "../_shared/email-template.ts";
import { findOrCreateBotConversaSubscriber } from "../_shared/botconversa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOTCONVERSA_KEY = Deno.env.get("BOTCONVERSA_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "RC360 CRM <onboarding@resend.dev>";
const RESEND_REPLY_TO = Deno.env.get("RESEND_REPLY_TO");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const BOT_BASE = "https://backend.botconversa.com.br/api/v1/webhook";
const WHATSAPP_MAX_PER_RUN = Number(Deno.env.get("WHATSAPP_MAX_PER_RUN") ?? "15");
const DAILY_WHATSAPP_CAP = Number(Deno.env.get("DAILY_WHATSAPP_CAP") ?? "150");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWhatsApp(phone: string, name: string, message: string) {
  if (!BOTCONVERSA_KEY) throw new Error("BOTCONVERSA_API_KEY not configured");
  const subscriberId = await findOrCreateBotConversaSubscriber(phone, name);

  const sent = await fetch(`${BOT_BASE}/subscriber/${subscriberId}/send_message/`, {
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
  if (!sent.ok) {
    const body = await sent.json().catch(() => null);
    const detail = body?.message || body?.error?.message;
    throw new Error(detail ? `Resend: ${detail}` : `Resend request failed: ${sent.status}`);
  }
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Matricula contatos inativos em cadências do tipo "inactivity_days" antes
  // de processar a fila — não é um evento, então precisa ser verificado
  // periodicamente, e reaproveita esta mesma invocação em vez de um cron novo.
  try {
    await db.rpc("run_inactivity_cadence_scan");
  } catch (scanError) {
    console.error("run_inactivity_cadence_scan failed", scanError);
  }

  const { data: queue, error } = await db
    .from("automation_queue")
    .select("*, contacts(id,name,email,phone,whatsapp_opt_in,email_opt_in)")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) return json({ error: error.message }, 500);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: sentToday } = await db
    .from("automation_queue")
    .select("id", { count: "exact", head: true })
    .eq("channel", "whatsapp")
    .eq("status", "sent")
    .gte("sent_at", startOfDay.toISOString());
  const dailyCapHit = (sentToday ?? 0) >= DAILY_WHATSAPP_CAP;

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  let whatsappSentThisRun = 0;

  for (const item of queue ?? []) {
    const contact = item.contacts;

    // Espaça os envios de WhatsApp (cap por execução + cap diário) pra não
    // disparar tudo em rajada — deixa como "pending" pro próximo ciclo em
    // vez de gastar uma tentativa/marcar erro.
    if (
      item.channel === "whatsapp" &&
      (whatsappSentThisRun >= WHATSAPP_MAX_PER_RUN || dailyCapHit)
    ) {
      continue;
    }

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
        await sendWhatsApp(contact.phone, contact.name || "", item.message || "");
        whatsappSentThisRun++;
        if (whatsappSentThisRun < WHATSAPP_MAX_PER_RUN) {
          await sleep(3000 + Math.random() * 5000);
        }
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
      const isFinal = attempts >= 3;
      // Backoff crescente (15min, depois 45min) pra falha não voltar pra
      // frente da fila em praticamente todo ciclo de 15 min e martelar o
      // provedor de WhatsApp com o mesmo item repetidamente.
      const backoffMinutes = attempts === 1 ? 15 : 45;
      await db
        .from("automation_queue")
        .update({
          status: isFinal ? "failed" : "pending",
          ...(isFinal
            ? {}
            : { scheduled_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString() }),
          last_error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", item.id);
    }
  }

  return json({
    scanned: queue?.length ?? 0,
    sent,
    blocked,
    failed,
    whatsappSentThisRun,
    dailyCapHit,
  });
});
