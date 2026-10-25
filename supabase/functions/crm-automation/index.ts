import { createClient } from "npm:@supabase/supabase-js@2";
import { renderEmailHtml, renderEmailText } from "../_shared/email-template.ts";
import { findOrCreateBotConversaSubscriber } from "../_shared/botconversa.ts";
import { unsubscribeOneClickUrl, unsubscribePageUrl } from "../_shared/unsubscribe.ts";

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
// Teto de e-mails de marketing/conteúdo. Começa baixo de propósito: um
// domínio novo precisa "esquentar" aos poucos; suba o teto com o tempo.
const EMAIL_MAX_PER_RUN = Number(Deno.env.get("EMAIL_MAX_PER_RUN") ?? "40");
const DAILY_EMAIL_CAP = Number(Deno.env.get("DAILY_EMAIL_CAP") ?? "100");
const MARKETING_TYPES = ["cadence_step", "content"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWhatsApp(phone: string, name: string, message: string, fileUrl?: string) {
  if (!BOTCONVERSA_KEY) throw new Error("BOTCONVERSA_API_KEY not configured");
  const subscriberId = await findOrCreateBotConversaSubscriber(phone, name);

  const post = async (type: "text" | "file", value: string) => {
    const sent = await fetch(`${BOT_BASE}/subscriber/${subscriberId}/send_message/`, {
      method: "POST",
      headers: { "API-KEY": BOTCONVERSA_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    if (!sent.ok) throw new Error(`BotConversa send failed: ${sent.status}`);
  };

  // O PDF vai primeiro (é o que importa); se falhar, nada foi enviado e o
  // retry não duplica o texto.
  if (fileUrl) await post("file", fileUrl);
  await post("text", message);
}

// Proposta em PDF: o caminho fica em automation_queue.metadata.pdf_path
// (bucket privado "proposals"). Sem pdf_path, o envio segue como antes.
async function signedProposalUrl(db: ReturnType<typeof createClient>, path: string) {
  const { data, error } = await db.storage.from("proposals").createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error(`Proposta PDF indisponível: ${error?.message}`);
  return data.signedUrl;
}

async function proposalAttachment(db: ReturnType<typeof createClient>, path: string, name: string) {
  const { data, error } = await db.storage.from("proposals").download(path);
  if (error || !data) throw new Error(`Proposta PDF indisponível: ${error?.message}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { filename: name, content: btoa(binary) };
}

interface EmailOptions {
  contactId: string;
  firstName: string;
  marketing: boolean;
  preheader?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  attachments?: { filename: string; content: string }[];
}

async function sendEmail(email: string, subject: string, message: string, options: EmailOptions) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const heading = subject.replaceAll("{{nome}}", options.firstName);
  // E-mail de conteúdo leva descadastro no corpo e no cabeçalho (exigência
  // do Gmail/Yahoo para envio em volume).
  const unsubscribeUrl = options.marketing ? await unsubscribePageUrl(options.contactId) : undefined;
  const content = {
    heading,
    bodyText: message,
    ...(options.ctaLabel ? { ctaLabel: options.ctaLabel } : {}),
    ...(options.ctaUrl ? { ctaUrl: options.ctaUrl } : {}),
    ...(options.preheader ? { preheader: options.preheader } : {}),
    ...(unsubscribeUrl ? { unsubscribeUrl } : {}),
  };
  const headers = options.marketing
    ? {
        "List-Unsubscribe": `<${await unsubscribeOneClickUrl(options.contactId)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;
  const attachments = options.attachments ?? [];
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: heading,
      html: renderEmailHtml(content),
      text: renderEmailText(content),
      ...(headers ? { headers } : {}),
      ...(attachments.length ? { attachments } : {}),
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

  // Busca cada canal separado para um não ocupar a vez do outro (o teto de
  // e-mail deixa itens pendentes na fila de uma rodada para a outra).
  const loadQueue = (channel: "whatsapp" | "email") =>
    db
      .from("automation_queue")
      .select("*, contacts(id,name,email,phone,whatsapp_opt_in,email_opt_in)")
      .eq("status", "pending")
      .eq("channel", channel)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);
  const [whatsappQueue, emailQueue] = await Promise.all([loadQueue("whatsapp"), loadQueue("email")]);
  const error = whatsappQueue.error ?? emailQueue.error;
  const queue = [...(whatsappQueue.data ?? []), ...(emailQueue.data ?? [])].sort(
    (a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at),
  );

  if (error) return json({ error: error.message }, 500);

  // "Hoje" no horário de São Paulo, para os tetos diários.
  const todaySP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const startOfDay = new Date(`${todaySP}T00:00:00-03:00`);
  const { count: sentToday } = await db
    .from("automation_queue")
    .select("id", { count: "exact", head: true })
    .eq("channel", "whatsapp")
    .eq("status", "sent")
    .gte("sent_at", startOfDay.toISOString());
  const dailyCapHit = (sentToday ?? 0) >= DAILY_WHATSAPP_CAP;
  const { count: emailsSentToday } = await db
    .from("automation_queue")
    .select("id", { count: "exact", head: true })
    .eq("channel", "email")
    .in("automation_type", MARKETING_TYPES)
    .eq("status", "sent")
    .gte("sent_at", startOfDay.toISOString());
  let marketingEmailsToday = emailsSentToday ?? 0;
  let marketingEmailsThisRun = 0;

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  let whatsappSentThisRun = 0;

  for (const item of queue) {
    const contact = item.contacts;
    const isMarketingEmail =
      item.channel === "email" && MARKETING_TYPES.includes(String(item.automation_type));
    // E-mail de marketing respeita o teto por rodada e o diário; fica pendente
    // para a próxima rodada (transacionais, como proposta, não são limitados).
    if (
      isMarketingEmail &&
      (marketingEmailsThisRun >= EMAIL_MAX_PER_RUN || marketingEmailsToday >= DAILY_EMAIL_CAP)
    ) {
      continue;
    }

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
        const pdfPath = typeof item.metadata?.pdf_path === "string" ? item.metadata.pdf_path : null;
        await sendWhatsApp(
          contact.phone,
          contact.name || "",
          item.message || "",
          pdfPath ? await signedProposalUrl(db, pdfPath) : undefined,
        );
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
        const pdfPath = typeof item.metadata?.pdf_path === "string" ? item.metadata.pdf_path : null;
        const pdfName =
          typeof item.metadata?.pdf_name === "string" ? item.metadata.pdf_name : "proposta.pdf";
        const meta = (item.metadata ?? {}) as Record<string, unknown>;
        await sendEmail(contact.email, item.subject || "RC360", item.message || "", {
          contactId: contact.id,
          firstName: String(contact.name ?? "").split(" ")[0] ?? "",
          marketing: isMarketingEmail,
          ...(typeof meta["preheader"] === "string" ? { preheader: meta["preheader"] } : {}),
          ...(typeof meta["cta_label"] === "string" ? { ctaLabel: meta["cta_label"] } : {}),
          ...(typeof meta["cta_url"] === "string" ? { ctaUrl: meta["cta_url"] } : {}),
          attachments: pdfPath ? [await proposalAttachment(db, pdfPath, pdfName)] : [],
        });
        if (isMarketingEmail) {
          marketingEmailsThisRun++;
          marketingEmailsToday++;
          await sleep(400);
        }
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
