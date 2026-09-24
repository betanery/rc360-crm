import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizePhone = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const fillTemplate = (template: string, name: string, eventName: string) =>
  template.replaceAll("{{nome}}", name.split(" ")[0]).replaceAll("{{evento}}", eventName);

interface EventRow {
  id: string;
  organization_id: string;
  name: string;
  product: string;
  starts_at: string | null;
  ends_at: string | null;
  reminder_days: number[];
  channel: "whatsapp" | "email" | "both";
  welcome_message: string | null;
  reminder_message: string | null;
  closing_message: string | null;
  followup_message: string | null;
  group_url: string | null;
  group_cta: string | null;
  active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = (await req.json().catch(() => null)) as {
    slug?: string;
    name?: string;
    phone?: string;
    email?: string;
    cpf?: string;
  } | null;
  const slug = String(body?.slug || "").trim();
  const name = String(body?.name || "").trim();
  const phone = normalizePhone(body?.phone);
  const emailRaw = String(body?.email || "")
    .trim()
    .toLowerCase();
  const email = emailRaw.includes("@") ? emailRaw : null;
  const cpfDigits = String(body?.cpf || "").replace(/\D/g, "");
  const cpf = cpfDigits.length === 11 ? cpfDigits : null;

  if (!slug) return json({ error: "slug_required" }, 400);
  if (!name || !phone) return json({ error: "nome_e_whatsapp_sao_obrigatorios" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: event, error: eventError } = await db
    .from("events")
    .select(
      "id,organization_id,name,product,starts_at,ends_at,reminder_days,channel,welcome_message,reminder_message,closing_message,followup_message,group_url,group_cta,active",
    )
    .eq("slug", slug)
    .maybeSingle<EventRow>();
  if (eventError) return json({ error: eventError.message }, 500);
  if (!event || !event.active) return json({ error: "evento_nao_encontrado" }, 404);

  let contact = null;
  if (email) {
    const result = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", event.organization_id)
      .ilike("email", email)
      .maybeSingle();
    contact = result.data;
  }
  if (!contact) {
    const result = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", event.organization_id)
      .eq("phone", phone)
      .maybeSingle();
    contact = result.data;
  }

  const contactData = {
    organization_id: event.organization_id,
    name,
    phone,
    email,
    ...(cpf ? { cpf } : {}),
    product: event.product,
    source: "Formulário",
    campaign: event.name,
    whatsapp_opt_in: true,
    email_opt_in: true,
    opt_in_at: new Date().toISOString(),
    opt_in_source: "formulario",
  };

  let contactId: string;
  if (contact) {
    const { error } = await db.from("contacts").update(contactData).eq("id", contact.id);
    if (error) return json({ error: error.message }, 500);
    contactId = contact.id;
  } else {
    const { data, error } = await db.from("contacts").insert(contactData).select("id").single();
    if (error) return json({ error: error.message }, 500);
    contactId = data.id;
  }

  await db
    .from("campaigns")
    .upsert(
      { organization_id: event.organization_id, name: event.name },
      { onConflict: "organization_id,name", ignoreDuplicates: true },
    );

  // Vínculo estruturado contato↔evento pra lista de inscritos/presença.
  // ignoreDuplicates preserva registered_at/attended se a pessoa reenviar
  // o formulário (não reseta presença já marcada).
  await db
    .from("event_registrations")
    .upsert(
      { organization_id: event.organization_id, event_id: event.id, contact_id: contactId },
      { onConflict: "event_id,contact_id", ignoreDuplicates: true },
    );

  const { data: existingQueueItem } = await db
    .from("automation_queue")
    .select("id")
    .eq("contact_id", contactId)
    .eq("metadata->>event_id", event.id)
    .limit(1)
    .maybeSingle();
  const alreadyEnqueued = Boolean(existingQueueItem);

  const channels =
    event.channel === "both" ? (["whatsapp", "email"] as const) : ([event.channel] as const);
  const now = new Date();
  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : startsAt;

  const steps: Array<{ type: string; message: string | null; scheduledAt: Date | null }> = [
    { type: "welcome", message: event.welcome_message, scheduledAt: now },
  ];
  if (startsAt) {
    for (const days of event.reminder_days ?? []) {
      const scheduledAt = addDays(startsAt, -days);
      if (scheduledAt > now) {
        steps.push({ type: "reminder", message: event.reminder_message, scheduledAt });
      }
    }
  }
  if (endsAt) {
    steps.push({ type: "closing", message: event.closing_message, scheduledAt: endsAt });
    steps.push({
      type: "followup",
      message: event.followup_message,
      scheduledAt: addDays(endsAt, 1),
    });
  }

  // Insere direto na fila (em vez de chamar a RPC enqueue_automation): essa
  // função roda com a service role, sem auth.uid(), e a RPC exige
  // is_org_member(auth.uid()) — que só existe pra chamadas de usuário
  // logado. O opt-in já foi garantido acima ao criar/atualizar o contato.
  // `alreadyEnqueued` evita duplicar a cadência inteira quando o mesmo
  // contato reenvia o formulário (reload, link reaberto, etc.).
  if (!alreadyEnqueued) {
    for (const step of steps) {
      if (!step.message?.trim() || !step.scheduledAt) continue;
      const message = fillTemplate(step.message, name, event.name);
      for (const channel of channels) {
        await db.from("automation_queue").insert({
          organization_id: event.organization_id,
          contact_id: contactId,
          channel,
          automation_type: `event_${step.type}`,
          subject: channel === "email" ? event.name : null,
          message,
          scheduled_at: step.scheduledAt.toISOString(),
          status: "pending",
          metadata: { event_id: event.id },
        });
      }
    }
  }

  return json({
    ok: true,
    contact_id: contactId,
    group_url: event.group_url,
    group_cta: event.group_cta,
  });
});
