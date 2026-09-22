import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("CRM_WHATSAPP_WEBHOOK_SECRET");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
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
  if (!digits) return null;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const token = req.headers.get("x-crm-whatsapp-webhook-secret") || url.searchParams.get("token");
  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return json({ error: "invalid_json" }, 400);

  const phone = normalizePhone(
    pick(payload, ["phone", "telefone", "whatsapp", "subscriber_phone", "from"]),
  );
  if (!phone) return json({ error: "phone_required" }, 400);

  const reasonRaw = pick(payload, ["keyword", "reason", "message"]);
  const reason = reasonRaw ? String(reasonRaw).slice(0, 200) : "stop_keyword";

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: org } = await db
    .from("organizations")
    .select("id")
    .order("created_at")
    .limit(1)
    .single();
  if (!org?.id) return json({ error: "organization_not_found" }, 500);

  const { data: contact } = await db
    .from("contacts")
    .select("id")
    .eq("organization_id", org.id)
    .eq("phone", phone)
    .maybeSingle();

  if (!contact) return json({ ok: true, matched: false });

  await db
    .from("contacts")
    .update({
      whatsapp_opt_in: false,
      opt_out_at: new Date().toISOString(),
      opt_out_reason: reason,
    })
    .eq("id", contact.id);

  await db
    .from("automation_queue")
    .update({ status: "blocked", last_error: "Opt-out via WhatsApp" })
    .eq("contact_id", contact.id)
    .eq("channel", "whatsapp")
    .eq("status", "pending");

  await db.from("activities").insert({
    organization_id: org.id,
    contact_id: contact.id,
    action: "Contato optou por sair do WhatsApp",
    entity_type: "contact",
    entity_id: contact.id,
    details: { reason },
  });

  return json({ ok: true, matched: true, contact_id: contact.id });
});
