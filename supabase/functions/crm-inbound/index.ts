import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("CRM_WEBHOOK_SECRET");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const pick = (obj: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
};

const normalizePhone = (value: unknown) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
};

const allowedProducts = ["Rotas do Lucro", "Fastrack", "Consultoria 4X"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WEBHOOK_SECRET || req.headers.get("x-crm-webhook-secret") !== WEBHOOK_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return json({ error: "invalid_json" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: org } = await db.from("organizations").select("id").order("created_at").limit(1).single();
  if (!org?.id) return json({ error: "organization_not_found" }, 500);

  const provider = String(pick(payload, ["provider", "source", "platform"]) || "webhook").toLowerCase();
  const eventType = String(pick(payload, ["event_type", "event", "type", "status"]) || "lead").toLowerCase();
  const externalIdRaw = pick(payload, ["event_id", "id", "transaction_id", "order_id"]);
  const externalId = externalIdRaw ? String(externalIdRaw) : null;

  if (externalId) {
    const { data: duplicate } = await db
      .from("automation_events")
      .select("id")
      .eq("organization_id", org.id)
      .eq("provider", provider)
      .eq("external_id", externalId)
      .maybeSingle();
    if (duplicate) return json({ ok: true, duplicate: true, event_id: duplicate.id });
  }

  const nested = (payload.customer || payload.contact || payload.buyer || {}) as Record<string, unknown>;
  const source = { ...payload, ...nested };
  const name = String(pick(source, ["name", "full_name", "customer_name", "buyer_name"]) || "Contato sem nome");
  const phone = normalizePhone(pick(source, ["phone", "whatsapp", "mobile", "telephone"]));
  const emailRaw = pick(source, ["email", "customer_email", "buyer_email"]);
  const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;
  const productRaw = pick(payload, ["product", "product_name", "offer_name", "item_name"]);
  const product = productRaw ? String(productRaw).trim() : null;
  const value = Number(pick(payload, ["value", "amount", "price", "total"]) || 0) || 0;
  const campaignRaw = pick(payload, ["event_name", "campaign", "event_title"]);
  const campaign = campaignRaw ? String(campaignRaw) : null;
  const checkoutRaw = pick(payload, ["checkout_url", "checkout", "cart_url"]);
  const checkoutUrl = checkoutRaw ? String(checkoutRaw) : null;

  if (!phone && !email) return json({ error: "phone_or_email_required" }, 400);
  if (!product || !allowedProducts.includes(product)) {
    return json({ error: "valid_product_required", allowed_products: allowedProducts }, 400);
  }

  let found = null;
  if (email) {
    const result = await db.from("contacts").select("*").eq("organization_id", org.id).ilike("email", email).maybeSingle();
    found = result.data;
  }
  if (!found && phone) {
    const result = await db.from("contacts").select("*").eq("organization_id", org.id).eq("phone", phone).maybeSingle();
    found = result.data;
  }

  let contact = found;
  if (!contact) {
    const { data, error } = await db.from("contacts").insert({
      organization_id: org.id,
      name,
      phone: phone || "",
      email,
      product,
      source: provider,
      campaign,
      external_id: externalId,
    }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    contact = data;
  } else {
    await db.from("contacts").update({
      name: contact.name || name,
      product,
      campaign: campaign || contact.campaign,
      external_id: externalId || contact.external_id,
    }).eq("id", contact.id);
  }

  const isAbandoned = eventType.includes("abandon");
  const isPaid = eventType.includes("purchase") || eventType.includes("approved") || eventType.includes("paid");
  if (isPaid && value <= 0) return json({ error: "positive_value_required_for_won" }, 400);

  const stage = isPaid ? "Ganho" : isAbandoned ? "Em qualificação" : "Novo lead";
  const nextAction = isPaid ? "Cliente convertido" : isAbandoned ? "Recuperar carrinho abandonado" : "Realizar primeiro contato";
  const nextActionAt = new Date(Date.now() + (isAbandoned ? 30 * 60 * 1000 : isPaid ? 0 : 24 * 60 * 60 * 1000)).toISOString();

  const { data: existingOpp } = await db
    .from("opportunities")
    .select("*")
    .eq("organization_id", org.id)
    .eq("contact_id", contact.id)
    .neq("stage", "Ganho")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let opportunity = existingOpp;
  if (opportunity) {
    const { data, error } = await db.from("opportunities").update({
      stage,
      value: value || opportunity.value,
      next_action: nextAction,
      next_action_at: nextActionAt,
      checkout_url: checkoutUrl || opportunity.checkout_url,
      recovery_reason: isAbandoned ? "Carrinho abandonado" : opportunity.recovery_reason,
      external_id: externalId || opportunity.external_id,
    }).eq("id", opportunity.id).select("*").single();
    if (error) return json({ error: error.message }, 500);
    opportunity = data;
  } else {
    const { data, error } = await db.from("opportunities").insert({
      organization_id: org.id,
      contact_id: contact.id,
      stage,
      value,
      next_action: nextAction,
      next_action_at: nextActionAt,
      checkout_url: checkoutUrl,
      recovery_reason: isAbandoned ? "Carrinho abandonado" : null,
      external_id: externalId,
    }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    opportunity = data;
  }

  if (isAbandoned) {
    await db.from("cart_recoveries").insert({
      organization_id: org.id,
      contact_id: contact.id,
      product,
      reason: "Carrinho abandonado",
      value,
      status: "Em recuperação",
    });
    await db.from("tasks").insert({
      organization_id: org.id,
      contact_id: contact.id,
      title: "Recuperar carrinho abandonado",
      due_at: nextActionAt,
      type: "WhatsApp",
      status: "Pendente",
    });
  }

  if (isPaid) {
    await db.from("payments").upsert({
      organization_id: org.id,
      contact_id: contact.id,
      external_id: externalId,
      provider,
      product,
      value,
      status: "Aprovado",
      raw_event: payload,
    }, { onConflict: "organization_id,provider,external_id" });
    await db.from("cart_recoveries").update({ status: "Recuperado" })
      .eq("organization_id", org.id).eq("contact_id", contact.id).eq("status", "Em recuperação");
  }

  const { data: event, error: eventError } = await db.from("automation_events").insert({
    organization_id: org.id,
    provider,
    event_type: eventType,
    external_id: externalId,
    status: "processed",
    payload,
  }).select("id").single();
  if (eventError) return json({ error: eventError.message }, 500);

  await db.from("activities").insert({
    organization_id: org.id,
    contact_id: contact.id,
    action: isPaid ? "Compra aprovada" : isAbandoned ? "Carrinho abandonado" : "Lead recebido",
    entity_type: "automation_event",
    entity_id: event.id,
    details: { provider, product, value, opportunity_id: opportunity.id },
  });

  return json({ ok: true, event_id: event.id, contact_id: contact.id, opportunity_id: opportunity.id, stage });
});
