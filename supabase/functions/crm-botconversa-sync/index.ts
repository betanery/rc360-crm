import { createClient } from "npm:@supabase/supabase-js@2";
import { findOrCreateBotConversaSubscriber } from "../_shared/botconversa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: profile } = await db
    .from("profiles")
    .select("organization_id,role")
    .eq("id", userData.user.id)
    .single();
  if (!profile || profile.role !== "admin") return json({ error: "forbidden" }, 403);

  const body = (await req.json().catch(() => null)) as {
    mode?: "backfill" | "single";
    contact_id?: string;
  } | null;

  if (body?.mode === "single") {
    if (!body.contact_id) return json({ error: "contact_id_required" }, 400);
    const { data: contact, error } = await db
      .from("contacts")
      .select("id,name,phone,whatsapp_opt_in")
      .eq("id", body.contact_id)
      .eq("organization_id", profile.organization_id)
      .single();
    if (error || !contact) return json({ error: "contact_not_found" }, 404);
    if (!contact.whatsapp_opt_in || !contact.phone) {
      return json({ ok: true, skipped: "no_opt_in_or_phone" });
    }
    try {
      const subscriberId = await findOrCreateBotConversaSubscriber(contact.phone, contact.name);
      return json({ ok: true, subscriber_id: subscriberId });
    } catch (syncError) {
      return json(
        { error: syncError instanceof Error ? syncError.message : String(syncError) },
        502,
      );
    }
  }

  // Backfill: cria na BotConversa todo contato já opt-in que ainda não
  // passou pela rotina de sincronização (que agora roda automaticamente
  // em toda entrada nova de contato — formulário de evento, webhook,
  // importação CSV).
  const { data: contacts, error: contactsError } = await db
    .from("contacts")
    .select("id,name,phone")
    .eq("organization_id", profile.organization_id)
    .eq("whatsapp_opt_in", true)
    .not("phone", "is", null)
    .neq("phone", "");
  if (contactsError) return json({ error: contactsError.message }, 500);

  let synced = 0;
  let failed = 0;
  const errors: Array<{ contact_id: string; error: string }> = [];
  for (const contact of contacts ?? []) {
    try {
      await findOrCreateBotConversaSubscriber(contact.phone, contact.name);
      synced++;
    } catch (syncError) {
      failed++;
      errors.push({
        contact_id: contact.id,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  return json({
    ok: true,
    total: contacts?.length ?? 0,
    synced,
    failed,
    errors: errors.slice(0, 50),
  });
});
