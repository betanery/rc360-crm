import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOTCONVERSA_KEY = Deno.env.get("BOTCONVERSA_API_KEY");
const BOT_BASE = "https://backend.botconversa.com.br/api/v1/webhook";
const TEST_MESSAGE = "Teste de integração RC360 CRM com BotConversa. Se você recebeu esta mensagem, a conexão está funcionando.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!BOTCONVERSA_KEY) return json({ error: "botconversa_not_configured" }, 500);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await db
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") return json({ error: "forbidden" }, 403);

  const payload = await req.json().catch(() => null) as { phone?: string; confirmed?: boolean } | null;
  if (!payload?.confirmed) return json({ error: "confirmation_required" }, 400);

  const digits = String(payload.phone || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return json({ error: "invalid_phone" }, 400);
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;

  const lookup = await fetch(`${BOT_BASE}/subscriber/get_by_phone/${normalized}/`, {
    headers: { "API-KEY": BOTCONVERSA_KEY },
  });
  if (!lookup.ok) {
    return json({ error: "subscriber_lookup_failed", status: lookup.status }, 502);
  }

  const subscriber = await lookup.json();
  if (!subscriber?.id) return json({ error: "subscriber_not_found" }, 404);

  const sent = await fetch(`${BOT_BASE}/subscriber/${subscriber.id}/send_message/`, {
    method: "POST",
    headers: { "API-KEY": BOTCONVERSA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text", value: TEST_MESSAGE }),
  });

  if (!sent.ok) return json({ error: "send_failed", status: sent.status }, 502);

  await db.from("activities").insert({
    organization_id: profile.organization_id,
    actor_id: userData.user.id,
    action: "Teste de integração BotConversa enviado",
    entity_type: "integration_test",
    details: { provider: "BotConversa", phone_suffix: normalized.slice(-4) },
  });

  return json({ ok: true, message: "Mensagem de teste enviada pelo BotConversa." });
});
